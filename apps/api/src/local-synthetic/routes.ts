import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ApiHttpRequest, InviteAuthOperations } from "../nest/api-tokens.js";
import { BindingLeaveService, exactBody, LocalError } from "./binding-leave.service.js";
import { LocalSessions, memberForActor, studentOptions, type LocalMember } from "./sessions.js";
import { CareRecordService } from "./care-record.service.js";
import { AttendanceService } from "./attendance.service.js";
import { PickupService } from "./pickup.service.js";
import { FeesService } from "./fees.service.js";
import { NoticeService } from "./notice.service.js";
import { HealthIncidentService } from "./health-incident.service.js";
import { StaffDailyService } from "./staff-daily.service.js";
import { MonthlyFeedbackService } from "./monthly-feedback.service.js";
import { SupplyRequestService } from "./supply-request.service.js";
import { StaffTaskService } from "./task-assignment.service.js";
import { ResourceLibraryService } from "./resource-library.service.js";
import { OperationalStatisticsService } from "./operational-statistics.service.js";
import { LearningSessionService } from "./learning-session.service.js";
import { StaffCredentialsService } from "./staff-credentials.service.js";
import { MediaAssetsService } from "./media-assets.service.js";
import { PrivacyRequestService } from "./privacy-requests.service.js";
import { ConsentService } from "./consent.service.js";
import {
  MealService,
  type MealActorContext,
  type MealDraftPayload,
  type MealResult,
} from "../modules/meals/meal.service.js";
import type { ResourceLibraryFilter, ResourceLibraryUpdate } from "./repository.js";
import type { OperationalStatisticsFilter } from "@student-care/contracts";

function actor(request: FastifyRequest): LocalMember {
  const id = request.authContext?.identity.actor_id;
  const member = id ? memberForActor(id) : undefined;
  if (
    !member ||
    request.scopeContext?.actorId !== member.actorId ||
    request.scopeContext.tenantId !== member.tenantId ||
    request.scopeContext.campusId !== member.campusId
  )
    throw new LocalError(403, "UNAVAILABLE");
  return member;
}

