import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  appendFile,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_NAME = "synthetic-record.json";
const TEMP_PREFIX = "task20-local-synthetic-recovery-";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readVerifiedBackup(backupDir) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(backupDir, "manifest.json"), "utf8"));
  } catch {
    throw new Error("合成备份清单无法读取。");
  }
  if (
    !manifest ||
    typeof manifest !== "object" ||
    Object.keys(manifest).length !== 1 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 1 ||
    !manifest.files[0] ||
    Object.keys(manifest.files[0]).length !== 2 ||
    manifest.files[0].path !== FIXTURE_NAME ||
    typeof manifest.files[0].sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(manifest.files[0].sha256)
  )
    throw new Error("合成备份清单格式无效。");

  const data = await readFile(join(backupDir, FIXTURE_NAME));
  if (sha256(data) !== manifest.files[0].sha256) throw new Error("合成备份校验失败，已拒绝恢复。");
  return data;
}

async function restoreVerifiedBackup(backupDir, restoreDir) {
  const data = await readVerifiedBackup(backupDir);
  await mkdir(restoreDir);
  await writeFile(join(restoreDir, FIXTURE_NAME), data, { flag: "wx" });
  return data;
}

export async function runLocalSyntheticRecoveryDrill() {
  const tempBase = resolve(tmpdir());
  const root = await mkdtemp(join(tempBase, TEMP_PREFIX));
  let rootIsContained = false;
  let backupVerified = false;
  let restoreVerified = false;
  let corruptedBackupRejected = false;
  let restoreTargetUntouched = false;
  let existingTargetPreserved = false;
  try {
    const relativeRoot = relative(tempBase, resolve(root));
    rootIsContained =
      Boolean(relativeRoot) &&
      !relativeRoot.startsWith("..") &&
      !isAbsolute(relativeRoot) &&
      relativeRoot.startsWith(TEMP_PREFIX);
    if (!rootIsContained) throw new Error("临时演练目录不在允许范围内。");

    const sourceDir = join(root, "source");
    const backupDir = join(root, "backup");
    const restoreDir = join(root, "restored");
    const corruptBackupDir = join(root, "corrupt-backup");
    const corruptRestoreDir = join(root, "must-remain-absent");
    const protectedTargetDir = join(root, "must-remain-unchanged");
    const fixture = `${JSON.stringify(
      {
        kind: "local-synthetic-recovery-drill",
        version: 1,
        records: [{ id: "synthetic-record-001", value: "虚构临时内容" }],
      },
      null,
      2,
    )}\n`;
    const fixtureBytes = Buffer.from(fixture, "utf8");
    const sourceFile = join(sourceDir, FIXTURE_NAME);
    const backupFile = join(backupDir, FIXTURE_NAME);

    await mkdir(sourceDir);
    await mkdir(backupDir);
    await writeFile(sourceFile, fixtureBytes, { flag: "wx" });
    await copyFile(sourceFile, backupFile, constants.COPYFILE_EXCL);
    await writeFile(
      join(backupDir, "manifest.json"),
      `${JSON.stringify(
        { files: [{ path: FIXTURE_NAME, sha256: sha256(fixtureBytes) }] },
        null,
        2,
      )}\n`,
      { flag: "wx" },
    );

    const verified = await readVerifiedBackup(backupDir);
    backupVerified = verified.equals(fixtureBytes);
    if (!backupVerified) throw new Error("合成备份内容与源文件不一致。");

    const restored = await restoreVerifiedBackup(backupDir, restoreDir);
    restoreVerified = restored.equals(await readFile(join(restoreDir, FIXTURE_NAME)));
    if (!restoreVerified) throw new Error("合成恢复结果与备份不一致。");

    await mkdir(corruptBackupDir);
    await copyFile(backupFile, join(corruptBackupDir, FIXTURE_NAME), constants.COPYFILE_EXCL);
    await copyFile(
      join(backupDir, "manifest.json"),
      join(corruptBackupDir, "manifest.json"),
      constants.COPYFILE_EXCL,
    );
    await appendFile(join(corruptBackupDir, FIXTURE_NAME), "corrupted");
    try {
      await restoreVerifiedBackup(corruptBackupDir, corruptRestoreDir);
    } catch (error) {
      corruptedBackupRejected =
        error instanceof Error && error.message === "合成备份校验失败，已拒绝恢复。";
    }
    restoreTargetUntouched = !(await exists(corruptRestoreDir));
    if (!corruptedBackupRejected || !restoreTargetUntouched)
      throw new Error("损坏备份未在写入恢复目标前被拒绝。");

    await mkdir(protectedTargetDir);
    const protectedFile = join(protectedTargetDir, FIXTURE_NAME);
    await writeFile(protectedFile, "existing synthetic target", { flag: "wx" });
    let existingTargetRejected = false;
    try {
      await restoreVerifiedBackup(backupDir, protectedTargetDir);
    } catch (error) {
      existingTargetRejected = error?.code === "EEXIST";
    }
    existingTargetPreserved =
      existingTargetRejected &&
      (await readFile(protectedFile, "utf8")) === "existing synthetic target";
    if (!existingTargetPreserved) throw new Error("恢复操作覆盖或未保护既有目标。");
  } finally {
    await rm(root, { recursive: true, force: false });
  }

  let cleanupCompleted = false;
  try {
    await stat(root);
  } catch (error) {
    cleanupCompleted = error?.code === "ENOENT";
  }
  if (!cleanupCompleted) throw new Error("临时演练目录未能清理。");

  return {
    syntheticOnly: true,
    backupVerified,
    restoreVerified,
    corruptedBackupRejected,
    restoreTargetUntouched,
    existingTargetPreserved,
    cleanupCompleted,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) {
    process.stderr.write("此演练不接受路径或额外参数。\n");
    process.exitCode = 2;
  } else {
    runLocalSyntheticRecoveryDrill()
      .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
      .catch(() => {
        process.stderr.write("本机合成恢复演练失败；未输出临时文件内容。\n");
        process.exitCode = 1;
      });
  }
}
