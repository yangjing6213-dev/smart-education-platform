import assert from "node:assert/strict";
import test from "node:test";
import { renderAdminLeaveReview } from "../dist/pages/leave-review.js";

const request = {
  id: "00000000-0000-4000-8000-000000000321",
  version: 1,
  status: "SUBMITTED",
  startDate: "2026-12-01",
  endDate: "2026-12-02",
  reason: "FAMILY_ARRANGEMENT",
  acknowledged: false,
  studentLabel: "示例学生甲",
  guardianLabel: "示例监护人甲",
};

test("shared leave review renders only records returned by the scoped service", () => {
  const view = renderAdminLeaveReview({
    status: "READY",
    profile: "owner-east",
    records: [request],
    message: "申请列表已更新。",
  });

  assert.match(view, /示例学生甲/u);
  assert.match(view, /示例监护人甲/u);
  assert.match(view, /2026-12-01/u);
  assert.match(view, /data-admin-leave-id="00000000-0000-4000-8000-000000000321"/u);
  assert.match(view, /data-version="1"/u);
  assert.doesNotMatch(view, /演示角色|平台管理员/u);
  assert.doesNotMatch(view, /leave-admin-synthetic/u);
});

test("shared leave review disables actions for processed records and shows service states", () => {
  const view = renderAdminLeaveReview({
    status: "READY",
    profile: "owner-east",
    records: [{ ...request, status: "CONFIRMED", version: 2, acknowledged: true }],
    message: "申请列表已更新。",
  });

  assert.match(view, /已通过/u);
  assert.match(view, /不能重复审核/u);
  assert.doesNotMatch(view, /data-decision="CONFIRM"/u);
});

test("read-only campus view keeps application details visible but disables review actions", () => {
  const view = renderAdminLeaveReview(
    {
      status: "READY",
      profile: "owner-east",
      records: [request],
      message: "申请列表已更新。",
    },
    false,
  );

  assert.match(view, /data-decision="CONFIRM" disabled/u);
  assert.match(view, /data-decision="RETURN" disabled/u);
});

test("shared leave review explains loading, empty, and disconnected states", () => {
  assert.match(
    renderAdminLeaveReview({
      status: "CONNECTING",
      profile: "owner-east",
      records: [],
      message: "正在连接。",
    }),
    /正在连接/u,
  );
  assert.match(
    renderAdminLeaveReview({
      status: "READY",
      profile: "owner-east",
      records: [],
      message: "申请列表已更新。",
    }),
    /当前校区暂无请假申请/u,
  );
  assert.match(
    renderAdminLeaveReview({
      status: "ERROR",
      profile: null,
      records: [],
      message: "本机审核服务暂不可用。",
    }),
    /本机审核服务暂不可用/u,
  );
});