export function registerLocalRoutes(
  app: FastifyInstance,
  sessions: LocalSessions,
  service: BindingLeaveService,
  care: CareRecordService,
  attendance: AttendanceService,
  pickup: PickupService,
  fees: FeesService,
  notice: NoticeService,
  health: HealthIncidentService,
  daily: StaffDailyService,
  feedback: MonthlyFeedbackService,
  supply: SupplyRequestService,
  tasks: StaffTaskService,
  resources: ResourceLibraryService,
  statistics: OperationalStatisticsService,
  learning: LearningSessionService,
  staffCredentials: StaffCredentialsService,
  mediaAssets: MediaAssetsService,
  privacyRequests: PrivacyRequestService,
  consents: ConsentService,
  meals: MealService,
  inviteAuthService?: InviteAuthOperations,
) {
  app.post("/local/login", async (request, reply) => {
    if (!inviteAuthService)
      return reply.code(503).send({ error: { code: "AUTH_NOT_CONFIGURED" } });
    const query: unknown = request.query;
    if (
      typeof query !== "object" ||
      query === null ||
      Array.isArray(query) ||
      Object.keys(query).length > 0
    )
      return reply.code(400).send({ error: { code: "INVALID_REQUEST" } });
    const { username, password } = exactBody(request.body, ["username", "password"]);
    if (
      typeof username !== "string" ||
      username.length < 3 ||
      username.length > 64 ||
      typeof password !== "string" ||
      password.length < 1 ||
      password.length > 128
    )
      return reply.code(400).send({ error: { code: "INVALID_REQUEST" } });

    const login = await inviteAuthService.login(username, password);
    if (!login.ok) {
      const notConfigured = login.reason === "AUTH_NOT_CONFIGURED";
      return reply
        .code(notConfigured ? 503 : 401)
        .send({ error: { code: notConfigured ? "AUTH_NOT_CONFIGURED" : "UNAUTHENTICATED" } });
    }

    const temporaryRequest: ApiHttpRequest = {
      query: {},
      params: {},
      headers: { authorization: `Bearer ${login.access_token}` },
    };
    let trusted;
    try {
      trusted = await inviteAuthService.getTrustedAuthResult(temporaryRequest);
    } finally {
      inviteAuthService.logout(temporaryRequest);
    }
    const session = sessions.createForTrustedAuth(trusted);
    if (!session) return reply.code(401).send({ error: { code: "UNAUTHENTICATED" } });
    return reply.code(201).send(session);
  });

  app.get("/local/profiles", async (_request, reply) => {
    if (inviteAuthService) return reply.code(404).send({ error: { code: "UNAVAILABLE" } });
    return { mode: "local-synthetic", profiles: sessions.listProfiles() };
  });
  app.post("/local/sessions", async (request, reply) => {
    if (inviteAuthService) return reply.code(404).send({ error: { code: "UNAVAILABLE" } });
    const { profile } = exactBody(request.body, ["profile"]);
    const status = typeof profile === "string" ? sessions.statusForProfile(profile) : undefined;
    if (status && status !== "ACTIVE") throw new LocalError(403, "UNAVAILABLE");
    const session = typeof profile === "string" ? sessions.create(profile) : undefined;
    if (!session) throw new LocalError(400, "INVALID_REQUEST");
    return reply.code(201).send(session);
  });
  const config = { authRequired: true, scopeRequired: true };
  let localMealSequence = 0;
  const mealContext = (request: FastifyRequest): MealActorContext => {
    const member = actor(request);
    return {
      trusted: true,
      actorId: member.actorId,
      activeMembership: true,
      scope: { tenantId: member.tenantId, campusId: member.campusId },
      capabilities: member.actions,
    };
  };
  const mealData = <T>(result: MealResult<T>): T => {
    if (result.ok) return result.data;
    const status =
      result.error.code === "VALIDATION_FAILED"
        ? 400
        : result.error.code === "VERSION_MISMATCH" || result.error.code === "CONFLICT_STATE"
          ? 409
          : 403;
    throw new LocalError(status, result.error.code);
  };
  app.get("/local/meals", { config }, async (request) =>
    mealData(meals.listAdmin(mealContext(request))),
  );
  app.post("/local/meals", { config }, async (request, reply) => {
    const body = exactBody(request.body, ["meal_date", "meal_type", "items", "notes"]);
    const payload = body as unknown as MealDraftPayload;
    localMealSequence += 1;
    const result = mealData(
      meals.createDraft(mealContext(request), `meal-local-${localMealSequence}`, payload),
    );
    return reply.code(201).send(result);
  });
  app.put("/local/meals/:mealId/draft", { config }, async (request) => {
    const body = exactBody(request.body, ["payload", "expected_version"]);
    if (
      !Number.isSafeInteger(body.expected_version) ||
      typeof body.payload !== "object" ||
      body.payload === null ||
      Array.isArray(body.payload)
    )
      throw new LocalError(400, "INVALID_REQUEST");
    return mealData(
      meals.updateDraft(
        mealContext(request),
        (request.params as { mealId: string }).mealId,
        body.payload as MealDraftPayload,
        body.expected_version as number,
      ),
    );
  });
  for (const action of ["publish", "unpublish"] as const) {
    app.post(`/local/meals/:mealId/${action}`, { config }, async (request) => {
      const body = exactBody(request.body, ["expected_version"]);
      if (!Number.isSafeInteger(body.expected_version))
        throw new LocalError(400, "INVALID_REQUEST");
      const context = mealContext(request);
      const mealId = (request.params as { mealId: string }).mealId;
      const result =
        action === "publish"
          ? meals.publish(context, mealId, body.expected_version as number)
          : meals.unpublish(context, mealId, body.expected_version as number);
      return mealData(result);
    });
  }
  app.get(
    "/local/public-meals",
    { config: { authRequired: false, scopeRequired: false } },
    async (request) => {
      const date = (request.query as Record<string, unknown>).date;
      if (typeof date !== "string") throw new LocalError(400, "INVALID_REQUEST");
      return mealData(
        meals.listPublic(
          {
            tenantId: "00000000-0000-4000-8000-000000000064",
            campusId: "00000000-0000-4000-8000-000000000065",
          },
          date,
        ),
      );
    },
  );
  const membershipReadConfig = {
    ...config,
    capabilityRequired: "memberships:read" as const,
  };
  const membershipManageConfig = {
    ...config,
    capabilityRequired: "memberships:read" as const,
  };
  app.get("/local/consent-policies", { config }, async (request) =>
    consents.policies(actor(request)),
  );
  app.get("/local/consents", { config }, async (request) => consents.list(actor(request)));
  app.post("/local/consents", { config }, async (request, reply) =>
    reply.code(201).send(consents.create(actor(request), request.body)),
  );
  app.post("/local/consents/:id/revoke", { config }, async (request) =>
    consents.revoke(actor(request), (request.params as { id: string }).id, request.body),
  );
  app.post("/local/consents/:id/retention-review", { config }, async (request) =>
    consents.reviewRetention(actor(request), (request.params as { id: string }).id, request.body),
  );
  app.get("/local/privacy-requests", { config }, async (request) =>
    privacyRequests.list(actor(request)),
  );
  app.post("/local/privacy-requests", { config }, async (request, reply) =>
    reply.code(201).send(privacyRequests.create(actor(request), request.body)),
  );
  app.post("/local/privacy-requests/:id/review", { config }, async (request) =>
    privacyRequests.review(actor(request), (request.params as { id: string }).id, request.body),
  );
  app.post("/local/privacy-requests/:id/withdraw", { config }, async (request) =>
    privacyRequests.withdraw(actor(request), (request.params as { id: string }).id, request.body),
  );
  app.get("/local/session", { config }, async (request) => {
    const member = actor(request);
    return {
      mode: "local-synthetic",
      profile: member.profile,
      label: member.label,
      actorId: member.actorId,
      tenantId: member.tenantId,
      campusId: member.campusId,
      classIds: member.classIds,
      actions: member.actions,
    };
  });
  app.post("/local/session/end", { config }, async (request) => {
    exactBody(request.body, []);
    sessions.end(request.headers.authorization);
    return { ended: true };
  });

  app.get("/local/media-assets", { config }, async (request) => mediaAssets.list(actor(request)));
  app.get("/local/media-asset-events", { config }, async (request) =>
    mediaAssets.events(actor(request)),
  );
  app.get("/local/media-asset-summary", { config }, async (request) =>
    mediaAssets.summary(actor(request)),
  );
  app.post("/local/media-assets/:id/access-check", { config }, async (request) => {
    const { version } = exactBody(request.body, ["version"]);
    return mediaAssets.accessCheck(actor(request), (request.params as { id: string }).id, {
      version: version as number,
    });
  });
  app.post("/local/media-assets/:id/replace-reference", { config }, async (request) => {
    const { version, referenceId, targetAssetId, targetVersion } = exactBody(request.body, [
      "version",
      "referenceId",
      "targetAssetId",
      "targetVersion",
    ]);
    return mediaAssets.replaceReference(actor(request), (request.params as { id: string }).id, {
      version: version as number,
      referenceId: referenceId as string,
      targetAssetId: targetAssetId as string,
      targetVersion: targetVersion as number,
    });
  });
  app.post("/local/media-assets/:id/archive", { config }, async (request) => {
    const { version } = exactBody(request.body, ["version"]);
    return mediaAssets.archive(actor(request), (request.params as { id: string }).id, {
      version: version as number,
    });
  });
  app.post("/local/media-assets/:id/revoke", { config }, async (request) => {
    const { version, confirmReferences } = exactBody(request.body, [
      "version",
      "confirmReferences",
    ]);
    return mediaAssets.revoke(actor(request), (request.params as { id: string }).id, {
      version: version as number,
      confirmReferences: confirmReferences as boolean,
    });
  });
  app.post("/local/media-assets/:id/delete", { config }, async (request) => {
    const { version } = exactBody(request.body, ["version"]);
    return mediaAssets.softDelete(actor(request), (request.params as { id: string }).id, {
      version: version as number,
    });
  });

  app.get("/local/memberships", { config: membershipReadConfig }, async (request) => {
    const memberships = sessions.membershipsFor(actor(request));
    if (!memberships) throw new LocalError(403, "UNAVAILABLE");
    return memberships;
  });
  app.get("/local/membership-events", { config: membershipReadConfig }, async (request) => {
    const events = sessions.membershipEventsFor(actor(request));
    if (!events) throw new LocalError(403, "UNAVAILABLE");
    return events;
  });
  app.patch("/local/memberships/:id", { config: membershipManageConfig }, async (request) => {
    const { status, version } = exactBody(request.body, ["status", "version"]);
    if (
      (status !== "ACTIVE" && status !== "SUSPENDED" && status !== "REVOKED") ||
      typeof version !== "number" ||
      !Number.isSafeInteger(version) ||
      version < 1
    )
      throw new LocalError(400, "INVALID_REQUEST");
    const membership = sessions.changeMembershipStatus(
      actor(request),
      (request.params as { id: string }).id,
      status,
      version,
    );
    if (membership === "CONFLICT") throw new LocalError(409, "CONFLICT");
    if (!membership) throw new LocalError(403, "UNAVAILABLE");
    return membership;
  });

  app.get("/local/staff-credentials", { config: membershipManageConfig }, async (request) =>
    staffCredentials.list(actor(request)),
  );
  app.post("/local/staff-credentials", { config: membershipManageConfig }, async (request, reply) =>
    reply.code(201).send(staffCredentials.create(actor(request), request.body)),
  );
  app.patch("/local/staff-credentials/:id", { config: membershipManageConfig }, async (request) =>
    staffCredentials.update(actor(request), (request.params as { id: string }).id, request.body),
  );

  function get(path: string, read: (member: LocalMember, id: string) => unknown) {
    app.get(path, { config }, async (request) =>
      read(actor(request), (request.params as { id?: string }).id ?? ""),
    );
  }
  function command(
    method: "POST" | "PATCH",
    path: string,
    action: string,
    run: (member: LocalMember, id: string, body: unknown) => unknown,
    created = false,
  ) {
    app.route({
      method,
      url: path,
      config,
      handler: async (request, reply) => {
        const member = actor(request),
          id = (request.params as { id?: string }).id ?? "";
        try {
          return reply.code(created ? 201 : 200).send(run(member, id, request.body));
        } catch (error) {
          if (error instanceof LocalError) service.denied(member, action, id);
          throw error;
        }
      },
    });
  }

  get("/local/student-options", studentOptions);
  get("/local/binding-applications", (member) => service.bindings(member));
  get("/local/binding-applications/:id", (member, id) => service.binding(member, id));
  command(
    "POST",
    "/local/binding-applications",
    "binding.apply",
    (m, _id, body) => service.applyBinding(m, body),
    true,
  );
  command("POST", "/local/binding-applications/:id/review", "binding.review", (m, id, body) =>
    service.reviewBinding(m, id, body),
  );
  command("POST", "/local/binding-applications/:id/withdraw", "binding.withdraw", (m, id, body) =>
    service.endBinding(m, id, body, "withdraw"),
  );
  command("POST", "/local/binding-applications/:id/release", "binding.release", (m, id, body) =>
    service.endBinding(m, id, body, "release"),
  );
  get("/local/leave-requests", (member) => service.leaves(member));
  get("/local/leave-requests/:id", (member, id) => service.leave(member, id));
  command(
    "POST",
    "/local/leave-requests",
    "leave.apply",
    (m, _id, body) => service.applyLeave(m, body),
    true,
  );
  command("PATCH", "/local/leave-requests/:id", "leave.resubmit", (m, id, body) =>
    service.resubmitLeave(m, id, body),
  );
  command("POST", "/local/leave-requests/:id/review", "leave.review", (m, id, body) =>
    service.reviewLeave(m, id, body),
  );
  command("POST", "/local/leave-requests/review-batch", "leave.review-batch", (m, _id, body) =>
    service.reviewBatch(m, body),
  );
  command("POST", "/local/leave-requests/:id/withdraw", "leave.withdraw", (m, id, body) =>
    service.withdrawLeave(m, id, body),
  );
  command("POST", "/local/leave-requests/:id/receipt", "leave.acknowledge", (m, id, body) =>
    service.acknowledge(m, id, body),
  );
  get("/local/audit", (member) => service.audits(member));
  get("/local/care-records", (member) => care.list(member));
  get("/local/care-records/:id", (member, id) => care.get(member, id));
  command(
    "POST",
    "/local/care-records",
    "care.create",
    (m, _id, body) => care.create(m, body),
    true,
  );
  command("PATCH", "/local/care-records/:id", "care.edit", (m, id, body) => care.edit(m, id, body));
  command("POST", "/local/care-records/:id/review", "care.review", (m, id, body) =>
    care.review(m, id, body),
  );
  command("POST", "/local/care-records/review-batch", "care.review-batch", (m, _id, body) =>
    care.reviewBatch(m, body),
  );
  for (const action of [
    "submit",
    "withdraw",
    "resubmit",
    "publish",
    "revoke-publication",
  ] as const) {
    command("POST", `/local/care-records/:id/${action}`, `care.${action}`, (m, id, body) =>
      care.transition(m, id, body, action),
    );
  }
  command("POST", "/local/care-records/:id/receipt", "care.receipt", (m, id, body) =>
    care.receipt(m, id, body),
  );
  get("/local/attendance-records", (member) => attendance.list(member));
  get("/local/attendance-records/:id", (member, id) => attendance.get(member, id));
  command(
    "POST",
    "/local/attendance-records",
    "attendance.create",
    (m, _id, body) => attendance.create(m, body),
    true,
  );
  for (const action of ["arrive", "depart"] as const)
    command(
      "POST",
      `/local/attendance-records/:id/${action}`,
      `attendance.${action}`,
      (m, id, body) => attendance.transition(m, id, body, action),
    );
  command(
    "POST",
    "/local/attendance-records/:id/correction",
    "attendance.correction",
    (m, id, body) => attendance.correction(m, id, body),
  );
  command("POST", "/local/attendance-records/:id/review", "attendance.review", (m, id, body) =>
    attendance.review(m, id, body),
  );
  function pickupCommand(
    method: "POST",
    path: string,
    action: string,
    run: (member: LocalMember, id: string, body: unknown) => unknown,
    created = false,
  ) {
    app.route({
      method,
      url: path,
      config,
      handler: async (request, reply) => {
        const member = actor(request),
          id = (request.params as { id?: string }).id ?? "";
        try {
          return reply.code(created ? 201 : 200).send(run(member, id, request.body));
        } catch (error) {
          if (error instanceof LocalError) pickup.denied(member, action, id);
          throw error;
        }
      },
    });
  }
  app.get("/local/pickup-authorizations", { config }, async (request) =>
    pickup.authorizations(actor(request)),
  );
  app.get("/local/pickup-authorizations/:id", { config }, async (request) =>
    pickup.authorization(actor(request), (request.params as { id: string }).id),
  );
  pickupCommand(
    "POST",
    "/local/pickup-authorizations",
    "pickup.authorization.create",
    (m, _id, body) => pickup.createAuthorization(m, body),
    true,
  );
  for (const action of ["activate", "revoke", "credential"] as const)
    pickupCommand(
      "POST",
      `/local/pickup-authorizations/:id/${action}`,
      `pickup.authorization.${action}`,
      (m, id, body) =>
        action === "activate"
          ? pickup.activate(m, id, body)
          : action === "revoke"
            ? pickup.revoke(m, id, body)
            : pickup.issueCredential(m, id, body),
    );
  app.get("/local/pickup-queue", { config }, async (request) => pickup.queue(actor(request)));
  pickupCommand(
    "POST",
    "/local/pickup-verifications",
    "pickup.verify",
    (m, _id, body) => pickup.startVerification(m, body),
    true,
  );
  pickupCommand(
    "POST",
    "/local/pickup-verifications/:id/confirm",
    "pickup.confirm",
    (m, id, body) => pickup.confirmVerification(m, id, body),
  );
  app.get("/local/pickup-records", { config }, async (request) => pickup.records(actor(request)));
  app.get("/local/pickup-summary", { config }, async (request) => pickup.summary(actor(request)));
  app.get("/local/pickup-exceptions", { config }, async (request) =>
    pickup.exceptions(actor(request)),
  );
  pickupCommand(
    "POST",
    "/local/pickup-exceptions",
    "pickup.exception.create",
    (m, _id, body) => pickup.createException(m, body),
    true,
  );
  pickupCommand(
    "POST",
    "/local/pickup-exceptions/:id/review",
    "pickup.exception.review",
    (m, id, body) => pickup.reviewException(m, id, body),
  );
  app.get("/local/fees", { config }, async (request) => fees.list(actor(request)));
  app.get("/local/fees/:id", { config }, async (request) =>
    fees.get(actor(request), (request.params as { id: string }).id),
  );
  app.get("/local/fees/:id/download", { config }, async (request) =>
    fees.download(actor(request), (request.params as { id: string }).id),
  );
  app.get("/local/fee-summary", { config }, async (request) => fees.summary(actor(request)));
  app.get("/local/fee-ledger", { config }, async (request) => fees.ledger(actor(request)));
  app.get("/local/fee-ledger-summary", { config }, async (request) =>
    fees.ledgerSummary(actor(request)),
  );
  app.get("/local/notices", { config }, async (request) => notice.notices(actor(request)));
  app.get("/local/notice-review", { config }, async (request) =>
    notice.reviewQueue(actor(request)),
  );
  app.get("/local/notice-owned", { config }, async (request) => notice.owned(actor(request)));
  command(
    "POST",
    "/local/notices",
    "notice.create",
    (m, _id, body) => notice.create(m, body),
    true,
  );
  command("POST", "/local/notices/:id/submit", "notice.submit", (m, id, body) =>
    notice.submit(m, id, body),
  );
  command("POST", "/local/notices/:id/review", "notice.review", (m, id, body) =>
    notice.review(m, id, body),
  );
  command("POST", "/local/notices/:id/publish", "notice.publish", (m, id, body) =>
    notice.publish(m, id, body),
  );
  command("POST", "/local/notices/:id/revoke", "notice.revoke", (m, id, body) =>
    notice.revoke(m, id, body),
  );
  command("POST", "/local/notices/:id/read", "notice.read", (m, id, body) =>
    notice.read(m, id, body),
  );
  command("POST", "/local/notices/:id/ack", "notice.ack", (m, id, body) => notice.ack(m, id, body));
  app.get("/local/health-incidents", { config }, async (request) => {
    const member = actor(request);
    if (member.actions.includes("health:read")) return health.parentList(member);
    return health.owned(member);
  });
  app.get("/local/health-incident-owned", { config }, async (request) =>
    health.owned(actor(request)),
  );
  app.get("/local/health-incident-review", { config }, async (request) =>
    health.reviewQueue(actor(request)),
  );
  command(
    "POST",
    "/local/health-incidents",
    "health.create",
    (m, _id, body) => health.create(m, body),
    true,
  );
  command("POST", "/local/health-incidents/:id/edit", "health.edit", (m, id, body) =>
    health.edit(m, id, body),
  );
  for (const action of ["submit", "review", "supplement", "publish", "revoke", "withdraw"] as const)
    command("POST", `/local/health-incidents/:id/${action}`, `health.${action}`, (m, id, body) =>
      action === "submit"
        ? health.submit(m, id, body)
        : action === "review"
          ? health.review(m, id, body)
          : action === "supplement"
            ? health.supplement(m, id, body)
            : action === "publish"
              ? health.publish(m, id, body)
              : action === "revoke"
                ? health.revoke(m, id, body)
                : health.withdraw(m, id, body),
    );
  command("POST", "/local/health-incidents/:id/read", "health.read", (m, id, body) =>
    health.read(m, id, body),
  );
  command("POST", "/local/health-incidents/:id/ack", "health.ack", (m, id, body) =>
    health.ack(m, id, body),
  );
  app.get("/local/staff-daily-reports", { config }, async (request) => daily.list(actor(request)));
  app.get("/local/staff-daily-reports/:id", { config }, async (request) =>
    daily.get(actor(request), (request.params as { id: string }).id),
  );
  app.get("/local/staff-daily-owned", { config }, async (request) => daily.list(actor(request)));
  app.get("/local/staff-daily-review", { config }, async (request) =>
    daily.reviewQueue(actor(request)),
  );
  function dailyCommand(
    method: "POST" | "PATCH",
    path: string,
    action: string,
    run: (member: LocalMember, id: string, body: unknown) => unknown,
    created = false,
  ) {
    app.route({
      method,
      url: path,
      config,
      handler: async (request, reply) => {
        const member = actor(request),
          id = (request.params as { id?: string }).id ?? "";
        try {
          return reply.code(created ? 201 : 200).send(run(member, id, request.body));
        } catch (error) {
          if (error instanceof LocalError) daily.denied(member, action, id);
          throw error;
        }
      },
    });
  }
  dailyCommand(
    "POST",
    "/local/staff-daily-reports",
    "daily.create",
    (m, _id, body) => daily.create(m, body),
    true,
  );
  dailyCommand("PATCH", "/local/staff-daily-reports/:id", "daily.edit", (m, id, body) =>
    daily.edit(m, id, body),
  );
  dailyCommand("POST", "/local/staff-daily-reports/:id/submit", "daily.submit", (m, id, body) =>
    daily.submit(m, id, body),
  );
  dailyCommand("POST", "/local/staff-daily-reports/:id/resubmit", "daily.resubmit", (m, id, body) =>
    daily.resubmit(m, id, body),
  );
  dailyCommand("POST", "/local/staff-daily-reports/:id/review", "daily.review", (m, id, body) =>
    daily.review(m, id, body),
  );
  dailyCommand("POST", "/local/staff-daily-reports/:id/withdraw", "daily.withdraw", (m, id, body) =>
    daily.withdraw(m, id, body),
  );
  app.get("/local/staff-task-assignees", { config }, async (request) =>
    tasks.assignees(actor(request)),
  );
  app.get("/local/staff-tasks", { config }, async (request) => tasks.list(actor(request)));
  app.get("/local/staff-task-review", { config }, async (request) =>
    tasks.reviewQueue(actor(request)),
  );
  function taskCommand(
    path: string,
    action: string,
    run: (member: LocalMember, id: string, body: unknown) => unknown,
    created = false,
  ) {
    app.route({
      method: "POST",
      url: path,
      config,
      handler: async (request, reply) => {
        const member = actor(request),
          id = (request.params as { id?: string }).id ?? "";
        try {
          return reply.code(created ? 201 : 200).send(run(member, id, request.body));
        } catch (error) {
          if (error instanceof LocalError) tasks.denied(member, action, id);
          throw error;
        }
      },
    });
  }
  taskCommand(
    "/local/staff-tasks",
    "task.assign",
    (member, _id, body) => tasks.create(member, body),
    true,
  );
  taskCommand("/local/staff-tasks/:id/claim", "task.claim", (member, id, body) =>
    tasks.claim(member, id, body),
  );
  taskCommand("/local/staff-tasks/:id/start", "task.start", (member, id, body) =>
    tasks.start(member, id, body),
  );
  taskCommand("/local/staff-tasks/:id/complete", "task.complete", (member, id, body) =>
    tasks.complete(member, id, body),
  );
  taskCommand("/local/staff-tasks/:id/check", "task.check", (member, id, body) =>
    tasks.check(member, id, body),
  );
  taskCommand("/local/staff-tasks/:id/cancel", "task.cancel", (member, id, body) =>
    tasks.cancel(member, id, body),
  );
  app.get("/local/monthly-feedback", { config }, async (request) => {
    const member = actor(request);
    if (member.actions.includes("feedback:ack")) return feedback.parentList(member);
    return feedback.list(member);
  });
  app.get("/local/monthly-feedback-owned", { config }, async (request) =>
    feedback.list(actor(request)),
  );
  app.get("/local/monthly-feedback-review", { config }, async (request) =>
    feedback.reviewQueue(actor(request)),
  );
  app.get("/local/monthly-feedback-parent", { config }, async (request) =>
    feedback.parentList(actor(request)),
  );
  app.get("/local/monthly-feedback/:id", { config }, async (request) =>
    feedback.get(actor(request), (request.params as { id: string }).id),
  );
  function feedbackCommand(
    method: "POST" | "PATCH",
    path: string,
    action: string,
    run: (member: LocalMember, id: string, body: unknown) => unknown,
    created = false,
  ) {
    app.route({
      method,
      url: path,
      config,
      handler: async (request, reply) => {
        const member = actor(request),
          id = (request.params as { id?: string }).id ?? "";
        try {
          return reply.code(created ? 201 : 200).send(run(member, id, request.body));
        } catch (error) {
          if (error instanceof LocalError) feedback.denied(member, action, id);
          throw error;
        }
      },
    });
  }
  feedbackCommand(
    "POST",
    "/local/monthly-feedback",
    "feedback.create",
    (m, _id, body) => feedback.create(m, body),
    true,
  );
  feedbackCommand("PATCH", "/local/monthly-feedback/:id", "feedback.edit", (m, id, body) =>
    feedback.edit(m, id, body),
  );
  for (const action of [
    "submit",
    "resubmit",
    "review",
    "publish",
    "source-refresh",
    "ack",
  ] as const)
    feedbackCommand(
      "POST",
      `/local/monthly-feedback/:id/${action}`,
      `feedback.${action}`,
      (m, id, body) =>
        action === "submit"
          ? feedback.submit(m, id, body)
          : action === "resubmit"
            ? feedback.resubmit(m, id, body)
            : action === "review"
              ? feedback.review(m, id, body)
              : action === "publish"
                ? feedback.publish(m, id, body)
                : action === "source-refresh"
                  ? feedback.sourceRefresh(m, id, body)
                  : feedback.ack(m, id, body),
    );

  app.get("/local/supply-requests", { config }, async (request) => supply.list(actor(request)));
  app.get("/local/supply-requests-owned", { config }, async (request) =>
    supply.list(actor(request)),
  );
  app.get("/local/supply-requests-review", { config }, async (request) =>
    supply.reviewQueue(actor(request)),
  );
  app.get("/local/supply-summary", { config }, async (request) => supply.summary(actor(request)));
  get("/local/supply-requests/:id", (member, id) => supply.get(member, id));
  function supplyCommand(
    method: "POST" | "PATCH",
    path: string,
    action: string,
    run: (member: LocalMember, id: string, body: unknown) => unknown,
    created = false,
  ) {
    app.route({
      method,
      url: path,
      config,
      handler: async (request, reply) => {
        const member = actor(request),
          id = (request.params as { id?: string }).id ?? "";
        try {
          return reply.code(created ? 201 : 200).send(run(member, id, request.body));
        } catch (error) {
          if (error instanceof LocalError) supply.denied(member, action, id);
          throw error;
        }
      },
    });
  }
  supplyCommand(
    "POST",
    "/local/supply-requests",
    "supply.create",
    (m, _id, body) => supply.create(m, body),
    true,
  );
  supplyCommand("PATCH", "/local/supply-requests/:id", "supply.edit", (m, id, body) =>
    supply.edit(m, id, body),
  );
  for (const action of ["submit", "review", "claim", "cancel"] as const)
    supplyCommand(
      "POST",
      `/local/supply-requests/:id/${action}`,
      `supply.${action}`,
      (m, id, body) =>
        action === "submit"
          ? supply.submit(m, id, body)
          : action === "review"
            ? supply.review(m, id, body)
            : action === "claim"
              ? supply.claim(m, id, body)
              : supply.cancel(m, id, body),
    );

  app.get("/local/resources", { config }, async (request) => {
    const query = request.query as Record<string, unknown>;
    if (Object.keys(query).some((key) => !["query", "grade", "subject", "tag"].includes(key)))
      throw new LocalError(400, "INVALID_REQUEST");
    for (const value of Object.values(query))
      if (typeof value !== "string" || value.length > 80)
        throw new LocalError(400, "INVALID_REQUEST");
    return resources.list(actor(request), query as ResourceLibraryFilter);
  });
  app.get("/local/resources-favorites", { config }, async (request) =>
    resources.favorites(actor(request)),
  );
  app.get("/local/resources-recent", { config }, async (request) =>
    resources.recent(actor(request)),
  );
  app.get("/local/resources-managed", { config }, async (request) =>
    resources.managed(actor(request)),
  );
  app.get("/local/resource-summary", { config }, async (request) =>
    resources.summary(actor(request)),
  );
  app.get("/local/statistics", { config }, async (request) => {
    const query = request.query as Record<string, unknown>;
    if (Object.keys(query).some((key) => !["from", "to", "campusId", "classId"].includes(key)))
      throw new LocalError(400, "INVALID_REQUEST");
    if (Object.values(query).some((value) => typeof value !== "string" || value.length > 80))
      throw new LocalError(400, "INVALID_REQUEST");
    return statistics.read(actor(request), query as unknown as OperationalStatisticsFilter);
  });
  app.get("/local/statistics-summary", { config }, async (request) =>
    statistics.anonymousSummary(actor(request)),
  );
  get("/local/learning-sessions", (member) => learning.list(member));
  get("/local/learning-sessions/:id", (member, id) => learning.get(member, id));
  get("/local/learning-knowledge", (member) => learning.learningKnowledge(member));
  app.get("/local/learning-teacher-summary", { config }, async (request) =>
    learning.teacherSummary(actor(request)),
  );
  app.get("/local/learning-parent-controls", { config }, async (request) =>
    learning.parentControls(actor(request)),
  );
  app.get("/local/learning-parent-contact-intents", { config }, async (request) =>
    learning.teacherContactIntents(actor(request)),
  );
  app.get("/local/learning-institution-setting", { config }, async (request) => {
    const member = actor(request);
    try {
      return learning.institutionSetting(member);
    } catch (error) {
      if (error instanceof LocalError)
        learning.denied(member, "learning.institution-setting.read", "");
      throw error;
    }
  });
  app.get("/local/learning-safety-summary", { config }, async (request) =>
    learning.safetySummary(actor(request)),
  );
  function learningCommand(
    path: string,
    action: string,
    run: (member: LocalMember, id: string, body: unknown) => unknown,
    created = false,
  ) {
    app.post(path, { config }, async (request, reply) => {
      const member = actor(request);
      const id = (request.params as { id?: string }).id ?? "";
      try {
        return reply.code(created ? 201 : 200).send(run(member, id, request.body));
      } catch (error) {
        if (error instanceof LocalError) learning.denied(member, action, id);
        throw error;
      }
    });
  }
  learningCommand(
    "/local/learning-sessions",
    "learning.enable",
    (member, _id, body) => learning.create(member, body),
    true,
  );
  learningCommand("/local/learning-sessions/:id/answer", "learning.answer", (member, id, body) =>
    learning.answer(member, id, body),
  );
  learningCommand("/local/learning-sessions/:id/hint", "learning.hint", (member, id, body) =>
    learning.hint(member, id, body),
  );
  learningCommand("/local/learning-sessions/:id/close", "learning.close", (member, id, body) =>
    learning.close(member, id, body),
  );
  learningCommand("/local/learning-sessions/:id/delete", "learning.delete", (member, id, body) =>
    learning.delete(member, id, body),
  );
  learningCommand(
    "/local/learning-parent-controls/:id",
    "learning.parent-controls.update",
    (member, studentId, body) => learning.updateParentControls(member, studentId, body),
  );
  learningCommand(
    "/local/learning-parent-contact/:id",
    "learning.parent-contact.record-local",
    (member, studentId, body) => learning.contactTeacher(member, studentId, body),
    true,
  );
  app.patch("/local/learning-institution-setting", { config }, async (request) => {
    const member = actor(request);
    try {
      return learning.updateInstitutionSetting(member, request.body);
    } catch (error) {
      if (error instanceof LocalError)
        learning.denied(member, "learning.institution-setting.update", "");
      throw error;
    }
  });
  app.get("/local/resources/:id", { config }, async (request, reply) => {
    const row = resources.detail(actor(request), (request.params as { id?: string }).id ?? "");
    return row ? row : reply.code(404).send({ error: { code: "UNAVAILABLE" } });
  });
  function resourceCommand(
    method: "POST" | "PATCH",
    path: string,
    action: string,
    keys: readonly string[],
    run: (member: LocalMember, id: string, body: Record<string, unknown>) => unknown,
    optionalKeys: readonly string[] = [],
  ) {
    app.route({
      method,
      url: path,
      config,
      handler: async (request) => {
        const member = actor(request);
        const id = (request.params as { id?: string }).id ?? "";
        try {
          return run(member, id, exactBody(request.body, keys, optionalKeys));
        } catch (error) {
          if (error instanceof LocalError) resources.denied(member, action, id);
          throw error;
        }
      },
    });
  }
  resourceCommand(
    "POST",
    "/local/resources/:id/favorite",
    "resource.favorite",
    ["version", "favorite"],
    (member, id, body) =>
      resources.favorite(member, id, body as unknown as { version: number; favorite: boolean }),
  );
  resourceCommand(
    "POST",
    "/local/resources/:id/use",
    "resource.use",
    ["version"],
    (member, id, body) => resources.use(member, id, body as unknown as { version: number }),
  );
  resourceCommand(
    "PATCH",
    "/local/resources/:id",
    "resource.update",
    ["version", "scope", "expiresOn"],
    (member, id, body) => resources.update(member, id, body as unknown as ResourceLibraryUpdate),
    ["classId", "learningSourceAction"],
  );
  resourceCommand(
    "POST",
    "/local/resources/:id/revoke",
    "resource.revoke",
    ["version"],
    (member, id, body) => resources.revoke(member, id, body as unknown as { version: number }),
  );
}
