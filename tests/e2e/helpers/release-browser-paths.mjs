import { lstatSync } from "node:fs";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import process from "node:process";
import { pathToFileURL, URL } from "node:url";

function configured(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function strictChild(parent, child) {
  const distance = relative(parent, child);
  return (
    distance !== "" &&
    distance !== ".." &&
    !distance.startsWith(`..${sep}`) &&
    !isAbsolute(distance)
  );
}

function rejectAncestorLinks(path) {
  let current = parse(path).root;
  for (const part of path.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    let entry;
    try {
      entry = lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw new Error("PATH_ANCESTOR_INVALID");
    }
    if (entry.isSymbolicLink()) throw new Error("PATH_ANCESTOR_LINK");
    if (!entry.isDirectory()) throw new Error("PATH_ANCESTOR_INVALID");
  }
}

export function assertTaskOwnedDirectory(parent, child) {
  const root = resolve(parent);
  const directory = resolve(root, child);
  if (!strictChild(root, directory)) throw new Error("TASK_DIRECTORY_OUTSIDE_PARENT");
  rejectAncestorLinks(root);
  rejectAncestorLinks(directory);
  return directory;
}

export function resolveReleaseBrowserPaths(repositoryRoot, env = process.env) {
  if (!configured(env.TASK20_BROWSER_ARTIFACT_ROOT)) throw new Error("ARTIFACT_ROOT_REQUIRED");
  const root = resolve(repositoryRoot);
  const artifacts = resolve(root, "artifacts");
  const artifactRoot = resolve(root, env.TASK20_BROWSER_ARTIFACT_ROOT);
  if (!strictChild(artifacts, artifactRoot)) throw new Error("ARTIFACT_ROOT_OUTSIDE_TASK");
  const task = relative(artifacts, artifactRoot).split(sep)[0];
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/u.test(task)) throw new Error("TASK_DIRECTORY_INVALID");
  let apiRuntimeRoot = resolve(artifactRoot, "api-dist/runtime/src");
  if (env.TASK20_BROWSER_API_MODE !== undefined) {
    if (env.TASK20_BROWSER_API_MODE !== "preflight-candidate")
      throw new Error("API_RUNTIME_MODE_INVALID");
    if (env.TASK20_API_RUNTIME !== undefined) throw new Error("API_RUNTIME_OVERRIDE_FORBIDDEN");
    if (artifactRoot !== join(artifacts, task, "run"))
      throw new Error("CANDIDATE_ARTIFACT_ROOT_INVALID");
    apiRuntimeRoot = join(root, "apps", "api", `.dist-${task}-api`, "src");
  } else if (env.TASK20_API_RUNTIME !== undefined) {
    if (!configured(env.TASK20_API_RUNTIME)) throw new Error("API_RUNTIME_INVALID");
    apiRuntimeRoot = resolve(root, env.TASK20_API_RUNTIME);
    if (!strictChild(artifactRoot, apiRuntimeRoot)) throw new Error("API_RUNTIME_OUTSIDE_TASK");
  }
  rejectAncestorLinks(artifactRoot);
  rejectAncestorLinks(apiRuntimeRoot);
  return {
    artifactRoot,
    apiRuntimeRoot,
    userDistDirectory: `.next-${task}-user-web`,
    adminDistDirectory: `.next-${task}-admin-web`,
  };
}

export function browserApiModuleUrl(repositoryRoot, file, env = process.env) {
  const runtime = env.TASK20_BROWSER_API_MODE === undefined
    ? resolve(repositoryRoot, "apps/api/dist/src")
    : resolveReleaseBrowserPaths(repositoryRoot, env).apiRuntimeRoot;
  const modulePath = resolve(runtime, file);
  if (!strictChild(runtime, modulePath)) throw new Error("API_MODULE_OUTSIDE_RUNTIME");
  return pathToFileURL(modulePath);
}

export function resolveLocalTestDatabase(env = process.env) {
  if (
    typeof env.DATABASE_URL !== "string" ||
    !env.DATABASE_URL.trim() ||
    typeof env.TASK20_TEST_DATABASE_PORT !== "string" ||
    !env.TASK20_TEST_DATABASE_PORT.trim()
  )
    throw new Error("DATABASE_CONFIGURATION_REQUIRED");
  const port = env.TASK20_TEST_DATABASE_PORT;
  if (
    !configured(env.DATABASE_URL) ||
    !/^[1-9][0-9]{3,4}$/u.test(port) ||
    Number(port) < 1024 ||
    Number(port) > 65535
  )
    throw new Error("LOCAL_DATABASE_INVALID");
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("LOCAL_DATABASE_INVALID");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== "127.0.0.1" ||
    url.port !== port ||
    url.search ||
    url.hash
  )
    throw new Error("LOCAL_DATABASE_INVALID");
  return url;
}
