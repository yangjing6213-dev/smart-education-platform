import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

const root = fileURLToPath(new URL("../", import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "--local-synthetic")
    throw new Error("Explicit --local-synthetic mode is required.");
  let port = 4317;
  const allowedOrigins = [];
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const value = args[++i];
    if (
      arg === "--port" &&
      typeof value === "string" &&
      /^\d{1,5}$/.test(value) &&
      Number(value) <= 65535
    )
      port = Number(value);
    else if (arg === "--origin" && typeof value === "string") {
      const url = new URL(value);
      if (
        url.origin !== value ||
        url.protocol !== "http:" ||
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        !url.port ||
        url.username ||
        url.password
      )
        throw new Error("Only explicit loopback origins are allowed.");
      allowedOrigins.push(value);
    } else throw new Error("Unsupported local-synthetic launch argument.");
  }
  const compiler = fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url));
  for (const project of [
    "packages/contracts",
    "packages/validation",
    "packages/tenant",
    "packages/auth",
    "apps/api",
  ]) {
    const build = spawnSync(process.execPath, [compiler, "-p", `${project}/tsconfig.json`], {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    });
    if (build.error || build.status !== 0)
      throw new Error(`Local-synthetic build failed at ${project}; service was not started.`);
  }
  const { createInvitePasswordHash, InviteAuthService } =
    await import("../apps/api/dist/src/nest/invite-auth.service.js");
  const parentPassword = randomBytes(24).toString("base64url");
  const teacherPassword = randomBytes(24).toString("base64url");
  const staffPassword = randomBytes(24).toString("base64url");
  const tenantId = "00000000-0000-4000-8000-000000000064";
  const campusId = "00000000-0000-4000-8000-000000000065";
  const inviteAuthService = new InviteAuthService([
    {
      username: "parent-demo",
      password_hash: await createInvitePasswordHash(parentPassword),
      identity: {
        actor_id: "00000000-0000-4000-8000-000000000001",
        display_name: "示例监护人甲",
      },
      memberships: [
        {
          tenant_id: tenantId,
          campus_ids: [campusId],
          status: "ACTIVE",
          capabilities: [
            "identity:read",
            "memberships:read",
            "binding:apply",
            "binding:read",
            "care:read",
            "leave:apply",
            "leave:read",
          ],
        },
      ],
    },
    {
      username: "teacher-demo",
      password_hash: await createInvitePasswordHash(teacherPassword),
      identity: {
        actor_id: "00000000-0000-4000-8000-000000000003",
        display_name: "示例东校区教师",
      },
      memberships: [
        {
          tenant_id: tenantId,
          campus_ids: [campusId],
          status: "ACTIVE",
          capabilities: [
            "identity:read",
            "memberships:read",
            "care:write",
            "task:read",
            "task:claim",
            "task:start",
            "task:complete",
          ],
        },
      ],
    },
    {
      username: "staff-demo",
      password_hash: await createInvitePasswordHash(staffPassword),
      identity: {
        actor_id: "00000000-0000-4000-8000-000000000004",
        display_name: "示例东校区负责人",
      },
      memberships: [
        {
          tenant_id: tenantId,
          campus_ids: [campusId],
          status: "ACTIVE",
          capabilities: [
            "identity:read",
            "memberships:read",
            "binding:read",
            "binding:review",
            "care:review",
            "care:publish",
            "leave:review",
            "task:read",
            "task:assign",
            "task:check",
            "task:cancel",
          ],
        },
      ],
    },
  ]);
  const { buildLocalSyntheticServer } =
    await import("../apps/api/dist/src/local-synthetic/server.js");
  const { createApiApp } = await import("../apps/api/dist/src/nest/api-app.js");
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    ...(allowedOrigins.length ? { allowedOrigins } : {}),
  });
  const api = await createApiApp({
    inviteAuthService,
    guardianBindingOperations: app.guardianBindingOperations,
    parentGovernanceOperations: app.parentGovernanceOperations,
    leaveOperations: app.leaveOperations,
    careRecordOperations: app.careRecordOperations,
    staffTaskWorkbenchOperations: app.staffTaskWorkbenchOperations,
  });
  const corsOrigins =
    allowedOrigins.length > 0 ? allowedOrigins : ["http://127.0.0.1:4317", "http://localhost:4317"];
  api.enableCors({
    origin: corsOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["authorization", "content-type"],
  });
  let baseUrl;
  try {
    baseUrl = await app.start(port);
    await api.listen(4321, "127.0.0.1");
  } catch (error) {
    await api.close();
    await app.close();
    throw error;
  }
  const apiBaseUrl = "http://127.0.0.1:4321";
  process.stdout.write(
    JSON.stringify({
      status: "ready",
      mode: "local-synthetic",
      baseUrl,
      apiBaseUrl,
      clearedOnRestart: true,
      inviteCredentials: {
        parent: { username: "parent-demo", password: parentPassword },
        teacher: { username: "teacher-demo", password: teacherPassword },
        staff: { username: "staff-demo", password: staffPassword },
      },
      notice: "仅本机合成数据；重启清空会话和申请；不是正式登录，不提供外网访问。",
    }) + "\n",
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await api.close();
    await app.close();
  };
  process.once("SIGINT", () => {
    void stop();
  });
  process.once("SIGTERM", () => {
    void stop();
  });
}

await main().catch((error) => {
  process.stderr.write(
    (error instanceof Error ? error.message : "Local-synthetic startup failed.") + "\n",
  );
  process.exitCode = 1;
});
