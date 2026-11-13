import assert from "node:assert/strict";
import test from "node:test";
import { renderAdminResourceLibrary } from "../dist/local-review/resource-library.js";

const pendingResource = {
  id: "00000000-0000-4000-8000-000000000907",
  version: 1,
  title: "两位数加法练习卡",
  summary: "练习进位前先拆分数位。",
  grade: "三年级",
  subject: "数学",
  tags: ["两位数加法与进位"],
  scope: "CLASS",
  classId: "00000000-0000-4000-8000-000000000067",
  status: "PUBLISHED",
  expiresOn: "2027-03-31",
  sourceLabel: "校内教研组（合成示例）",
  ownerLabel: "示例东校区负责人",
  learningSourceGovernance: {
    collection: "SYNTHETIC_CAMPUS_MATH_SET",
    revision: "SYNTHETIC_2026_10_V1",
    reviewStatus: "PENDING_REVIEW",
    reviewedAt: null,
  },
};

test("pending learning sources show fixed review choices without learner or reviewer details", () => {
  const markup = renderAdminResourceLibrary({
    status: "READY",
    profile: "owner-east",
    actions: ["resource:manage"],
    classIds: [pendingResource.classId],
    resources: [pendingResource],
    summary: null,
    message: "已连接",
  });
  assert.match(markup, /合成资料集 SYNTHETIC_2026_10_V1 · 待复核/u);
  assert.match(markup, /data-learning-source-action="APPROVE"/u);
  assert.match(markup, /data-learning-source-action="RETURN"/u);
  assert.match(markup, /通过来源复核/u);
  assert.match(markup, /退回来源/u);
  assert.doesNotMatch(markup, /studentId|reviewerId|guardianId|学习者姓名/u);
});

test("reviewed sources show the outcome and date without repeat decision buttons", () => {
  const markup = renderAdminResourceLibrary({
    status: "READY",
    profile: "owner-east",
    actions: ["resource:manage"],
    classIds: [pendingResource.classId],
    resources: [
      {
        ...pendingResource,
        version: 2,
        learningSourceGovernance: {
          ...pendingResource.learningSourceGovernance,
          reviewStatus: "APPROVED",
          reviewedAt: "2026-10-10T01:00:00.000Z",
        },
      },
    ],
    summary: null,
    message: "来源已通过复核。",
  });
  assert.match(markup, /已通过 · 复核日期：2026-10-10/u);
  assert.doesNotMatch(markup, /data-learning-source-review/u);
});

test("returned sources stay out of the learning allowlist and cannot be reviewed again", () => {
  const markup = renderAdminResourceLibrary({
    status: "READY",
    profile: "owner-east",
    actions: ["resource:manage"],
    classIds: [pendingResource.classId],
    resources: [
      {
        ...pendingResource,
        version: 2,
        learningSourceGovernance: {
          ...pendingResource.learningSourceGovernance,
          reviewStatus: "RETURNED",
          reviewedAt: "2026-10-10T01:00:00.000Z",
        },
      },
    ],
    summary: null,
    message: "来源已退回。",
  });
  assert.match(markup, /已退回 · 复核日期：2026-10-10/u);
  assert.doesNotMatch(markup, /data-learning-source-review/u);
});
