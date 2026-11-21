import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { resolveAuthContext } from "@student-care/auth";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import { validTaskDate } from "../modules/tasks/staff-task-actions.js";
import {
  LibraryError,
  type LibraryContext,
  type LibraryCreate,
  type LibraryKind,
  type LibraryUpdate,
  type StaffLibraryOperations,
} from "../modules/staff-library/operations.js";
import {
  STAFF_LIBRARY_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type Capability = "library:read" | "library:manage" | "library:summary";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function invalid(): never {
  throw new LibraryError(400, "VALIDATION_FAILED");
}

function itemId(value: string): string {
  if (!UUID.test(value)) invalid();
  return value;
}

function kind(path: string): LibraryKind {
  if (path === "resources") return "RESOURCE";
  if (path === "guides") return "GUIDE";
  throw new LibraryError(404, "NOT_FOUND_SCOPED");
}

function fields(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) invalid();
  if (Object.keys(body).length !== keys.length || !keys.every((key) => Object.hasOwn(body, key)))
    invalid();
  return body as Record<string, unknown>;
}

function version(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) invalid();
  return value;
}

function text(value: unknown, limit: number, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > limit) invalid();
  const trimmed = value.trim();
  if ((!allowEmpty && !trimmed) || /(?:https?:\/\/|www\.|javascript:|data:)/iu.test(trimmed))
    invalid();
  return trimmed;
}

function visibility(
  data: Record<string, unknown>,
): Pick<LibraryCreate, "scope" | "classId" | "expiresOn"> {
  const { scope, classId, expiresOn } = data;
  if (!validTaskDate(expiresOn) || (scope !== "CAMPUS" && scope !== "CLASS")) invalid();
  if (scope === "CAMPUS") {
    if (classId !== null) invalid();
    return { scope, classId: null, expiresOn };
  }
  return { scope, classId: text(classId, 80), expiresOn };
}

function createInput(body: unknown): LibraryCreate {
  const data = fields(body, [
    "kind",
    "title",
    "summary",
    "body",
    "category",
    "grade",
    "subject",
    "tags",
    "scope",
    "classId",
    "expiresOn",
  ]);
  if (data.kind !== "RESOURCE" && data.kind !== "GUIDE") invalid();
  if (!Array.isArray(data.tags) || data.tags.length > 12) invalid();
  const tags = data.tags.map((tag: unknown) => text(tag, 80));
  if (new Set(tags).size !== tags.length) invalid();
  return {
    kind: data.kind,
    title: text(data.title, 120),
    summary: text(data.summary, 500),
    body: text(data.body, 8000),
    category: text(data.category, 80),
    grade: text(data.grade, 80, true),
    subject: text(data.subject, 80, true),
    tags,
    ...visibility(data),
  };
}

function updateInput(body: unknown): LibraryUpdate {
  const data = fields(body, ["version", "scope", "classId", "expiresOn"]);
  return { version: version(data.version), ...visibility(data) };
}

function failure(status: number, code: string, requestId: string): HttpException {
  return new HttpException(
    {
      error: {
        code,
        message: status === 401 ? "Authentication is required." : "Request could not be completed.",
      },
      request_id: requestId,
    },
    status,
  );
}

@Controller()
export class StaffLibraryController {
  public constructor(
    @Inject(STAFF_LIBRARY_OPERATIONS) private readonly operations: StaffLibraryOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly trusted: TrustedAuthProvider,
  ) {}

  private async run(
    request: ApiHttpRequest,
    capability: Capability,
    action: (context: LibraryContext) => Promise<unknown>,
  ) {
    const requestId = randomUUID();
    if (containsForgedIdentityClaim(request.query, request.headers))
      throw failure(401, "UNAUTHENTICATED", requestId);
    const auth = resolveAuthContext(await this.trusted(request));
    if (!auth.ok) throw failure(401, "UNAUTHENTICATED", requestId);
    if (
      Object.keys(request.query).length ||
      request.headers["x-tenant-id"] !== undefined ||
      request.headers["x-campus-id"] !== undefined
    )
      throw failure(400, "VALIDATION_FAILED", requestId);
    const eligible = auth.context.memberships.filter(
      (member) => member.status === "ACTIVE" && member.capabilities.includes(capability),
    );
    const membership = eligible[0];
    if (eligible.length !== 1 || !membership || membership.campus_ids.length !== 1)
      throw failure(403, "FORBIDDEN_SCOPE", requestId);
    const context = {
      actorId: auth.context.identity.actor_id,
      tenantId: membership.tenant_id,
      campusId: membership.campus_ids[0]!,
      capabilities: membership.capabilities,
    };
    try {
      return { data: await action(context), request_id: requestId };
    } catch (cause) {
      if (cause instanceof LibraryError) throw failure(cause.status, cause.code, requestId);
      throw failure(500, "INTERNAL_ERROR", requestId);
    }
  }

  @Get("staff/library/:kind")
  public list(@Req() req: ApiHttpRequest, @Param("kind") group: string) {
    return this.run(req, "library:read", (ctx) => this.operations.list(ctx, kind(group)));
  }

  @Get("staff/library/:kind/:id")
  public detail(@Req() req: ApiHttpRequest, @Param("kind") group: string, @Param("id") id: string) {
    return this.run(req, "library:read", (ctx) =>
      this.operations.detail(ctx, kind(group), itemId(id)),
    );
  }

  @Post("staff/library/resources/:id/favorite")
  @HttpCode(200)
  public favorite(@Req() req: ApiHttpRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.run(req, "library:read", (ctx) => {
      const data = fields(body, ["version", "favorite"]);
      if (typeof data.favorite !== "boolean") invalid();
      return this.operations.favorite(ctx, itemId(id), version(data.version), data.favorite);
    });
  }

  @Post("staff/library/resources/:id/use")
  @HttpCode(200)
  public use(@Req() req: ApiHttpRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.run(req, "library:read", (ctx) =>
      this.operations.use(ctx, itemId(id), version(fields(body, ["version"]).version)),
    );
  }

  @Get("admin/library/items")
  public managed(@Req() req: ApiHttpRequest) {
    return this.run(req, "library:manage", (ctx) => this.operations.managed(ctx));
  }

  @Post("admin/library/items")
  @HttpCode(200)
  public create(@Req() req: ApiHttpRequest, @Body() body: unknown) {
    return this.run(req, "library:manage", (ctx) => this.operations.create(ctx, createInput(body)));
  }

  @Patch("admin/library/items/:id")
  public update(@Req() req: ApiHttpRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.run(req, "library:manage", (ctx) =>
      this.operations.update(ctx, itemId(id), updateInput(body)),
    );
  }

  @Post("admin/library/items/:id/revoke")
  @HttpCode(200)
  public revoke(@Req() req: ApiHttpRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.run(req, "library:manage", (ctx) =>
      this.operations.revoke(ctx, itemId(id), version(fields(body, ["version"]).version)),
    );
  }

  @Get("admin/library/summary")
  public summary(@Req() req: ApiHttpRequest) {
    return this.run(req, "library:summary", (ctx) => this.operations.summary(ctx));
  }
}
