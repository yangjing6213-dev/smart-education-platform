import assert from "node:assert/strict";
import test from "node:test";
import { runLocalSyntheticRecoveryDrill } from "./local-synthetic-recovery-drill.mjs";

test("synthetic recovery verifies, restores, rejects corruption, and cleans its temp root", async () => {
  assert.deepEqual(await runLocalSyntheticRecoveryDrill(), {
    syntheticOnly: true,
    backupVerified: true,
    restoreVerified: true,
    corruptedBackupRejected: true,
    restoreTargetUntouched: true,
    existingTargetPreserved: true,
    cleanupCompleted: true,
  });
});
