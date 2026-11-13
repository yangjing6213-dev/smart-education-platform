import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaInstitutionService } from "../src/modules/institution/prisma-institution.service.js";
import type { ContentRecord } from "../src/modules/content/content.repository.js";
import type { ContentBody } from "@student-care/contracts";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const EAST_CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const WEST_CAMPUS_ID = "00000000-0000-4000-8000-000000000003";
const ACTOR_ID = "00000000-0000-4000-8000-000000000004";
const OTHER_TENANT_ID = "00000000-0000-4000-8000-000000000005";

type StoredRecord = ContentRecord;

interface StoredEvent {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string | null;
  readonly content_id: string;
  readonly content_key: string;
  readonly action: "PUBLISHED" | "UNPUBLISHED";
  readonly resulting_version: number;
  readonly actor_reference: string;
  readonly occurred_at: Date;
}

function actor(campusId?: string, tenantId = TENANT_ID) {
  return {
    trusted: true,
    actorId: ACTOR_ID,
    activeMembership: true,
    scope: { tenantId, ...(campusId === undefined ? {} : { campusId }) },
    capabilities: ["content:write", "content:publish"],
  } as const;
}

function profilePayload(visibility: "PUBLIC" | "STAFF" = "PUBLIC") {
  return {
    title: "合成机构介绍",
    type: "INSTITUTION" as const,
    visibility,
    body: {
      summary: "仅用于本地自动测试的合成机构内容。",
      blocks: [{ kind: "TEXT", text: "不对应真实机构。" }],
    } satisfies ContentBody,
    editor_note: "不得出现在访客投影中。",
    tenant_admin_note: "仅供内部合成测试。",
  };
}

function homePayload(title: string, visibility: "PUBLIC" | "STAFF" = "PUBLIC") {
  return {
    title,
    type: "HOME_BLOCK" as const,
    visibility,
    body: {
      summary: "仅用于本地自动测试的合成首页内容。",
      blocks: [{ kind: "TEXT", text: "虚构的首页说明。" }],
    } satisfies ContentBody,
  };
}

