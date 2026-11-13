import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";

const pageSource = readFileSync(
  new URL("../src/pages/platform-operations.ts", import.meta.url),
  "utf8",
);

test("platform support cards resolve and show the associated tenant label", () => {
  assert.ok(
    /snapshot\.tenants\.find\(\(candidate\) => candidate\.id === supportCase\.tenantId\)/u.test(
      pageSource,
    ),
  );
  assert.ok(/所属机构：\$\{tenant\?\.alias \?\? "机构关联缺失"\}/u.test(pageSource));
});
