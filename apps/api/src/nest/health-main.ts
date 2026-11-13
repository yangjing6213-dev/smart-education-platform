import { createHealthApp } from "./health-app.js";

const port = 4320;

async function bootstrap(): Promise<void> {
  const app = await createHealthApp();
  await app.listen(port, "127.0.0.1");
}

void bootstrap().catch((error: unknown) => {
  console.error("Nest health app failed to start.", error);
  process.exitCode = 1;
});
