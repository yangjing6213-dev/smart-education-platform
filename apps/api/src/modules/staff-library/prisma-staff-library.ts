import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import {
  LibraryError,
  type LibraryContext,
  type LibraryCreate,
  type LibraryKind,
  type LibraryUpdate,
  type StaffLibraryOperations,
} from "./operations.js";

type Tx = Prisma.TransactionClient;
type Access = {
  membershipId: string;
  classIds: string[];
  where: Prisma.StaffLibraryItemWhereInput;
};
const fields = {
  id: true,
  kind: true,
  title: true,
  summary: true,
  category: true,
  grade: true,
  subject: true,
  tags: true,
  scope: true,
  expiresOn: true,
  version: true,
} as const;
const shanghaiDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function today() {
  return new Date(shanghaiDate.format(new Date()) + "T00:00:00Z");
}
function staffFields(membershipId: string) {
  return {
    ...fields,
    activities: { where: { membershipId }, select: { favorite: true, lastUsedAt: true } },
  };
}
function personal<
  T extends { expiresOn: Date; activities: { favorite: boolean; lastUsedAt: Date | null }[] },
>(row: T) {
  const { activities, expiresOn, ...item } = row;
  return {
    ...item,
    expiresOn: expiresOn.toISOString().slice(0, 10),
    favorite: activities[0]?.favorite ?? false,
    lastUsedAt: activities[0]?.lastUsedAt?.toISOString() ?? null,
  };
}
function published(access: Access, kind: LibraryKind): Prisma.StaffLibraryItemWhereInput {
  return { ...access.where, kind, status: "PUBLISHED", expiresOn: { gte: today() } };
}
function assertClass(input: LibraryUpdate | LibraryCreate, access: Access) {
  if (
    input.scope === "CLASS"
      ? !input.classId || !access.classIds.includes(input.classId)
      : input.classId !== null
  )
    throw new LibraryError(403, "FORBIDDEN_SCOPE");
}

export class PrismaStaffLibraryOperations implements StaffLibraryOperations {
  constructor(private readonly db: PrismaClient) {}

