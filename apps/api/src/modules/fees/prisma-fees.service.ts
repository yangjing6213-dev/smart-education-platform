import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { FeesContext, FeesOperations } from "../../nest/api-tokens.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PERIOD = /^\d{4}-(?:0[1-9]|1[0-2])$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_MINOR = Number.MAX_SAFE_INTEGER;
const DOCUMENT_TYPES = new Set(["FEE_ITEM", "BILL", "AGREEMENT"]);
const STATUS_REASONS: Readonly<Record<string, string>> = {
  VOIDED: "该资料已作废。",
  EXPIRED: "该资料已过期。",
  REVOKED: "该资料已撤回。",
};

type RawDocument = {
  id: string;
  version: number;
  documentType: string;
  title: string;
  studentId: string;
  studentAlias: string;
  studentLabel: string;
  status: string;
  amountMinor: bigint | number | string | null;
  currency: string;
  period: string;
  validFrom: Date | string;
  validTo: Date | string;
  summary: string;
};

type RawLedger = {
  id: string;
  entryType: string;
  amountMinor: bigint | number | string;
  period: string;
  occurredOn: Date | string;
  documentId: string;
  documentVersion: number;
  studentAlias: string;
  studentLabel: string;
};

class FeeFailure extends Error {
  public constructor(
    public readonly code:
      | "VALIDATION_FAILED"
      | "FORBIDDEN_SCOPE"
      | "NOT_FOUND_SCOPED"
      | "CONFLICT_STATE",
    public readonly statusCode: 400 | 403 | 404 | 409,
  ) {
    super(code);
  }
}

const invalid = () => new FeeFailure("VALIDATION_FAILED", 400);
const forbidden = () => new FeeFailure("FORBIDDEN_SCOPE", 403);
const notFound = () => new FeeFailure("NOT_FOUND_SCOPED", 404);
const conflict = () => new FeeFailure("CONFLICT_STATE", 409);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

