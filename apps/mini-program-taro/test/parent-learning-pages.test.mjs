import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const read = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("parent learning home selects one approved child locally and renders only that summary", async () => {
  const page = await read("../src/pages/parent/home/index.tsx");
  const styles = await read("../src/pages/parent/home/index.css");

  assert.match(page, /selectParentLearningStudent\(projection, selectedStudentId\)/u);
  assert.match(page, /projection\.approvedStudents\.length > 1/u);
  assert.match(page, /setSelectedStudentId\(student\.studentId\)/u);
  assert.match(page, /selectedStudent && selectedSummary/u);
  assert.match(page, /useDidShow/u);
  assert.match(page, /hasShown\.current && initialLoadDone\.current/u);
  assert.match(page, /parent-button parent-button-secondary/u);
  assert.match(page, /重新读取/u);
  assert.doesNotMatch(page, /onClick=\{\(\) => \{[^}]*refresh\(/u);
  assert.match(styles, /\.parent-child-selector\b/u);
  assert.match(styles, /\.parent-child-option-active\b/u);
});

test("parent home exposes authenticated controls only for the selected approved child", async () => {
  const page = await read("../src/pages/parent/home/index.tsx");
  assert.match(page, /projection\?\.parentControls\?\.find/u);
  assert.match(page, /control\.studentId === selectedStudent\?\.studentId/u);
  assert.match(page, /selectedControl \? \(/u);
  assert.match(page, /<LearningControls/u);
  assert.match(page, /key=\{selectedControl\.studentId\}/u);
  assert.match(page, /saveParentLearningControls\(write, control, settings\)/u);
  assert.match(page, /requestParentLearningContact\(write, control\)/u);
  assert.match(page, /inviteSession\.postAuthenticated\(path, body\)/u);
  assert.match(page, /range=\{\["5 分钟", "10 分钟", "15 分钟"\]\}/u);
  assert.match(page, /仅记录联系意向/u);
  assert.doesNotMatch(page, /已通知教师|老师已收到|教师已收到/u);
});

test("control actions guard duplicate writes and discard obsolete page or account results", async () => {
  const page = await read("../src/pages/parent/home/index.tsx");
  assert.match(page, /if \(inFlight\.current \|\| disabled\) return/u);
  assert.match(page, /inFlight\.current = true/u);
  assert.match(
    page,
    /active\.current &&[\s\S]*?contextVersion\.current === version &&[\s\S]*?inviteSession\.snapshot === session/u,
  );
  assert.match(page, /if \(!isCurrent\(\)\) return;\s*onSaved\(result\)/u);
  assert.match(page, /disabled=\{disabled \|\| pending !== null\}/u);
  assert.match(page, /contextVersion\.current \+= 1;\s*setSelectedStudentId/u);
  assert.match(page, /async function switchAccount\(\) \{\s*contextVersion\.current \+= 1/u);
  assert.match(page, /setProjection\(null\)/u);
});

test("learning actions use compact centered brand buttons with room to wrap", async () => {
  const styles = await read("../src/pages/parent/home/index.css");
  assert.match(styles, /\.parent-control-actions\s*\{[^}]*display: flex;[^}]*flex-wrap: wrap;/u);
  assert.match(
    styles,
    /\.parent-control-actions \.parent-button\s*\{[^}]*width: auto;[^}]*max-width: 100%;/u,
  );
  assert.match(
    styles,
    /\.parent-button\s*\{[^}]*align-items: center;[^}]*justify-content: center;[^}]*background: #82b435;/u,
  );
});

test("the parent page owns the write lock and blocks switching or refreshing while a write is pending", async () => {
  const page = await read("../src/pages/parent/home/index.tsx");
  const parentPage = page.slice(page.indexOf("export default function ParentHomePage"));
  const controlsCard = page.slice(
    page.indexOf("function LearningControls"),
    page.indexOf("export default function ParentHomePage"),
  );
  assert.match(parentPage, /const controlWriteInFlight = useRef\(false\)/u);
  assert.match(parentPage, /inFlight=\{controlWriteInFlight\}/u);
  assert.match(
    parentPage,
    /if \(refreshInFlight\.current \|\| controlWriteInFlight\.current\) return/u,
  );
  assert.match(parentPage, /if \(controlWriteInFlight\.current\) return;\s*if \(selectedStudent/u);
  assert.match(parentPage, /disabled=\{refreshing \|\| controlBusy\}/u);
  assert.doesNotMatch(controlsCard, /const inFlight = useRef/u);
});
