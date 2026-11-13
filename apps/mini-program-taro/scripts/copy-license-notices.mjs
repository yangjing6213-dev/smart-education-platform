import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const licenseNoticeMappings = [
  {
    source: "licenses/pages/auth/login/index.js.LICENSE.txt",
    target: "pages/auth/login/index.js.LICENSE.txt",
  },
  {
    source: "licenses/pages/visitor/home/index.js.LICENSE.txt",
    target: "pages/visitor/home/index.js.LICENSE.txt",
  },
];

export function getLicenseNoticeMappings() {
  return licenseNoticeMappings.map((mapping) => ({ ...mapping }));
}

export async function copyLicenseNotices(outputRoot = "dist", root = appRoot) {
  const resolvedOutputRoot = resolve(root, outputRoot);
  for (const mapping of licenseNoticeMappings) {
    const sourcePath = resolve(root, mapping.source);
    const targetPath = resolve(resolvedOutputRoot, mapping.target);
    const notice = await readFile(sourcePath);
    if (notice.length === 0) throw new Error(`License notice is empty: ${mapping.source}`);
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }
  return getLicenseNoticeMappings();
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  copyLicenseNotices(process.env.TARO_APP_OUTPUT_ROOT ?? "dist").catch((error) => {
    process.stderr.write(`Unable to restore Mini license notices: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