function dateOnly(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function safeMinor(value: bigint | number | string | null): number | null {
  if (value === null) return null;
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Unsafe fee amount in storage.");
  return amount;
}

function aliasFor(studentId: string): string {
  return `student-${studentId.slice(0, 8).toLowerCase()}`;
}

function assertContext(context: FeesContext, capability: "binding:read" | "fees:manage") {
  if (
    !UUID.test(context.actorId) ||
    !UUID.test(context.tenantId) ||
    !UUID.test(context.campusId) ||
    !context.capabilities.includes(capability)
  )
    throw forbidden();
}

function parseCreate(value: unknown) {
  const keys = [
    "student_id",
    "document_type",
    "title",
    "period",
    "amount_minor",
    "valid_from",
    "valid_to",
    "summary",
  ];
  if (
    !exactKeys(value, keys) ||
    typeof value.student_id !== "string" ||
    !UUID.test(value.student_id) ||
    typeof value.document_type !== "string" ||
    !DOCUMENT_TYPES.has(value.document_type) ||
    typeof value.title !== "string" ||
    value.title.trim().length === 0 ||
    value.title.length > 120 ||
    typeof value.period !== "string" ||
    !PERIOD.test(value.period) ||
    (value.document_type === "AGREEMENT"
      ? value.amount_minor !== null
      : !Number.isSafeInteger(value.amount_minor) ||
        Number(value.amount_minor) < 0 ||
        Number(value.amount_minor) > MAX_MINOR) ||
    !validDate(value.valid_from) ||
    !validDate(value.valid_to) ||
    value.valid_to < value.valid_from ||
    typeof value.summary !== "string" ||
    value.summary.trim().length === 0 ||
    value.summary.length > 500
  )
    throw invalid();

  return {
    studentId: value.student_id.toLowerCase(),
    documentType: value.document_type,
    title: value.title.trim(),
    period: value.period,
    amountMinor: value.amount_minor as number | null,
    validFrom: value.valid_from,
    validTo: value.valid_to,
    summary: value.summary.trim(),
  };
}

function parseExpectedVersion(value: unknown): number {
  if (
    !exactKeys(value, ["expected_version"]) ||
    !Number.isSafeInteger(value.expected_version) ||
    Number(value.expected_version) < 1 ||
    Number(value.expected_version) >= 2_147_483_647
  )
    throw invalid();
  return Number(value.expected_version);
}

export class PrismaFeesService implements FeesOperations {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async parentFees(context: FeesContext) {
    assertContext(context, "binding:read");
    return this.prisma.$transaction(
      async (tx) => {
        const bindings = await tx.$queryRaw<
          { id: string; relationship: string; studentAlias: string; studentLabel: string | null; status: string }[]
        >`
          SELECT
            ba.id::text AS "id",
            'GUARDIAN'::text AS "relationship",
            'student-' || substr(COALESCE(gr.student_id, ba.student_candidate_ref)::text, 1, 8) AS "studentAlias",
            s.display_ref AS "studentLabel",
            CASE
              WHEN gr.status::text = 'ACTIVE' THEN 'APPROVED'
              WHEN gr.status::text = 'RELEASED' THEN 'RELEASED'
              WHEN ba.status::text = 'PENDING' THEN 'PENDING'
              WHEN ba.status::text = 'WITHDRAWN' THEN 'WITHDRAWN'
              WHEN ba.status::text = 'EXPIRED' THEN 'EXPIRED'
              WHEN ba.status::text = 'REJECTED' THEN 'REJECTED'
              ELSE 'EXPIRED'
            END AS "status"
          FROM binding_applications ba
          LEFT JOIN guardian_relationships gr
            ON gr.tenant_id = ba.tenant_id
            AND gr.campus_id = ba.campus_id
            AND gr.binding_application_id = ba.id
            AND gr.guardian_user_id = ba.applicant_user_id
            AND gr.student_id = ba.student_candidate_ref
          LEFT JOIN students s
            ON s.tenant_id = ba.tenant_id
            AND s.campus_id = ba.campus_id
            AND s.id = COALESCE(gr.student_id, ba.student_candidate_ref)
          WHERE ba.tenant_id = ${context.tenantId}::uuid
            AND ba.campus_id = ${context.campusId}::uuid
            AND ba.applicant_user_id = ${context.actorId}::uuid
          ORDER BY ba.created_at DESC, ba.id
          LIMIT 50
        `;

        const documents = await tx.$queryRaw<RawDocument[]>`
          SELECT
            d.id::text AS "id",
            d.version AS "version",
            d.document_type::text AS "documentType",
            d.title AS "title",
            d.student_id::text AS "studentId",
            'student-' || substr(d.student_id::text, 1, 8) AS "studentAlias",
            s.display_ref AS "studentLabel",
            CASE
              WHEN d.status::text = 'AVAILABLE' AND d.valid_to < CURRENT_DATE THEN 'EXPIRED'
              ELSE d.status::text
            END AS "status",
            CASE
              WHEN d.status::text IN ('AVAILABLE', 'PAID') AND d.valid_to >= CURRENT_DATE THEN d.amount_minor
              ELSE NULL
            END AS "amountMinor",
            d.currency AS "currency",
            d.period AS "period",
            d.valid_from AS "validFrom",
            d.valid_to AS "validTo",
            d.summary AS "summary"
          FROM fee_documents d
          JOIN students s
            ON s.tenant_id = d.tenant_id
            AND s.campus_id = d.campus_id
            AND s.id = d.student_id
          WHERE d.tenant_id = ${context.tenantId}::uuid
            AND d.campus_id = ${context.campusId}::uuid
            AND EXISTS (
              SELECT 1 FROM guardian_relationships gr
              WHERE gr.tenant_id = d.tenant_id
                AND gr.campus_id = d.campus_id
                AND gr.student_id = d.student_id
                AND gr.guardian_user_id = ${context.actorId}::uuid
                AND gr.status::text = 'ACTIVE'
            )
          ORDER BY d.created_at DESC, d.id
          LIMIT 200
        `;

        const ledgerRows = await tx.$queryRaw<RawLedger[]>`
          SELECT
            l.id::text AS "id",
            l.entry_type::text AS "entryType",
            l.amount_minor AS "amountMinor",
            l.period AS "period",
            l.occurred_on AS "occurredOn",
            d.id::text AS "documentId",
            d.version AS "documentVersion",
            'student-' || substr(l.student_id::text, 1, 8) AS "studentAlias",
            s.display_ref AS "studentLabel"
          FROM fee_ledger_entries l
          JOIN fee_documents d
            ON d.tenant_id = l.tenant_id
            AND d.campus_id = l.campus_id
            AND d.id = l.document_id
          JOIN students s
            ON s.tenant_id = l.tenant_id
            AND s.campus_id = l.campus_id
            AND s.id = l.student_id
          WHERE l.tenant_id = ${context.tenantId}::uuid
            AND l.campus_id = ${context.campusId}::uuid
            AND d.status::text IN ('AVAILABLE', 'PAID')
            AND EXISTS (
              SELECT 1 FROM guardian_relationships gr
              WHERE gr.tenant_id = l.tenant_id
                AND gr.campus_id = l.campus_id
                AND gr.student_id = l.student_id
                AND gr.guardian_user_id = ${context.actorId}::uuid
                AND gr.status::text = 'ACTIVE'
            )
          ORDER BY l.occurred_on DESC, l.created_at DESC, l.id
          LIMIT 200
        `;

        const entries = ledgerRows.map((row) => ({
          id: row.id,
          type: row.entryType,
          amountMinor: safeMinor(row.amountMinor)!,
          currency: "CNY" as const,
          period: row.period,
          occurredOn: dateOnly(row.occurredOn),
          documentId: row.documentId,
          documentVersion: row.documentVersion,
          studentAlias: row.studentAlias,
          studentLabel: row.studentLabel,
          synthetic: true as const,
        }));
        const totals = entries.reduce(
          (result, row) => {
            result[row.type as "CHARGE" | "PAYMENT" | "REFUND"] += row.amountMinor ?? 0;
            return result;
          },
          { CHARGE: 0, PAYMENT: 0, REFUND: 0 },
        );
        const documentsView = documents.map((row) => {
          const status = row.status;
          const available = status === "AVAILABLE" || status === "PAID";
          return {
            id: row.id,
            version: row.version,
            documentType: row.documentType,
            title: row.title,
            studentId: row.studentId,
            studentAlias: row.studentAlias,
            studentLabel: row.studentLabel,
            status,
            amount: available && row.amountMinor !== null ? safeMinor(row.amountMinor)! / 100 : null,
            currency: available ? (row.currency as "CNY") : null,
            period: row.period,
            sourceVersion: row.version,
            validFrom: dateOnly(row.validFrom),
            validTo: dateOnly(row.validTo),
            available,
            ...(available
              ? { summary: row.summary }
              : { unavailableReason: STATUS_REASONS[status] ?? "该资料当前不可查看。" }),
            synthetic: true as const,
          };
        });

        return {
          bindingApplications: bindings.map((row) => ({
            id: row.id,
            relationship: row.relationship,
            studentAlias: row.studentAlias,
            studentLabel: row.studentLabel,
            status: row.status,
          })),
          documents: documentsView,
          ledger: {
            scope: "parent" as const,
            synthetic: true as const,
            entries,
            reconciliation: {
              chargeMinor: totals.CHARGE,
              paymentMinor: totals.PAYMENT,
              refundMinor: totals.REFUND,
              balanceDueMinor: Math.max(totals.CHARGE - totals.PAYMENT + totals.REFUND, 0),
              currency: "CNY" as const,
            },
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  public async adminFees(context: FeesContext) {
    assertContext(context, "fees:manage");
    await this.actorMembership(context);
    const [students, documents] = await Promise.all([
      this.prisma.$queryRaw<{ id: string; label: string }[]>`
        SELECT id::text AS "id", display_ref AS "label"
        FROM students
        WHERE tenant_id = ${context.tenantId}::uuid
          AND campus_id = ${context.campusId}::uuid
          AND status = 'ACTIVE'
        ORDER BY display_ref, id
        LIMIT 200
      `,
      this.prisma.$queryRaw<RawDocument[]>`
        SELECT
          d.id::text AS "id",
          d.version AS "version",
          d.document_type::text AS "documentType",
          d.title AS "title",
          d.student_id::text AS "studentId",
          'student-' || substr(d.student_id::text, 1, 8) AS "studentAlias",
          s.display_ref AS "studentLabel",
          d.status::text AS "status",
          d.amount_minor AS "amountMinor",
          d.currency AS "currency",
          d.period AS "period",
          d.valid_from AS "validFrom",
          d.valid_to AS "validTo",
          d.summary AS "summary"
        FROM fee_documents d
        JOIN students s ON s.tenant_id = d.tenant_id AND s.campus_id = d.campus_id AND s.id = d.student_id
        WHERE d.tenant_id = ${context.tenantId}::uuid AND d.campus_id = ${context.campusId}::uuid
        ORDER BY d.created_at DESC, d.id
        LIMIT 200
      `,
    ]);

    return {
      synthetic: true as const,
      students,
      documents: documents.map((row) => ({
        id: row.id,
        version: row.version,
        documentType: row.documentType,
        title: row.title,
        studentId: row.studentId,
        studentLabel: row.studentLabel,
        period: row.period,
        amountMinor: safeMinor(row.amountMinor),
        status: row.status,
        validFrom: dateOnly(row.validFrom),
        validTo: dateOnly(row.validTo),
        summary: row.summary,
        synthetic: true as const,
      })),
    };
  }

  public async createFee(context: FeesContext, value: unknown) {
    assertContext(context, "fees:manage");
    const input = parseCreate(value);
    const actorMembershipId = await this.actorMembership(context);
    const id = randomUUID();
    const today = this.now().toISOString().slice(0, 10);

    return this.prisma.$transaction(async (tx) => {
      const student = await tx.$queryRaw<{ id: string; label: string }[]>`
        SELECT id::text AS "id", display_ref AS "label"
        FROM students
        WHERE tenant_id = ${context.tenantId}::uuid
          AND campus_id = ${context.campusId}::uuid
          AND id = ${input.studentId}::uuid
          AND status = 'ACTIVE'
        LIMIT 1
        FOR SHARE
      `;
      if (student.length !== 1) throw notFound();

      const rows = await tx.$queryRaw<RawDocument[]>`
        INSERT INTO fee_documents (
          tenant_id, campus_id, id, student_id, document_type, title, period,
          amount_minor, currency, valid_from, valid_to, status, summary,
          version, created_by_membership_id
        ) VALUES (
          ${context.tenantId}::uuid, ${context.campusId}::uuid, ${id}::uuid,
          ${input.studentId}::uuid, ${input.documentType}::fee_document_type,
          ${input.title}, ${input.period}, ${input.amountMinor}::bigint, 'CNY',
          ${input.validFrom}::date, ${input.validTo}::date, 'AVAILABLE'::fee_document_status,
          ${input.summary}, 1, ${actorMembershipId}::uuid
        )
        RETURNING
          id::text AS "id", version AS "version", document_type::text AS "documentType",
          title AS "title", student_id::text AS "studentId", ${aliasFor(input.studentId)}::text AS "studentAlias",
          ${student[0]!.label}::text AS "studentLabel", status::text AS "status",
          amount_minor AS "amountMinor", currency AS "currency", period AS "period",
          valid_from AS "validFrom", valid_to AS "validTo", summary AS "summary"
      `;
      const created = rows[0];
      if (!created) throw new Error("Fee document insert returned no row.");

      await tx.$executeRaw`
        INSERT INTO fee_document_audit_events (
          tenant_id, campus_id, document_id, actor_membership_id, action, document_version
        ) VALUES (
          ${context.tenantId}::uuid, ${context.campusId}::uuid, ${id}::uuid,
          ${actorMembershipId}::uuid, 'CREATED'::fee_document_audit_action, 1
        )
      `;

      if (input.amountMinor !== null && input.amountMinor > 0 && input.documentType !== "AGREEMENT") {
        await tx.$executeRaw`
          INSERT INTO fee_ledger_entries (
            tenant_id, campus_id, document_id, student_id, entry_type, amount_minor,
            currency, period, occurred_on, created_by_membership_id
          ) VALUES (
            ${context.tenantId}::uuid, ${context.campusId}::uuid, ${id}::uuid,
            ${input.studentId}::uuid, 'CHARGE'::fee_ledger_entry_type, ${input.amountMinor}::bigint,
            'CNY', ${input.period}, ${today}::date, ${actorMembershipId}::uuid
          )
        `;
      }

      return this.adminDocument(created);
    });
  }

  public async revokeFee(context: FeesContext, id: string, value: unknown) {
    assertContext(context, "fees:manage");
    if (!UUID.test(id)) throw invalid();
    const expectedVersion = parseExpectedVersion(value);
    const actorMembershipId = await this.actorMembership(context);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.$queryRaw<{ id: string; version: number; status: string }[]>`
        UPDATE fee_documents
        SET status = 'REVOKED'::fee_document_status, version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ${context.tenantId}::uuid
          AND campus_id = ${context.campusId}::uuid
          AND id = ${id.toLowerCase()}::uuid
          AND version = ${expectedVersion}
          AND status = 'AVAILABLE'::fee_document_status
        RETURNING id::text AS "id", version AS "version", status::text AS "status"
      `;
      const row = updated[0];
      if (!row) {
        const scoped = await tx.$queryRaw<{ id: string; version: number }[]>`
          SELECT id::text AS "id", version AS "version"
          FROM fee_documents
          WHERE tenant_id = ${context.tenantId}::uuid
            AND campus_id = ${context.campusId}::uuid
            AND id = ${id.toLowerCase()}::uuid
          LIMIT 1
        `;
        if (scoped.length === 0) throw notFound();
        throw conflict();
      }
      await tx.$executeRaw`
        INSERT INTO fee_document_audit_events (
          tenant_id, campus_id, document_id, actor_membership_id, action, document_version
        ) VALUES (
          ${context.tenantId}::uuid, ${context.campusId}::uuid, ${row.id}::uuid,
          ${actorMembershipId}::uuid, 'REVOKED'::fee_document_audit_action, ${row.version}
        )
      `;
      return { id: row.id, version: row.version, status: row.status, synthetic: true as const };
    });
  }

  private async actorMembership(context: FeesContext): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT m.id::text AS "id"
      FROM memberships m
      JOIN membership_campuses mc
        ON mc.tenant_id = m.tenant_id AND mc.membership_id = m.id
      WHERE m.tenant_id = ${context.tenantId}::uuid
        AND m.user_id = ${context.actorId}::uuid
        AND m.status = 'ACTIVE'::membership_status
        AND mc.campus_id = ${context.campusId}::uuid
      LIMIT 2
    `;
    if (rows.length !== 1) throw forbidden();
    return rows[0]!.id;
  }

  private adminDocument(row: RawDocument) {
    return {
      id: row.id,
      version: row.version,
      documentType: row.documentType,
      title: row.title,
      studentId: row.studentId,
      studentLabel: row.studentLabel,
      period: row.period,
      amountMinor: safeMinor(row.amountMinor),
      status: row.status,
      validFrom: dateOnly(row.validFrom),
      validTo: dateOnly(row.validTo),
      summary: row.summary,
      synthetic: true as const,
    };
  }
}
