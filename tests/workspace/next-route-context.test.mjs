import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

for (const [app, entry, methods] of [
  ["user-web", "api-local/[...path]", ["GET", "POST", "PATCH"]],
  ["admin-web", "api/admin/[...path]", ["GET", "POST", "PUT"]],
]) {
  test(`${app} route exports require asynchronous Next params`, () => {
    const directory = path.join(root, "apps", app);
    const configPath = path.join(directory, "next.tsconfig.json");
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    assert.equal(config.error, undefined);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, directory);
    assert.deepEqual(parsed.errors, []);
    const filename = path.join(directory, "__next_route_context_check__.ts");
    const content = [
      `import type * as route from "./src/app/${entry}/route.js";`,
      "type AsyncContext<T extends { readonly params: Promise<unknown> }> = T;",
      "type IsAny<T> = 0 extends (1 & T) ? true : false;",
      "type NotAny<T extends false> = T;",
      ...methods.flatMap((method) => [
        `export type ${method}Context = AsyncContext<Parameters<typeof route.${method}>[1]>;`,
        `export type ${method}KnownContext = NotAny<IsAny<Parameters<typeof route.${method}>[1]>>;`,
        `export type ${method}KnownParams = NotAny<IsAny<Parameters<typeof route.${method}>[1]["params"]>>;`,
      ]),
    ].join("\n");
    const options = { ...parsed.options, incremental: false, noEmit: true };
    const host = ts.createCompilerHost(options);
    const readSource = host.getSourceFile.bind(host);
    host.getSourceFile = (name, version, onError, createNew) =>
      path.resolve(name) === filename
        ? ts.createSourceFile(name, content, version, true)
        : readSource(name, version, onError, createNew);
    const program = ts.createProgram([filename], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => root,
        getCanonicalFileName: (name) => name,
        getNewLine: () => "\n",
      }),
    );
  });
}
