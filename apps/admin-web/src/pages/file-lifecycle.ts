import {
  MEDIA_ASSET_PROFILE_OPTIONS,
  type MediaAssetRow,
  type MediaAssetSummaryRow,
  type MediaAssetsAdminSnapshot,
} from "../local-review/media-assets.js";

const escape = (value: string | number) =>
  String(value).replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });

const STATUS_LABEL: Record<MediaAssetRow["status"], string> = {
  AVAILABLE: "可用",
  REFERENCED: "已引用",
  EXPIRED: "已过期",
  ARCHIVED: "已归档",
  REVOKED: "已撤回",
  DELETED: "本机软删除",
};

const TYPE_LABEL = { IMAGE: "图片占位素材", DOCUMENT: "文档占位素材" } as const;

function renderSummary(summary: MediaAssetSummaryRow): string {
  const metrics: ReadonlyArray<readonly [string, number]> = [
    ["合成素材总数", summary.total],
    ["可用", summary.available],
    ["已引用", summary.referenced],
    ["已过期", summary.expired],
    ["已归档", summary.archived],
    ["已撤回", summary.revoked],
    ["本机软删除", summary.deleted],
  ];
  return `<section class="panel" aria-label="匿名文件汇总"><h2>匿名汇总</h2><p>平台管理员只查看合成数量，不显示文件名称、校区、引用位置或个人资料。</p><dl class="meta">${metrics.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl></section>`;
}

function renderReplacement(
  asset: MediaAssetRow,
  targets: readonly MediaAssetRow[],
  editable: boolean,
): string {
  if (asset.references.length === 0) return "";
  const options = targets
    .filter(
      (target) =>
        target.id !== asset.id && target.type === asset.type && target.status === "AVAILABLE",
    )
    .map(
      (target) =>
        `<option value="${escape(target.id)}">${escape(target.title)} · v${target.version}</option>`,
    )
    .join("");
  return asset.references
    .map(
      (reference) =>
        `<div class="form-row"><label for="media-target-${escape(reference.id)}">替换“${escape(reference.label)}”引用</label><select id="media-target-${escape(reference.id)}" data-media-target="${escape(reference.id)}"${options ? "" : " disabled"}><option value="">选择同类型可用素材</option>${options}</select><button type="button" data-media-action="replace" data-media-id="${escape(asset.id)}" data-media-version="${asset.version}" data-media-reference="${escape(reference.id)}"${editable && Boolean(options) ? "" : " disabled"}>替换这处引用</button></div>`,
    )
    .join("");
}

function renderAsset(
  asset: MediaAssetRow,
  assets: readonly MediaAssetRow[],
  editable: boolean,
  canCheck: boolean,
): string {
  const references = asset.references.length
    ? `<ul>${asset.references.map((reference) => `<li>${escape(reference.label)} · ${escape(reference.kind)}</li>`).join("")}</ul>`
    : "<p>暂无引用</p>";
  const active = ["AVAILABLE", "REFERENCED", "EXPIRED"].includes(asset.status);
  const hasReferences = asset.references.length > 0;
  const confirmation = hasReferences
    ? `<label><input type="checkbox" data-media-confirm="${escape(asset.id)}"${editable ? "" : " disabled"}>确认撤回会影响仍引用此素材的页面</label>`
    : "";
  const access = `<button type="button" data-media-action="access" data-media-id="${escape(asset.id)}" data-media-version="${asset.version}"${canCheck ? "" : " disabled"}>校验查看权限</button>`;
  const archive =
    asset.status === "AVAILABLE" || asset.status === "EXPIRED"
      ? `<button type="button" data-media-action="archive" data-media-id="${escape(asset.id)}" data-media-version="${asset.version}"${editable && !hasReferences ? "" : " disabled"}>归档</button>`
      : "";
  const revoke = active
    ? `<div>${confirmation}<button type="button" data-media-action="revoke" data-media-id="${escape(asset.id)}" data-media-version="${asset.version}"${editable && (!hasReferences || false) ? "" : " disabled"}>撤回素材</button></div>`
    : "";
  const remove =
    asset.status === "ARCHIVED"
      ? `<button type="button" data-media-action="delete" data-media-id="${escape(asset.id)}" data-media-version="${asset.version}"${editable && !hasReferences ? "" : " disabled"}>标记为软删除</button>`
      : "";
  return `<article class="panel" data-media-asset="${escape(asset.id)}"><h2>${escape(asset.title)}</h2><p>合成代号：${escape(asset.alias)} · ${TYPE_LABEL[asset.type]}</p><p>状态：<strong>${STATUS_LABEL[asset.status]}</strong> · 有效期至 ${escape(asset.expiresOn)} · 版本 ${asset.version}</p><h3>当前引用</h3>${references}${renderReplacement(asset, assets, editable)}<div class="form-row">${access}${archive}${revoke}${remove}</div></article>`;
}

export function renderFileLifecycle(
  snapshot: MediaAssetsAdminSnapshot,
  selectedProfile: string,
  readOnly: boolean,
): string {
  const profileOptions = MEDIA_ASSET_PROFILE_OPTIONS.map(
    ([profile, label]) =>
      `<option value="${profile}"${selectedProfile === profile ? " selected" : ""}>${label}</option>`,
  ).join("");
  const canManage =
    !readOnly && snapshot.status === "READY" && snapshot.actions.includes("media:manage");
  const canCheck =
    !readOnly &&
    snapshot.status === "READY" &&
    (snapshot.actions.includes("media:read") || snapshot.actions.includes("media:manage"));
  const summary =
    snapshot.profile === "platform-admin" && snapshot.summary
      ? renderSummary(snapshot.summary)
      : "";
  const assets =
    snapshot.assets.length > 0 && snapshot.profile !== "platform-admin"
      ? snapshot.assets.length
        ? `<section aria-label="本校区合成素材">${snapshot.assets.map((asset) => renderAsset(asset, snapshot.assets, canManage, canCheck)).join("")}</section>`
        : `<section class="panel"><p>当前范围没有合成素材。</p></section>`
      : "";
  const events =
    snapshot.profile !== "platform-admin" &&
    (snapshot.status === "READY" || snapshot.status === "ERROR")
      ? `<section class="panel" aria-label="本机文件操作记录"><h2>本机操作记录</h2><p>只记录合成代号、动作、结果和时间，不保存文件内容或地址。</p>${snapshot.events.length ? `<ul>${snapshot.events.map((event) => `<li>${escape(event.occurredAt)} · ${escape(event.actorProfile)} · ${escape(event.action)} · ${escape(event.outcome)} · ${escape(event.assetAlias)}</li>`).join("")}</ul>` : "<p>暂无本机操作记录。</p>"}</section>`
      : "";
  return `<div class="shell"><header class="topbar"><strong class="brand">同芯学园 · 文件管理</strong></header><main class="review-main" id="file-lifecycle"><section class="panel"><h1>文件与引用管理</h1><p class="notice">合成数据 · 本机演示 · 不是真实文件；不支持真实上传或下载。</p><label for="media-profile">本机演示身份</label><select id="media-profile" data-media-profile>${profileOptions}</select><button type="button" data-media-refresh${snapshot.status === "CONNECTING" || snapshot.status === "BUSY" ? " disabled" : ""}>刷新</button><p role="status" aria-live="polite" data-media-message>${escape(snapshot.message)}</p><p>平台管理员只看到匿名汇总；负责人只看到当前租户和校区的固定占位素材。</p><p>只读模式由本页面禁用操作；服务权限仍按本机合成身份核验。</p></section>${summary}${assets}${events}</main></div>`;
}
