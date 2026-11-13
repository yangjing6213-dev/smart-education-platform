import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

async function read(path) {
  try {
    return await readFile(new URL(path, import.meta.url), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

test("parent app registers the fixed-learning page", async () => {
  const config = await read("../src/app.config.ts");
  assert.match(config, /"pages\/parent\/learning\/index"/u);
});

test("parent home links the selected approved child to fixed learning", async () => {
  const page = await read("../src/pages/parent/home/index.tsx");
  assert.match(page, /function openParentFixedLearning\(studentId: string\)/u);
  assert.match(page, /\/pages\/parent\/learning\/index\?studentId=/u);
  assert.match(page, /selectedStudent && selectedControl/u);
  assert.match(page, /固定题目练习/u);
});

test("learning page gates the URL student through authenticated parent access and explicit consent", async () => {
  const page = await read("../src/pages/parent/learning/index.tsx");
  const client = await read("../src/learning/parent-learning-sessions.ts");
  assert.match(page, /useLoad/u);
  assert.match(page, /const authenticated = await inviteSession\.restore\(\)/u);
  assert.match(page, /hasRoleAccess\(authenticated, "PARENT"\)/u);
  assert.match(page, /resolveParentFixedLearningContext/u);
  assert.match(page, /loadParentBindingApplications/u);
  assert.match(page, /loadParentGuardianRelationships/u);
  assert.match(page, /Checkbox/u);
  assert.match(page, /grantLearningSupportConsent/u);
  assert.match(page, /revokeLearningSupportConsent/u);
  assert.match(page, /startFixedLearningSession/u);
  assert.match(page, /const activeSession = session\?\.status === "ACTIVE" \? session : null/u);
  assert.match(page, /requestNextLearningHint/u);
  assert.match(client, /expectedVersion: session\.version/u);
  assert.doesNotMatch(page, /<Input\b|<Textarea\b|<ImageUploader\b|needsTeacherFollowUp/u);
});
