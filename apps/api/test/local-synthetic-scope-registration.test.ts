import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import * as ts from "typescript";

function findWorkspaceRoot(start = process.cwd()): string {
  let current = resolve(start);
  while (true) {
    if (
      existsSync(resolve(current, "pnpm-workspace.yaml")) &&
      existsSync(resolve(current, "apps/api/package.json"))
    ) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) {
      throw new Error("Could not find the repository root from the current test location.");
    }
    current = parent;
  }
}

const PUBLIC_LOCAL_ROUTES = new Set([
  "GET /local/profiles",
  "GET /local/public-meals",
  "POST /local/login",
  "POST /local/sessions",
]);
const ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "all"]);

function propertyName(property: ts.ObjectLiteralElementLike): string | undefined {
  if (!("name" in property) || property.name === undefined) return undefined;
  return ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
    ? property.name.text
    : undefined;
}

function findUnprotectedLocalRoutes(source: string): readonly string[] {
  const sourceFile = ts.createSourceFile("local-routes.ts", source, ts.ScriptTarget.Latest, true);
  const variables = new Map<string, ts.Expression>();
  const appAliases = new Set(["app"]);
  const issues: string[] = [];

  function collectVariables(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
      if (ts.isIdentifier(node.name)) {
        variables.set(node.name.text, node.initializer);
        if (ts.isIdentifier(node.initializer) && appAliases.has(node.initializer.text)) {
          appAliases.add(node.name.text);
        }
        if (
          ts.isPropertyAccessExpression(node.initializer) &&
          ts.isIdentifier(node.initializer.expression) &&
          appAliases.has(node.initializer.expression.text) &&
          (ROUTE_METHODS.has(node.initializer.name.text) ||
            node.initializer.name.text === "route" ||
            node.initializer.name.text === "register")
        ) {
          issues.push("DETACHED_APP <unverified> (unsupported registration style)");
        }
      } else if (
        ts.isObjectBindingPattern(node.name) &&
        ts.isIdentifier(node.initializer) &&
        appAliases.has(node.initializer.text) &&
        node.name.elements.some((element) => {
          const name = element.propertyName ?? element.name;
          return (
            ts.isIdentifier(name) &&
            (ROUTE_METHODS.has(name.text) || name.text === "route" || name.text === "register")
          );
        })
      ) {
        issues.push("DESTRUCTURED_APP <unverified> (unsupported registration style)");
      }
    }
    ts.forEachChild(node, collectVariables);
  }

  function configuredFlags(
    expression: ts.Expression,
    visited: ReadonlySet<string> = new Set(),
  ): ReadonlySet<string> {
    if (ts.isIdentifier(expression)) {
      if (visited.has(expression.text)) return new Set();
      const initializer = variables.get(expression.text);
      if (initializer === undefined) return new Set();
      return configuredFlags(initializer, new Set([...visited, expression.text]));
    }

    if (!ts.isObjectLiteralExpression(expression)) return new Set();

    const flags = new Set<string>();
    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) {
        for (const flag of configuredFlags(property.expression, visited)) flags.add(flag);
        continue;
      }
      if (!ts.isPropertyAssignment(property)) continue;
      const name = propertyName(property);
      if (
        (name === "authRequired" || name === "scopeRequired") &&
        property.initializer.kind === ts.SyntaxKind.TrueKeyword
      )
        flags.add(name);
    }
    return flags;
  }

  function routeConfigFlags(options: ts.Expression | undefined): ReadonlySet<string> {
    if (options === undefined || !ts.isObjectLiteralExpression(options)) return new Set();
    const config = options.properties.find((property) => propertyName(property) === "config");
    if (config === undefined) return new Set();
    const configExpression = ts.isPropertyAssignment(config)
      ? config.initializer
      : ts.isShorthandPropertyAssignment(config)
        ? config.name
        : undefined;
    return configExpression === undefined ? new Set() : configuredFlags(configExpression);
  }

  function routeObjectFlags(options: ts.Expression | undefined): ReadonlySet<string> {
    if (options === undefined || !ts.isObjectLiteralExpression(options)) return new Set();
    const config = options.properties.find((property) => propertyName(property) === "config");
    const configExpression =
      config !== undefined && ts.isPropertyAssignment(config)
        ? config.initializer
        : config !== undefined && ts.isShorthandPropertyAssignment(config)
          ? config.name
          : undefined;
    return configExpression === undefined ? new Set() : configuredFlags(configExpression);
  }

  function routeObjectLabel(options: ts.Expression | undefined): string {
    if (options === undefined || !ts.isObjectLiteralExpression(options)) return "<unverified>";
    const method = options.properties.find((property) => propertyName(property) === "method");
    const url = options.properties.find((property) => propertyName(property) === "url");
    const methodValue =
      method !== undefined && ts.isPropertyAssignment(method) ? method.initializer : undefined;
    const urlValue =
      url !== undefined && ts.isPropertyAssignment(url) ? url.initializer : undefined;
    if (
      methodValue !== undefined &&
      ts.isStringLiteralLike(methodValue) &&
      urlValue !== undefined &&
      ts.isStringLiteralLike(urlValue)
    )
      return `${methodValue.text.toUpperCase()} ${urlValue.text}`;
    return "<unverified>";
  }

  function inspect(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      appAliases.has(node.expression.expression.text)
    ) {
      const methodName = node.expression.name.text;
      if (methodName === "register") {
        issues.push("REGISTER <unverified> (unsupported registration style)");
      } else if (methodName === "route") {
        const options = node.arguments[0];
        const label = routeObjectLabel(options);
        const flags = routeObjectFlags(options);
        const missing = ["authRequired", "scopeRequired"].filter((flag) => !flags.has(flag));
        if (missing.length > 0) {
          issues.push(`ROUTE ${label} (missing ${missing.join(", ")})`);
        }
      } else if (ROUTE_METHODS.has(methodName)) {
        const method = methodName.toUpperCase();
        const path = node.arguments[0];
        if (path === undefined || !ts.isStringLiteralLike(path)) {
          const flags = routeConfigFlags(node.arguments[1]);
          if (!flags.has("authRequired") || !flags.has("scopeRequired")) {
            issues.push(`${method} <dynamic> (path is not statically auditable)`);
          }
        } else if (path.text.startsWith("/local/")) {
          const route = `${method} ${path.text}`;
          if (!PUBLIC_LOCAL_ROUTES.has(route)) {
            const flags = routeConfigFlags(node.arguments[1]);
            const missing = ["authRequired", "scopeRequired"].filter((flag) => !flags.has(flag));
            if (missing.length > 0) issues.push(`${route} (missing ${missing.join(", ")})`);
          }
        }
      }
    }
    ts.forEachChild(node, inspect);
  }

  collectVariables(sourceFile);
  inspect(sourceFile);
  return issues.sort();
}

