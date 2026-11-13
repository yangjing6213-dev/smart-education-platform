import type { LearningSession, ParentLearningSnapshot } from "../local-synthetic/learning.js";

const escape = (value: string | number) =>
  String(value).replace(
    /[&<>"']/gu,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );

function choiceButtons(
  choices: LearningSession["question"]["choices"],
  itemId: "main" | "practice-1" | "practice-2",
  disabled = false,
): string {
  return choices
    .map(
      (choice) =>
        `<button class="learning-choice" type="button" data-learning-answer="${itemId}" data-learning-choice="${choice.id}"${disabled ? " disabled" : ""}>${escape(choice.label)}</button>`,
    )
    .join("");
}

function activeSession(session: LearningSession, maxHintLevel = 3): string {
  const active = session.status === "ACTIVE";
  const nextHint = session.highestHintLevel + 1;
  const canOpenHint =
    active &&
    !session.mainCorrect &&
    !session.mainAttemptLimitReached &&
    nextHint <= Math.min(3, maxHintLevel) &&
    session.mainAttempts >= nextHint + 1 &&
    session.mainAttempts > session.lastHintAtAttempt;
  const main = !active
    ? `<p class="learning-result" role="status">${session.status === "HANDED_OFF" ? "教师已接手本次练习，学生不能继续提交答案。" : session.status === "EXPIRED" ? "练习时间已结束。" : "本次练习已结束。"}</p>`
    : session.mainCorrect
      ? '<p class="learning-result" role="status">已完成第一题，继续完成两道固定巩固题。</p>'
      : `<section class="learning-question"><p class="section-kicker">三年级 · 数学</p><h2>${escape(session.question.prompt)}</h2>${session.mainAttemptLimitReached ? '<p class="learning-follow-up" role="status">已达到本次练习尝试上限，请教师协助，或结束练习。</p>' : "<p>请由陪伴成人引导先尝试作答。</p>"}${session.mainAttemptLimit ? `<p>已尝试 ${escape(session.mainAttempts)} / ${escape(session.mainAttemptLimit)} 次</p>` : ""}<div class="learning-choices">${choiceButtons(session.question.choices, "main", session.mainAttemptLimitReached)}</div></section>`;
  const hint = session.visibleHint
    ? `<p class="learning-hint" role="status">第 ${session.visibleHint.level} 层提示：${escape(session.visibleHint.text)}</p>`
    : "";
  const hintAction = canOpenHint
    ? `<button class="button button-outline" type="button" data-learning-hint="${nextHint}">查看第 ${nextHint} 层提示</button>`
    : "";
  const practice =
    active && session.mainCorrect
      ? `<section class="learning-practice"><h2>巩固练习</h2>${session.consolidation
          .map(
            (item) =>
              `<article class="learning-practice-item"><h3>${escape(item.prompt)}</h3>${item.answered ? `<p class="learning-result">${item.correct ? "回答正确" : "已记录，建议请教师一起回顾"}</p>` : `<div class="learning-choices">${choiceButtons(item.choices, item.id)}</div>`}</article>`,
          )
          .join("")}</section>`
      : "";
  return `<section class="learning-session" data-learning-session><div class="learning-session-heading"><div><p class="section-kicker">${escape(session.studentLabel)} · 限时学习</p><h2>${active ? (session.mainAttemptLimitReached ? "等待教师协助" : "学习进行中") : session.status === "HANDED_OFF" ? "教师已接手" : session.status === "COMPLETED" ? "练习已完成" : session.status === "EXPIRED" ? "学习时间已结束" : "本次学习已关闭"}</h2><p>结束时间：${escape(new Date(session.endsAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }))}</p></div>${active ? '<button class="button button-outline" type="button" data-learning-close>结束并撤回本次同意</button>' : ""}</div>${main}${active ? hint : ""}<div class="learning-hint-actions">${hintAction}</div>${practice}${session.needsTeacherFollowUp ? '<p class="learning-follow-up" role="status">这次内容可由教师继续陪伴回顾，不作能力或纪律判断。</p>' : ""}</section>`;
}

function curatedKnowledge(resources: ParentLearningSnapshot["knowledgeResources"]): string {
  const rows = resources
    .map(
      (resource) =>
        `<article class="learning-history-item"><div><strong>${escape(resource.title)}</strong><p>${escape(resource.grade)} · ${escape(resource.subject)} · ${escape(resource.knowledgePoint)}</p><p>${escape(resource.summary)}</p><p>${escape(resource.content)}</p><p>来源：${escape(resource.sourceLabel)} · 版本 ${resource.version} · 有效期至 ${escape(resource.expiresOn)}</p></div></article>`,
    )
    .join("");
  return `<section class="learning-history learning-knowledge" data-learning-knowledge><h2>推荐学习资料</h2>${rows || '<p class="learning-intro">暂无匹配且在有效期内的资料。</p>'}</section>`;
}

export function renderParentLearningPage(snapshot: ParentLearningSnapshot): string {
  const teacher = snapshot.profile === "teacher-east";
  const ready = snapshot.status === "READY" || snapshot.status === "BUSY";
  const firstStudent = snapshot.approvedStudents[0];
  const firstControl = snapshot.parentControls?.find(
    (control) => control.studentId === firstStudent?.studentId,
  );
  const initialDuration =
    !teacher && firstControl && firstControl.maxDurationMinutes < 10
      ? firstControl.maxDurationMinutes
      : 10;
  const canParentStart = teacher || firstControl?.enabled === true;
  const durationOption = (minutes: 5 | 10 | 15) => {
    const selected = initialDuration === minutes ? "selected" : "";
    const disabled =
      !teacher && (!firstControl || minutes > firstControl.maxDurationMinutes) ? "disabled" : "";
    return `<option value="${minutes}" ${selected} ${disabled}>${minutes} 分钟</option>`;
  };
  const studentOptions = snapshot.approvedStudents
    .map(
      (student) =>
        `<option value="${escape(student.studentId)}">${escape(student.studentLabel)} · ${escape(student.classLabel)}</option>`,
    )
    .join("");
  const openForm = snapshot.activeSession
    ? ""
    : `<form class="learning-open-form" data-learning-open-form><label for="learning-student">${teacher ? "负责班级学生" : "已审核通过的学生关系"}</label><select id="learning-student" name="studentId" required ${!ready || snapshot.approvedStudents.length === 0 ? "disabled" : ""}>${studentOptions || '<option value="">暂无可用学生</option>'}</select><label for="learning-duration">本次时长</label><select id="learning-duration" name="durationMinutes">${durationOption(5)}${durationOption(10)}${durationOption(15)}</select><label class="learning-consent"><input type="checkbox" name="consent" required>我同意本次限时数学练习由成人陪同，不用于能力或纪律评价</label><p>只提供固定三年级数学题和本机讲解；不收集自由输入或照片。遇到超出范围的问题，由教师接手。</p><button class="button button-primary" type="submit" ${!ready || snapshot.approvedStudents.length === 0 || !canParentStart ? "disabled" : ""}>开始陪伴学习</button></form>`;
  const sessions =
    !teacher && snapshot.sessions.length
      ? `<section class="learning-history"><h2>本机学习记录</h2>${snapshot.sessions
          .filter(
            (session) => session.id !== snapshot.activeSession?.id && session.status !== "ACTIVE",
          )
          .map(
            (session) =>
              `<article class="learning-history-item"><div><strong>${escape(session.studentLabel)}</strong><p>${session.status === "HANDED_OFF" ? "教师已接手" : session.status === "COMPLETED" ? "练习已完成" : session.status === "EXPIRED" ? "已结束" : "已关闭"}</p></div><button class="button button-outline" type="button" data-learning-delete="${escape(session.id)}">删除本条记录</button></article>`,
          )
          .join("")}</section>`
      : "";
  const teacherSummary = teacher
    ? `<section class="learning-history teacher-summary" data-learning-summary><h2>本班学习摘要</h2>${
        (snapshot.teacherSummary ?? [])
          .map(
            (item) =>
              `<article class="learning-history-item"><div><strong>${escape(item.studentLabel)}</strong><p>${escape(item.grade)} · ${escape(item.subject)} · ${escape(item.knowledgePoint)}</p><p>${item.status === "ACTIVE" ? "进行中" : item.status === "HANDED_OFF" ? "教师已接手" : item.status === "COMPLETED" ? "已完成" : item.status === "EXPIRED" ? "已结束" : "已关闭"} · ${item.highestHintLevel < 0 ? "尚未查看提示" : `已查看第 ${item.highestHintLevel} 层提示`}</p><p>${item.needsTeacherFollowUp ? "建议教师继续关注" : "无需额外跟进"}</p></div>${item.status === "ACTIVE" ? `<button class="button button-outline" type="button" data-learning-handoff="${escape(item.id)}">教师接手并陪伴处理</button>` : item.status === "HANDED_OFF" ? `<button class="button button-outline" type="button" data-learning-delete="${escape(item.id)}">删除接手记录</button>` : ""}</article>`,
          )
          .join("") || '<p class="learning-intro">负责班级暂时没有学习记录。</p>'
      }</section>`
    : "";
  const parentControls = !teacher
    ? `<section class="learning-history learning-controls" data-learning-parent-controls><h2>学习监督设置</h2>${
        (snapshot.parentControls ?? [])
          .map(
            (control) =>
              `<article class="learning-control-item"><strong>${escape(control.studentLabel)}</strong><form class="learning-control-form" data-learning-control-form data-student-id="${escape(control.studentId)}"><label class="learning-control-toggle"><input type="checkbox" name="enabled" ${control.enabled ? "checked" : ""}>开启陪伴学习</label><label for="learning-max-duration-${escape(control.studentId)}">单次最长时长</label><select id="learning-max-duration-${escape(control.studentId)}" name="maxDurationMinutes"><option value="5" ${control.maxDurationMinutes === 5 ? "selected" : ""}>5 分钟</option><option value="10" ${control.maxDurationMinutes === 10 ? "selected" : ""}>10 分钟</option><option value="15" ${control.maxDurationMinutes === 15 ? "selected" : ""}>15 分钟</option></select><label for="learning-max-hint-${escape(control.studentId)}">最高提示层级</label><select id="learning-max-hint-${escape(control.studentId)}" name="maxHintLevel"><option value="0" ${control.maxHintLevel === 0 ? "selected" : ""}>第 0 层</option><option value="1" ${control.maxHintLevel === 1 ? "selected" : ""}>第 1 层</option><option value="2" ${control.maxHintLevel === 2 ? "selected" : ""}>第 2 层</option><option value="3" ${control.maxHintLevel === 3 ? "selected" : ""}>第 3 层</option></select><button class="button button-primary" type="submit">保存设置</button></form><button class="button button-outline learning-contact" type="button" data-learning-contact="${escape(control.studentId)}" ${control.contactStatus === "RECORDED_LOCAL" ? "disabled" : ""}>${control.contactStatus === "RECORDED_LOCAL" ? "已记录联系意向" : "联系教师"}</button><p class="learning-contact-note">${control.contactStatus === "RECORDED_LOCAL" ? "本机已记录联系意向，尚未发送消息。" : "联系意向仅保存在本机，不会自动发送消息。"}</p></article>`,
          )
          .join("") || '<p class="learning-intro">审核通过学生关系后，可在这里设置陪伴学习。</p>'
      }</section>`
    : "";
  const parentSummaryUpdatedAt = snapshot.parentSummaryUpdatedAt
    ? new Date(snapshot.parentSummaryUpdatedAt).toLocaleString("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "尚未更新";
  const parentSummaryRows = (snapshot.parentSummary ?? [])
    .map(
      (item) =>
        `<article class="learning-history-item"><div><strong>${escape(item.studentLabel)}</strong><p>累计练习 ${item.usedMinutes} 分钟 · 共练习 ${item.sessionCount} 次 · 已完成 ${item.completedSessions} 次</p>${item.knowledgePoints.map((point) => `<p>知识点：${escape(point.label)} · ${point.completedSessions}/${point.sessionCount} 次完成</p>`).join("")}${item.attentionCount > 0 ? `<p>教师已接手 ${item.attentionCount} 条练习记录</p>` : ""}</div></article>`,
    )
    .join("");
  const parentSummary =
    !teacher && snapshot.approvedStudents.length > 0
      ? `<section class="learning-history" data-parent-learning-summary><h2>孩子学习摘要</h2><p>来源：本机学习记录 · 更新时间：${escape(parentSummaryUpdatedAt)}</p>${parentSummaryRows || '<p class="learning-intro">暂无学习摘要。</p>'}</section>`
      : "";
  const teacherContacts = teacher
    ? `<section class="learning-history" data-learning-parent-contacts><h2>家长联系意向</h2>${
        (snapshot.parentContactIntents ?? [])
          .map(
            (intent) =>
              `<article class="learning-history-item"><div><strong>${escape(intent.studentLabel)}</strong><p>已记录家长联系意向 · ${escape(new Date(intent.createdAt).toLocaleDateString("zh-CN"))}</p><p>仅为本机记录，未发送消息。</p></div></article>`,
          )
          .join("") || '<p class="learning-intro">目前没有家长联系意向。</p>'
      }</section>`
    : "";
  const backLink = teacher
    ? "/staff/workbench?mode=shared&amp;profile=teacher-east"
    : "/web/parent/home?mode=shared&amp;profile=parent-alpha";
  const showKnowledge = teacher || snapshot.approvedStudents.length > 0;
  const activeControl = snapshot.parentControls?.find(
    (control) => control.studentId === snapshot.activeSession?.studentId,
  );
  return `<main class="visitor-main parent-learning-main"><article class="content-page visitor-content-page"><a class="button button-outline learning-back" href="${backLink}">返回${teacher ? "员工" : "家长"}工作台</a><p class="section-kicker">${teacher ? "教师端 · 负责班级" : "家长服务"} · 本机合成数据</p><h1>陪伴式学习</h1><p class="learning-intro">成人开启并陪伴完成。学生先尝试，再按顺序查看固定提示，最后完成巩固题。</p><p class="learning-safety-note">只提供固定题库和本机讲解，不调用正式 AI，不接收开放输入；成人可结束本次练习，教师可在授权班级范围内接手。</p><p class="status-message" role="status" aria-live="polite" data-learning-status>${escape(snapshot.message)}</p>${parentSummary}${parentControls}${snapshot.activeSession ? activeSession(snapshot.activeSession, teacher ? 3 : (activeControl?.maxHintLevel ?? 3)) : openForm}${showKnowledge ? curatedKnowledge(snapshot.knowledgeResources) : ""}${teacherSummary}${teacherContacts}${sessions}</article></main>`;
}