  private within<T>(
    ctx: LibraryContext,
    capability: string,
    run: (tx: Tx, access: Access) => Promise<T>,
  ) {
    if (!ctx.capabilities.includes(capability))
      return Promise.reject(new LibraryError(403, "FORBIDDEN_SCOPE"));
    return this.db
      .$transaction(
        async (tx) => {
          const memberships = await tx.$queryRaw<{ id: string }[]>`
        SELECT m.id FROM memberships m JOIN membership_campuses mc
          ON (mc.tenant_id,mc.membership_id)=(m.tenant_id,m.id)
        JOIN users u ON u.id=m.user_id JOIN tenants t ON t.id=m.tenant_id
        JOIN campuses c ON (c.tenant_id,c.id)=(mc.tenant_id,mc.campus_id)
        WHERE m.tenant_id=${ctx.tenantId}::uuid AND mc.campus_id=${ctx.campusId}::uuid
          AND m.user_id=${ctx.actorId}::uuid AND m.status='ACTIVE' AND u.status='ACTIVE' AND t.status='ACTIVE' AND c.status='ACTIVE'
        LIMIT 2`;
          if (memberships.length !== 1) throw new LibraryError(403, "FORBIDDEN_SCOPE");
          const membershipId = memberships[0]!.id;
          const assignments = await tx.$queryRaw<
            { class_ref: string }[]
          >`SELECT class_ref FROM membership_classes
        WHERE tenant_id=${ctx.tenantId}::uuid AND campus_id=${ctx.campusId}::uuid AND membership_id=${membershipId}::uuid
        ORDER BY class_ref`;
          const classIds = assignments.map((row) => row.class_ref);
          return run(tx, {
            membershipId,
            classIds,
            where: {
              tenantId: ctx.tenantId,
              campusId: ctx.campusId,
              OR: [{ scope: "CAMPUS" }, { scope: "CLASS", classId: { in: classIds } }],
            },
          });
        },
        { isolationLevel: "Serializable" },
      )
      .catch((error: unknown) => {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2034"
        )
          throw new LibraryError(409, "CONFLICT_STATE");
        throw error;
      });
  }

  list(ctx: LibraryContext, kind: LibraryKind) {
    return this.within(ctx, "library:read", async (tx, access) => {
      const rows = await tx.staffLibraryItem.findMany({
        where: published(access, kind),
        select: staffFields(access.membershipId),
        orderBy: [{ title: "asc" }, { id: "asc" }],
      });
      return { items: rows.map(personal) };
    });
  }
  detail(ctx: LibraryContext, kind: LibraryKind, id: string) {
    return this.within(ctx, "library:read", async (tx, access) => {
      const item = await tx.staffLibraryItem.findFirst({
        where: { ...published(access, kind), id },
        select: { ...staffFields(access.membershipId), body: true },
      });
      if (!item) throw new LibraryError(404, "NOT_FOUND_SCOPED");
      return personal(item);
    });
  }
  private activity(
    ctx: LibraryContext,
    id: string,
    version: number,
    change: { favorite: boolean } | { lastUsedAt: Date },
  ) {
    return this.within(ctx, "library:read", async (tx, access) => {
      const item = await tx.staffLibraryItem.findFirst({
        where: { ...published(access, "RESOURCE"), id },
        select: { id: true, version: true },
      });
      if (!item) throw new LibraryError(404, "NOT_FOUND_SCOPED");
      if (item.version !== version) throw new LibraryError(409, "VERSION_MISMATCH");
      // Hold a shared lock while checking the version and recording activity so revocation cannot interleave.
      await tx.$queryRaw`SELECT id FROM staff_library_items WHERE tenant_id=${ctx.tenantId}::uuid AND campus_id=${ctx.campusId}::uuid AND id=${id}::uuid FOR SHARE`;
      const key = {
        tenantId: ctx.tenantId,
        campusId: ctx.campusId,
        itemId: id,
        membershipId: access.membershipId,
      };
      await tx.staffLibraryActivity.upsert({
        where: { tenantId_campusId_itemId_membershipId: key },
        create: { ...key, ...change },
        update: change,
      });
      return item;
    });
  }
  favorite(ctx: LibraryContext, id: string, version: number, favorite: boolean) {
    return this.activity(ctx, id, version, { favorite });
  }
  use(ctx: LibraryContext, id: string, version: number) {
    return this.activity(ctx, id, version, { lastUsedAt: new Date() });
  }

  managed(ctx: LibraryContext) {
    return this.within(ctx, "library:manage", async (tx, access) => {
      const rows = await tx.staffLibraryItem.findMany({
        where: access.where,
        orderBy: [{ title: "asc" }, { id: "asc" }],
        select: { ...fields, status: true, classId: true },
      });
      return {
        classIds: access.classIds,
        items: rows.map((row) => ({ ...row, expiresOn: row.expiresOn.toISOString().slice(0, 10) })),
      };
    });
  }
  create(ctx: LibraryContext, input: LibraryCreate) {
    return this.within(ctx, "library:manage", async (tx, access) => {
      assertClass(input, access);
      return tx.staffLibraryItem.create({
        data: {
          ...input,
          tenantId: ctx.tenantId,
          campusId: ctx.campusId,
          expiresOn: new Date(input.expiresOn + "T00:00:00Z"),
        },
        select: { id: true, version: true },
      });
    });
  }
  private revise(ctx: LibraryContext, id: string, version: number, input?: LibraryUpdate) {
    return this.within(ctx, "library:manage", async (tx, access) => {
      if (input) assertClass(input, access);
      const where = { ...access.where, id };
      const current = await tx.staffLibraryItem.findFirst({
        where,
        select: { version: true, status: true },
      });
      if (!current) throw new LibraryError(404, "NOT_FOUND_SCOPED");
      if (current.version !== version) throw new LibraryError(409, "VERSION_MISMATCH");
      if (current.status !== "PUBLISHED") throw new LibraryError(409, "CONFLICT_STATE");
      const data = input
        ? {
            scope: input.scope,
            classId: input.classId,
            expiresOn: new Date(input.expiresOn + "T00:00:00Z"),
          }
        : { status: "REVOKED" };
      const updated = await tx.staffLibraryItem.updateMany({
        where: { ...where, version, status: "PUBLISHED" },
        data: { ...data, version: { increment: 1 } },
      });
      if (!updated.count) throw new LibraryError(409, "VERSION_MISMATCH");
      return { id, version: version + 1 };
    });
  }
  update(ctx: LibraryContext, id: string, input: LibraryUpdate) {
    return this.revise(ctx, id, input.version, input);
  }
  revoke(ctx: LibraryContext, id: string, version: number) {
    return this.revise(ctx, id, version);
  }

  summary(ctx: LibraryContext) {
    return this.within(ctx, "library:summary", async (tx) => {
      const [row] = await tx.$queryRaw<
        { total: number; published: number; revoked: number; expired: number }[]
      >`
        SELECT count(*)::int AS total,
        count(*) FILTER(WHERE status='PUBLISHED' AND expires_on >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date)::int AS published,
        count(*) FILTER(WHERE status='REVOKED')::int AS revoked,
        count(*) FILTER(WHERE status='PUBLISHED' AND expires_on < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date)::int AS expired
        FROM staff_library_items WHERE tenant_id=${ctx.tenantId}::uuid AND campus_id=${ctx.campusId}::uuid`;
      return row!;
    });
  }
}
