import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) => {
  try {
    return await readFile(new URL(path, import.meta.url), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

test("Taro visitor home shows owner-provided activity and teacher photos accessibly", async () => {
  const [page, style, imageModuleTypes, activityPhoto, outdoorPhoto, campusPhoto] =
    await Promise.all([
      read("../src/pages/visitor/home/index.tsx"),
      read("../src/pages/visitor/home/index.css"),
      read("../types/global.d.ts"),
      readFile(new URL("../src/assets/institution-activity-visit.jpg", import.meta.url)).catch(
        (error) => (error?.code === "ENOENT" ? null : Promise.reject(error)),
      ),
      readFile(new URL("../src/assets/teacher-team-outdoor.jpg", import.meta.url)).catch((error) =>
        error?.code === "ENOENT" ? null : Promise.reject(error),
      ),
      readFile(new URL("../src/assets/teacher-team-campus.jpg", import.meta.url)).catch((error) =>
        error?.code === "ENOENT" ? null : Promise.reject(error),
      ),
    ]);

  assert.match(page, /教师团队/u);
  assert.match(page, /institution-activity-visit\.jpg/u);
  assert.match(page, /institution-activity-photo/u);
  assert.match(page, /ariaLabel="同芯学园校园活动现场"/u);
  assert.match(page, /teacher-team-outdoor\.jpg/u);
  assert.match(page, /teacher-team-campus\.jpg/u);
  assert.match(page, /ariaLabel="同芯学园教师团队/u);
  assert.match(page, /mode="aspectFill"/u);
  assert.match(style, /\.teacher-team-photo\s*\{/u);
  assert.match(style, /\.institution-activity-photo\s*\{/u);
  assert.match(imageModuleTypes, /declare module ["']\*\.jpg["']/u);
  assert.ok(
    activityPhoto,
    "the owner-provided activity photo must be bundled with the Mini Program",
  );
  assert.ok(outdoorPhoto, "outdoor team photo must be bundled with the Mini Program");
  assert.ok(campusPhoto, "campus team photo must be bundled with the Mini Program");
  assert.deepEqual([...outdoorPhoto.subarray(0, 2)], [0xff, 0xd8]);
  assert.deepEqual([...campusPhoto.subarray(0, 2)], [0xff, 0xd8]);
  assert.deepEqual([...activityPhoto.subarray(0, 2)], [0xff, 0xd8]);
});
