export type ApiListenEnvironment = Readonly<{
  NODE_ENV?: string;
  PORT?: string;
  STUDENT_CARE_API_HOST?: string;
}>;

const DEFAULT_PORT = 4321;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1"]);
const PRODUCTION_HOSTS = new Set([...LOOPBACK_HOSTS, "0.0.0.0", "::"]);

export function resolveApiListenConfig(
  environment: ApiListenEnvironment,
): Readonly<{ host: string; port: number }> {
  const production = environment.NODE_ENV === "production";
  const host = environment.STUDENT_CARE_API_HOST ?? (production ? undefined : "127.0.0.1");

  if (host === undefined)
    throw new Error("STUDENT_CARE_API_HOST is required when NODE_ENV is production.");

  const allowedHosts = production ? PRODUCTION_HOSTS : LOOPBACK_HOSTS;
  if (!allowedHosts.has(host))
    throw new Error(
      production
        ? "STUDENT_CARE_API_HOST must be a supported loopback or interface address."
        : "Non-production API listener must stay on a loopback address.",
    );

  const rawPort = environment.PORT;
  if (rawPort !== undefined && !/^\d+$/u.test(rawPort))
    throw new Error("PORT must be an integer from 1 to 65535.");

  const port = rawPort === undefined ? DEFAULT_PORT : Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be an integer from 1 to 65535.");

  return { host, port };
}