test("detects a business route fixture missing identity and scope checks", () => {
  const fixture = `
    const config = { authRequired: true, scopeRequired: true };
    app.get("/local/private-records", async () => []);
  `;

  assert.deepEqual(findUnprotectedLocalRoutes(fixture), [
    "GET /local/private-records (missing authRequired, scopeRequired)",
  ]);
});

test("accepts inherited authentication and scope flags but still requires both", () => {
  const fixture = `
    const config = { authRequired: true, scopeRequired: true };
    const memberConfig = { ...config, capabilityRequired: "memberships:read" };
    app.get("/local/memberships", { config: memberConfig }, async () => []);
    app.post("/local/unsafe", { config: { authRequired: true } }, async () => []);
  `;

  assert.deepEqual(findUnprotectedLocalRoutes(fixture), [
    "POST /local/unsafe (missing scopeRequired)",
  ]);
});

test("does not silently skip a new Fastify route registration style", () => {
  const fixture = `app.route({ method: "GET", url: "/local/private-records", config: { authRequired: true, scopeRequired: true }, handler });`;

  assert.deepEqual(findUnprotectedLocalRoutes(fixture), []);
});

test("detects route-object registrations without both guards", () => {
  const fixture = `app.route({ method: "GET", url: "/local/private-records", config: { authRequired: true }, handler });`;

  assert.deepEqual(findUnprotectedLocalRoutes(fixture), [
    "ROUTE GET /local/private-records (missing scopeRequired)",
  ]);
});

test("detects an unprotected route registered through an app alias", () => {
  const fixture = `
    const router = app;
    router.get("/local/private-records", async () => []);
  `;

  assert.deepEqual(findUnprotectedLocalRoutes(fixture), [
    "GET /local/private-records (missing authRequired, scopeRequired)",
  ]);
});

test("fails closed when route methods are detached from the app object", () => {
  const fixture = `
    const { route } = app;
    route({ method: "GET", url: "/local/private-records", handler });
  `;

  assert.deepEqual(findUnprotectedLocalRoutes(fixture), [
    "DESTRUCTURED_APP <unverified> (unsupported registration style)",
  ]);
});

test("does not silently skip a dynamic local route path", () => {
  const fixture = `app.get(localPath, { config }, async () => []);`;

  assert.deepEqual(findUnprotectedLocalRoutes(fixture), [
    "GET <dynamic> (path is not statically auditable)",
  ]);
});

test("all registered local business routes use both guards with only four public exemptions", () => {
  const routesPath = resolve(findWorkspaceRoot(), "apps/api/src/local-synthetic/routes.ts");
  const source = readFileSync(routesPath, "utf8");

  assert.deepEqual(findUnprotectedLocalRoutes(source), []);
  assert.deepEqual([...PUBLIC_LOCAL_ROUTES].sort(), [
    "GET /local/profiles",
    "GET /local/public-meals",
    "POST /local/login",
    "POST /local/sessions",
  ]);
});
