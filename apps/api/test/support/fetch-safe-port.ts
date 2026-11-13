const FIRST_FETCH_SAFE_PORT = 49152;
const LAST_FETCH_SAFE_PORT = 65535;
const FETCH_SAFE_PORT_COUNT = LAST_FETCH_SAFE_PORT - FIRST_FETCH_SAFE_PORT + 1;

let nextCandidatePort = FIRST_FETCH_SAFE_PORT + (process.pid % FETCH_SAFE_PORT_COUNT);

function isAddressInUse(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "EADDRINUSE"
  );
}

export async function listenOnFetchSafePort(
  listen: (port: number) => Promise<unknown>,
): Promise<number> {
  for (let attempt = 0; attempt < FETCH_SAFE_PORT_COUNT; attempt += 1) {
    const port = nextCandidatePort;
    nextCandidatePort = port === LAST_FETCH_SAFE_PORT ? FIRST_FETCH_SAFE_PORT : port + 1;

    try {
      await listen(port);
      return port;
    } catch (error) {
      if (!isAddressInUse(error)) {
        throw error;
      }
    }
  }

  throw new Error("Unable to find an available Fetch-safe loopback port.");
}