function createPrismaFixture() {
  const records = new Map<string, StoredRecord>();
  const events: StoredEvent[] = [];
  let inTransaction = false;
  let failNextEventWrite = false;

  const keyOf = (tenantId: string, campusId: string | null, contentKey: string) =>
    JSON.stringify([tenantId, campusId, contentKey]);
  const transaction = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(" ");
      if (!sql.includes('FROM "institution_content_records"')) {
        throw new Error(`Unexpected query: ${sql}`);
      }
      const tenantId = String(values[0]);
      const campusId = values[1] === null ? null : String(values[1]);
      const contentKey = sql.includes('"content_key" =') ? String(values[2]) : undefined;
      const typeValueIndex = contentKey === undefined ? 2 : -1;
      const type = typeValueIndex >= 0 ? String(values[typeValueIndex]) : undefined;
      const selected = [...records.values()].filter(
        (record) =>
          record.tenant_id === tenantId &&
          record.campus_id === campusId &&
          (contentKey === undefined || record.content_key === contentKey) &&
          (type === undefined ||
            (record.type === type &&
              record.status === "PUBLISHED" &&
              record.visibility === "PUBLIC" &&
              record.published_at !== null)),
      );
      return selected as unknown as readonly Record<string, unknown>[];
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      assert.equal(inTransaction, true, "content and publication writes use a transaction");
      const sql = strings.join(" ");
      if (sql.includes('INSERT INTO "institution_content_publication_events"')) {
        if (failNextEventWrite) {
          failNextEventWrite = false;
          throw Object.assign(new Error("synthetic event insert failed"), { code: "TEST_FAILURE" });
        }
        events.push({
          id: String(values[0]),
          tenant_id: String(values[1]),
          campus_id: values[2] === null ? null : String(values[2]),
          content_id: String(values[3]),
          content_key: String(values[4]),
          action: values[5] as StoredEvent["action"],
          resulting_version: Number(values[6]),
          actor_reference: String(values[7]),
          occurred_at: new Date(String(values[8])),
        });
        return 1;
      }

      if (sql.includes('UPDATE "institution_content_records"')) {
        const [
          type,
          status,
          title,
          version,
          visibility,
          body,
          publishedAt,
          editorNote,
          moderationState,
          tenantAdminNote,
          campusAdminNote,
          updatedBy,
          updatedAt,
          tenantId,
          campusId,
          id,
          expectedVersion,
        ] = values;
        const entry = [...records.entries()].find(
          ([, record]) =>
            record.tenant_id === String(tenantId) &&
            record.campus_id === (campusId === null ? null : String(campusId)) &&
            record.id === String(id),
        );
        if (entry === undefined || entry[1].version !== Number(expectedVersion)) return 0;
        const [storageKey, current] = entry;
        records.set(storageKey, {
          ...current,
          type: type as ContentRecord["type"],
          status: status as ContentRecord["status"],
          title: String(title),
          version: Number(version),
          visibility: visibility as ContentRecord["visibility"],
          body: JSON.parse(String(body)) as ContentBody,
          published_at: publishedAt === null ? null : new Date(String(publishedAt)).toISOString(),
          editor_note: String(editorNote),
          moderation_state: String(moderationState),
          tenant_admin_note: String(tenantAdminNote),
          campus_admin_note: String(campusAdminNote),
          updated_by: String(updatedBy),
          updated_at: new Date(String(updatedAt)).toISOString(),
        });
        return 1;
      }

      const record: StoredRecord = {
        id: String(values[0]),
        tenant_id: String(values[1]),
        campus_id: values[2] === null ? null : String(values[2]),
        content_key: String(values[3]),
        type: values[4] as ContentRecord["type"],
        status: values[5] as ContentRecord["status"],
        title: String(values[6]),
        version: Number(values[7]),
        visibility: values[8] as ContentRecord["visibility"],
        body: JSON.parse(String(values[9])) as ContentBody,
        published_at: values[10] === null ? null : new Date(String(values[10])).toISOString(),
        synthetic_data: true,
        editor_note: String(values[11]),
        moderation_state: String(values[12]),
        tenant_admin_note: String(values[13]),
        campus_admin_note: String(values[14]),
        updated_by: String(values[15]),
        updated_at: new Date(String(values[16])).toISOString(),
      };
      records.set(keyOf(record.tenant_id, record.campus_id, record.content_key), record);
      return 1;
    },
  };
  const prisma = {
    $transaction: async <T>(work: (tx: typeof transaction) => Promise<T>): Promise<T> => {
      const beforeRecords = new Map(records);
      const beforeEvents = events.length;
      inTransaction = true;
      try {
        return await work(transaction);
      } catch (error) {
        records.clear();
        for (const [key, value] of beforeRecords) records.set(key, value);
        events.splice(beforeEvents);
        throw error;
      } finally {
        inTransaction = false;
      }
    },
    $queryRaw: transaction.$queryRaw,
  } as unknown as PrismaClient;

  return {
    prisma,
    events,
    records,
    failNextEventWrite() {
      failNextEventWrite = true;
    },
  };
}

test("Prisma institution content survives service recreation and lists only public records", async () => {
  const fixture = createPrismaFixture();
  const first = new PrismaInstitutionService(fixture.prisma);
  const draft = await first.createInstitutionDraft(
    actor(),
    "institution-profile",
    profilePayload(),
  );
  assert.equal(draft.ok, true);
  const published = await first.publishInstitution(actor(), "institution-profile", 1);
  assert.equal(published.ok, true);
  assert.equal(fixture.events.length, 1);

  const recreated = new PrismaInstitutionService(fixture.prisma);
  const read = await recreated.readInstitutionPublicForVisitor(
    { tenantId: TENANT_ID },
    "institution-profile",
  );
  assert.equal(read.ok, true);
  if (!read.ok) return;
  assert.equal(read.data.title, "合成机构介绍");
  assert.equal("editor_note" in read.data, false);
  assert.equal("tenant_id" in read.data, false);
  assert.equal("updated_by" in read.data, false);

  const listed = await recreated.listInstitutionPublicForVisitor({ tenantId: TENANT_ID });
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0]?.content_key, "institution-profile");
});

