import type { INestApplication } from "@nestjs/common";
import { createApiApp } from "./api-app.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { resolveApiListenConfig } from "./api-listen-config.js";
import { createProductionApiOptions } from "./production-api-options.js";
import { parseInviteAccountsJson } from "./invite-auth.service.js";
import { parseTrialAccounts, verifyInvitedTrialDatabase } from "./invited-trial-preflight.js";

const invitedTrial = process.argv.slice(2).includes("--invited-trial");
const trialFailure = "Invited trial API startup checks failed.";

async function bootstrap(): Promise<void> {
  const listenConfig = resolveApiListenConfig(process.env);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the Nest API.");

  const accountsJson = process.env.STUDENT_CARE_INVITE_ACCOUNTS_JSON;
  const inviteAccounts = invitedTrial
    ? parseTrialAccounts(accountsJson)
    : parseInviteAccountsJson(accountsJson);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
      ...(invitedTrial ? { connectionTimeoutMillis: 4000 } : {}),
    }),
  });
  let app: INestApplication | undefined;
  try {
    await prisma.$connect();
    if (invitedTrial) await verifyInvitedTrialDatabase(prisma, inviteAccounts);
    app = await createApiApp(createProductionApiOptions(prisma, inviteAccounts));
    app.enableShutdownHooks();
    await app.listen(listenConfig.port, listenConfig.host);
  } catch (error) {
    try {
      await app?.close();
    } finally {
      await prisma.$disconnect();
    }
    throw error;
  }
}

// A peer that accepts TCP but never answers must not keep a rejected trial process alive.
const deadline = invitedTrial
  ? setTimeout(() => {
      console.error(trialFailure);
      process.exit(1);
    }, 12000)
  : undefined;
void bootstrap()
  .catch((error: unknown) => {
    if (invitedTrial) console.error(trialFailure);
    else console.error("Nest API failed to start.", error);
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(deadline));
