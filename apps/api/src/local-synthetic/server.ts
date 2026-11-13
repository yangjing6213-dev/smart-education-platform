import fastify from "fastify";
import { authPlugin } from "../plugins/auth.plugin.js";
import { scopePlugin } from "../plugins/scope.plugin.js";
import { BindingLeaveService, LocalError } from "./binding-leave.service.js";
import { LocalSyntheticGuardianBindingAdapter } from "./nest-guardian-binding-adapter.js";
import { LocalSyntheticNestLeaveAdapter } from "./nest-leave.adapter.js";
import { LocalSyntheticNestCareRecordAdapter } from "./nest-care-record.adapter.js";
import { LocalSyntheticNestParentGovernanceAdapter } from "./nest-parent-governance-adapter.js";
import { LocalSyntheticNestStaffTaskWorkbenchAdapter } from "./nest-staff-task-workbench.adapter.js";
import { LocalSyntheticNestStaffHealthIncidentReviewAdapter } from "./nest-staff-health-incident-review.adapter.js";
import { LocalSyntheticNestStaffDailyAdapter } from "./nest-staff-daily.adapter.js";
import { registerLocalRoutes } from "./routes.js";
import { LocalSessions, memberForActor } from "./sessions.js";
import { LocalRepository } from "./repository.js";
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
import { InMemoryMealRepository, MealService } from "../modules/meals/meal.service.js";
import type { InviteAuthOperations } from "../nest/api-tokens.js";

function validOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      url.port !== "" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export async function buildLocalSyntheticServer(options: {
  mode: "local-synthetic";
  now?: () => number;
  allowedOrigins?: readonly string[];
  inviteAuthService?: InviteAuthOperations;
}) {
  if (options.mode !== "local-synthetic")
    throw new Error("Explicit local-synthetic mode required.");
  const origins = new Set(
    options.allowedOrigins ?? ["http://127.0.0.1:4317", "http://localhost:4317"],
  );
  if ([...origins].some((origin) => !validOrigin(origin)))
    throw new Error("Only explicit loopback origins are allowed.");
  const app = fastify({ logger: false, bodyLimit: 8192, trustProxy: false });
  const sessions = new LocalSessions(options.now),
    repository = new LocalRepository(),
    service = new BindingLeaveService(repository, options.now),
    care = new CareRecordService(repository, options.now),
    attendance = new AttendanceService(repository, options.now),
    pickup = new PickupService(repository, options.now),
    fees = new FeesService(repository, options.now),
    notice = new NoticeService(repository, options.now),
    health = new HealthIncidentService(repository, options.now),
    feedback = new MonthlyFeedbackService(repository, options.now),
    supply = new SupplyRequestService(repository, options.now),
    tasks = new StaffTaskService(repository, options.now),
    resources = new ResourceLibraryService(repository, options.now);
  const guardianBindingOperations = new LocalSyntheticGuardianBindingAdapter(service, repository);
  const leaveOperations = new LocalSyntheticNestLeaveAdapter(service);
  const careRecordOperations = new LocalSyntheticNestCareRecordAdapter(care, repository);
  const staffTaskWorkbenchOperations = new LocalSyntheticNestStaffTaskWorkbenchAdapter(tasks);
  const staffHealthIncidentReviewOperations = new LocalSyntheticNestStaffHealthIncidentReviewAdapter(
    health,
  );
  const consents = new ConsentService(service, options.now);
  const learning = new LearningSessionService(repository, consents, options.now);
  const daily = new StaffDailyService(
    repository,
    options.now,
    (date, tenantId, campusId, classId) => learning.dailySummary(date, tenantId, campusId, classId),
  );
  const staffDailyOperations = new LocalSyntheticNestStaffDailyAdapter(daily);
  const staffCredentials = new StaffCredentialsService(sessions, options.now);
  const mediaAssets = new MediaAssetsService(options.now);
  const privacyRequests = new PrivacyRequestService(service, options.now);
  const parentGovernanceOperations = new LocalSyntheticNestParentGovernanceAdapter(
    service,
    consents,
    privacyRequests,
    fees,
    learning,
    feedback,
    notice,
    health,
    pickup,
  );
  const meals = new MealService(new InMemoryMealRepository(), {
    ...(options.now ? { now: () => new Date(options.now!()) } : {}),
  });
  app.setErrorHandler((error, _request, reply) => {
    const suppliedStatus =
      typeof error === "object" && error !== null && "statusCode" in error
        ? error.statusCode
        : undefined;
    const status =
      error instanceof LocalError
        ? error.statusCode
        : typeof suppliedStatus === "number" && suppliedStatus >= 400 && suppliedStatus < 500
          ? suppliedStatus
          : 500;
    return reply.code(status).send({
      error: {
        code:
          error instanceof LocalError
            ? error.code
            : status < 500
              ? "INVALID_REQUEST"
              : "INTERNAL_ERROR",
      },
    });
  });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store").header("X-Content-Type-Options", "nosniff");
    const host = request.headers.host ?? "";
    const origin = request.headers.origin;
    const hostMatch = /^(127\.0\.0\.1|localhost)(?::([1-9]\d{0,4}))?$/.exec(host);
    if (
      !hostMatch ||
      (hostMatch[2] && Number(hostMatch[2]) > 65535) ||
      (origin !== undefined && !origins.has(origin))
    )
      return reply.code(403).send({ error: { code: "LOCAL_TRANSPORT_REQUIRED" } });
    if (origin) reply.header("Access-Control-Allow-Origin", origin).header("Vary", "Origin");
    const claims = new Set([
      "role",
      "roles",
      "actorid",
      "identityid",
      "tenant",
      "tenantid",
      "campus",
      "campusid",
      "capability",
      "capabilities",
      "permission",
      "permissions",
      "class",
      "classid",
      "forwarded",
      "forwardedfor",
      "forwardedhost",
      "forwardedproto",
      "realip",
    ]);
    if (
      Object.keys(request.headers).some((key) =>
        claims.has(key.replace(/^x-/, "").replace(/[-_]/g, "")),
      )
    )
      throw new LocalError(400, "INVALID_REQUEST");
    const query = request.query as Record<string, unknown>;
    const isStatisticsGetPreflight =
      request.method === "OPTIONS" &&
      request.url.split("?")[0] === "/local/statistics" &&
      request.headers["access-control-request-method"] === "GET";
    const queryKeys =
      request.routeOptions.url === "/local/resources" && request.method === "GET"
        ? ["query", "grade", "subject", "tag"]
        : request.routeOptions.url === "/local/statistics" && request.method === "GET"
          ? ["from", "to", "campusId", "classId"]
          : request.routeOptions.url === "/local/public-meals" && request.method === "GET"
            ? ["date"]
            : isStatisticsGetPreflight
              ? ["from", "to", "campusId", "classId"]
              : [];
    if (
      Object.entries(query).some(
        ([key, value]) =>
          !queryKeys.includes(key) || typeof value !== "string" || value.length > 80,
      )
    )
      throw new LocalError(400, "INVALID_REQUEST");
    if (
      (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") &&
      (request.headers["transfer-encoding"] !== undefined ||
        Number(request.headers["content-length"] ?? 0) > 0)
    )
      throw new LocalError(400, "INVALID_REQUEST");
  });
  app.options("/*", async (request, reply) => {
    const method = request.headers["access-control-request-method"];
    const headers = request.headers["access-control-request-headers"];
    if (
      !request.headers.origin ||
      typeof method !== "string" ||
      !["GET", "POST", "PUT", "PATCH"].includes(method) ||
      (headers !== undefined &&
        (typeof headers !== "string" ||
          headers
            .split(",")
            .some((key) => !["authorization", "content-type"].includes(key.trim().toLowerCase()))))
    )
      throw new LocalError(400, "INVALID_REQUEST");
    return reply
      .header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH")
      .header("Access-Control-Allow-Headers", "authorization, content-type")
      .code(204)
      .send();
  });
  const authNow = options.now;
  await authPlugin(app, {
    getTrustedAuthResult: (request) => sessions.resolve(request.headers.authorization),
    ...(authNow ? { now: () => new Date(authNow()) } : {}),
  });
  await scopePlugin(app, {
    getScopeInput: (request) => {
      const actorId = request.authContext?.identity.actor_id;
      const member = actorId ? memberForActor(actorId) : undefined;
      const membership = request.authContext?.memberships.find(
        (row) =>
          row.tenant_id === member?.tenantId &&
          row.campus_ids.includes(member.campusId) &&
          row.status === "ACTIVE",
      );
      return {
        trustedActor: member ? { actorId: member.actorId } : undefined,
        membership:
          member && membership
            ? { tenantId: member.tenantId, campusIds: [member.campusId], status: "ACTIVE" }
            : undefined,
        requestedTenantId: member?.tenantId,
        requestedCampusId: member?.campusId,
      };
    },
  });
  registerLocalRoutes(
    app,
    sessions,
    service,
    care,
    attendance,
    pickup,
    fees,
    notice,
    health,
    daily,
    feedback,
    supply,
    tasks,
    resources,
    new OperationalStatisticsService(repository),
    learning,
    staffCredentials,
    mediaAssets,
    privacyRequests,
    consents,
    meals,
    options.inviteAuthService,
  );
  app.addHook("onClose", async () => {
    sessions.clear();
  });
  return {
    inject: app.inject.bind(app),
    close: app.close.bind(app),
    resolveTrustedAuth: (authorization: string | undefined) => sessions.resolve(authorization),
    guardianBindingOperations,
    parentGovernanceOperations,
    leaveOperations,
    careRecordOperations,
    staffTaskWorkbenchOperations,
    staffHealthIncidentReviewOperations,
    staffDailyOperations,
    start: async (port: number) => {
      if (!Number.isInteger(port) || port < 0 || port > 65535)
        throw new Error("Invalid local port.");
      const address = await app.listen({ host: "127.0.0.1", port });
      origins.add(address);
      return address;
    },
  };
}