test("draft updates require the current version and remain isolated by tenant", async () => {
  const fixture = createPrismaFixture();
  const service = new PrismaInstitutionService(fixture.prisma);
  const initial = await service.createInstitutionDraft(
    actor(),
    "shared-profile-key",
    profilePayload(),
  );
  const otherTenant = await service.createInstitutionDraft(
    actor(undefined, OTHER_TENANT_ID),
    "shared-profile-key",
    profilePayload(),
  );
  assert.equal(initial.ok, true);
  assert.equal(otherTenant.ok, true);

  const updated = await service.updateInstitutionDraft(
    actor(),
    "shared-profile-key",
    { ...profilePayload(), title: "更新后的合成机构介绍" },
    1,
  );
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.equal(updated.data.version, 2);
  assert.equal(updated.data.title, "更新后的合成机构介绍");

  const stale = await service.updateInstitutionDraft(
    actor(),
    "shared-profile-key",
    profilePayload(),
    1,
  );
  assert.equal(stale.ok, false);

  const east = await service.readInstitutionDraft(actor(), "shared-profile-key");
  const west = await service.readInstitutionDraft(
    actor(undefined, OTHER_TENANT_ID),
    "shared-profile-key",
  );
  assert.equal(east.ok, true);
  assert.equal(west.ok, true);
  if (!east.ok || !west.ok) return;
  assert.equal(east.data.title, "更新后的合成机构介绍");
  assert.equal(west.data.title, "合成机构介绍");
});

test("public home blocks stay within one tenant and campus and exclude staff or draft content", async () => {
  const fixture = createPrismaFixture();
  const service = new PrismaInstitutionService(fixture.prisma);
  assert.equal(
    (await service.createHomeDraft(actor(EAST_CAMPUS_ID), "east", homePayload("东校区合成内容")))
      .ok,
    true,
  );
  assert.equal((await service.publishHome(actor(EAST_CAMPUS_ID), "east", 1)).ok, true);
  assert.equal(
    (await service.createHomeDraft(actor(WEST_CAMPUS_ID), "west", homePayload("西校区合成内容")))
      .ok,
    true,
  );
  assert.equal((await service.publishHome(actor(WEST_CAMPUS_ID), "west", 1)).ok, true);
  assert.equal(
    (
      await service.createHomeDraft(
        actor(EAST_CAMPUS_ID),
        "staff-only",
        homePayload("内部内容", "STAFF"),
      )
    ).ok,
    true,
  );
  assert.equal((await service.publishHome(actor(EAST_CAMPUS_ID), "staff-only", 1)).ok, true);

  const east = await service.listHomePublicForVisitor({
    tenantId: TENANT_ID,
    campusId: EAST_CAMPUS_ID,
  });
  const west = await service.listHomePublicForVisitor({
    tenantId: TENANT_ID,
    campusId: WEST_CAMPUS_ID,
  });
  assert.equal(east.ok, true);
  assert.equal(west.ok, true);
  if (!east.ok || !west.ok) return;
  assert.deepEqual(
    east.data.map((record) => record.content_key),
    ["east"],
  );
  assert.deepEqual(
    west.data.map((record) => record.content_key),
    ["west"],
  );

  const stale = await service.unpublishHome(actor(EAST_CAMPUS_ID), "east", 1);
  assert.equal(stale.ok, false);
  assert.equal(fixture.events.filter((event) => event.content_key === "east").length, 1);
});

test("publication event failure rolls back persisted content state", async () => {
  const fixture = createPrismaFixture();
  const service = new PrismaInstitutionService(fixture.prisma);
  assert.equal(
    (await service.createInstitutionDraft(actor(), "profile", profilePayload())).ok,
    true,
  );
  fixture.failNextEventWrite();

  await assert.rejects(
    service.publishInstitution(actor(), "profile", 1),
    /synthetic event insert failed/,
  );
  const read = await service.readInstitutionDraft(actor(), "profile");
  assert.equal(read.ok, true);
  if (!read.ok) return;
  assert.equal(read.data.status, "DRAFT");
  assert.equal(read.data.version, 1);
  assert.equal(fixture.events.length, 0);
});
