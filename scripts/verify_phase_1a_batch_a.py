#!/usr/bin/env python3
"""Verify the approved Phase 1A Batch A repository and review package."""

from __future__ import annotations

import hashlib
import os
import re
import stat
import struct
import subprocess
import sys
import zipfile
import zlib
from collections import Counter
from datetime import date
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
BT = chr(96)
CONTRACT = "PHASE_1A_BATCH_A_CODEX_EXECUTION.md"
CONTRACT_SHA256 = "892521A36DF3A3A1E76C3923E00705E6F9405515020701279F2AB328F00436AC"
COMMIT_1 = "f5007721a33cd000019feb9bea50de6e1d610eb8"
COMMIT_2 = "51bb197dea7e19bea068465cb37b8375add3d5fe"
COMMIT_3 = "61acddcbd2a89f15f83e6517063555c298668c9b"
EXPECTED_HEAD = "61acddcbd2a89f15f83e6517063555c298668c9b"
EXPECTED_BRANCH = "planning/phase-1a-batch-a"
EXPECTED_COMMITS = [
    (COMMIT_1, "chore: establish phase 1a project governance"),
    (COMMIT_2, "docs: define phase 1a batch a product baseline"),
    (COMMIT_3, "docs: draft platform architecture and ai safety"),
]

GOVERNANCE_FILES = {
    ".gitignore",
    "AGENTS.md",
    CONTRACT,
    "PLANS.md",
    "README.md",
    "docs/agents/PRODUCT_MANAGER.md",
    "docs/agents/QA_SECURITY_AGENT.md",
    "docs/agents/TECH_LEAD.md",
    "docs/agents/UI_UX_AGENT.md",
    "docs/plans/PHASE_1A_BATCH_A_EXEC_PLAN.md",
    "docs/project/CHANGE_CONTROL.md",
    "docs/project/DECISION_BASELINE.md",
    "docs/project/PROJECT_CHARTER.md",
    "docs/project/RESPONSIBILITY_MATRIX.md",
    "docs/project/SCOPE_AND_NON_SCOPE.md",
    "docs/project/TERMINOLOGY.md",
    "docs/reviews/BLOCKERS.md",
    "docs/templates/REVIEW_RECEIPT.md",
    "docs/templates/TASK_CONTRACT.md",
}

PRODUCT_FILES = {
    "docs/product/ACCEPTANCE_CRITERIA.md",
    "docs/product/CONTENT_SCHEMA.md",
    "docs/product/ENDPOINT_MATRIX.md",
    "docs/product/PAGE_INVENTORY.md",
    "docs/product/PLATFORM_PRD.md",
    "docs/product/ROLE_MATRIX.md",
    "docs/product/STATE_MODEL.md",
    "docs/product/USER_FLOWS.md",
    "docs/product/V0_1_PRD.md",
}

ARCHITECTURE_FILES = {
    "docs/architecture/API_BOUNDARIES_DRAFT.md",
    "docs/architecture/DATA_MODEL_DRAFT.md",
    "docs/architecture/ENVIRONMENTS_AND_DEPLOYMENT_DRAFT.md",
    "docs/architecture/FILE_STORAGE_DRAFT.md",
    "docs/architecture/IDENTITY_AND_AUTHORIZATION_DRAFT.md",
    "docs/architecture/MODULE_BOUNDARIES_DRAFT.md",
    "docs/architecture/MULTI_TENANCY_DRAFT.md",
    "docs/architecture/SECURITY_AND_PRIVACY_DRAFT.md",
    "docs/architecture/SYSTEM_ARCHITECTURE_DRAFT.md",
}

AI_FILES = {
    "docs/ai/AI_EVALUATION_DRAFT.md",
    "docs/ai/AI_LEARNING_ASSISTANT_PRODUCT_SPEC.md",
    "docs/ai/AI_LEARNING_FLOW.md",
    "docs/ai/AI_SAFETY_BASELINE.md",
}

PROTOTYPE_FILES = {
    "prototypes/low-fidelity/index.html",
    "prototypes/low-fidelity/scripts/app.js",
    "prototypes/low-fidelity/styles/main.css",
}

VERIFIER = "scripts/verify_phase_1a_batch_a.py"
A5_FILES = GOVERNANCE_FILES | PRODUCT_FILES | ARCHITECTURE_FILES | AI_FILES | PROTOTYPE_FILES | {VERIFIER}

REVIEW_REPORT = "docs/reviews/PHASE_1A_BATCH_A_REVIEW.md"
FILE_INVENTORY = "docs/reviews/FILE_INVENTORY.md"
ROOT_MANIFEST = "SHA256SUMS.txt"
ZIP_PATH = "artifacts/review-package/student-care-platform-phase1a-batch-a-review-pack-v1.0.zip"
A6_ARTIFACTS = {REVIEW_REPORT, FILE_INVENTORY, ROOT_MANIFEST, ZIP_PATH}

SCREENSHOTS = {
    "artifacts/screenshots/admin-dashboard.png",
    "artifacts/screenshots/flow-ai-learning-assistant.png",
    "artifacts/screenshots/flow-guardian-binding.png",
    "artifacts/screenshots/flow-teacher-daily-report.png",
    "artifacts/screenshots/mini-visitor-home.png",
    "artifacts/screenshots/web-visitor-home.png",
}

ZIP_BASE = A5_FILES | {REVIEW_REPORT, FILE_INVENTORY, ROOT_MANIFEST}
ZIP_LIST_SHA256 = {
    48: "83284EBE80A69492CFB679B7C1E5C5926BE754186E8E11E218E207E2C4250A6E",
    54: "36EBB5D0F829B164D8B9130EB70DD259F5A6D4EFB0A8752D5D9B56D0788C58D6",
}

REPORT_HEADINGS = {
    "执行摘要",
    "已完成范围",
    "未完成范围",
    "文件统计",
    "关键决策",
    "原型页面清单",
    "验证命令",
    "验证结果",
    "截图清单",
    "Git提交",
    "工作区状态",
    "发现的风险",
    "已知限制",
    "阻塞项",
    "下一步建议",
    "明确停止声明",
}

STOP_EVENTS = {
    "合同缺失或SHA不符",
    "未授权文件/无关工程/额外提交",
    "权威来源实质冲突",
    "真实数据或生产密钥",
    "跨租户或未成年人风险",
    "需要依赖、外部API、支付、正式AI、远程或部署",
    "验证失败",
    "要求批次B或Phase 1B",
}

ENDPOINT_HEADER = [
    "功能",
    "访客小程序",
    "访客网页",
    "家长小程序",
    "家长网页",
    "教师小程序",
    "教师网页",
    "机构管理网页",
    "阶段",
]
ENDPOINT_STAGES = Counter(
    {
        "V0.1正式开发": 24,
        "后续关键流程原型": 12,
        "未来结构预留": 10,
    }
)

ROLE_NAMES = {
    "ROLE-VISITOR": "访客",
    "ROLE-GUARDIAN": "家长",
    "ROLE-TEACHER": "教师",
    "ROLE-STAFF": "工作人员",
    "ROLE-INSTITUTION-ADMIN": "机构管理员",
    "ROLE-CAMPUS-LEAD": "校区负责人",
    "ROLE-PLATFORM-ADMIN": "平台管理员",
}

INVENTORY_HEADER = [
    "页面ID",
    "页面名称",
    "路由",
    "端",
    "角色",
    "阶段",
    "入口",
    "主要区域",
    "主要操作",
    "可操作状态",
    "空状态",
    "错误状态",
    "权限要求",
    "数据对象",
    "验收点",
]
INVENTORY_COUNTS = {
    "A-MP": 20,
    "A-WEB": 13,
    "A-ADM": 14,
    "B-FLOW": 12,
    "C-RES": 10,
}

V01_OBJECTS = {
    "Tenant",
    "Campus",
    "User",
    "Membership",
    "Role",
    "Permission",
    "InstitutionProfile",
    "TeacherProfile",
    "GuideArticle",
    "TeachingResource",
    "PartnerCloudLink",
    "Activity",
    "MealPlan",
    "MediaAsset",
    "AuditLog",
}

FUTURE_OBJECTS = {
    "Student",
    "GuardianRelationship",
    "BindingApplication",
    "Attendance",
    "LeaveRequest",
    "PickupAuthorization",
    "PickupRecord",
    "HealthIncident",
    "WorkTask",
    "TeacherDailyReport",
    "FeeRecord",
    "AIStudySession",
    "AIHint",
    "KnowledgePoint",
    "PracticeResult",
    "GuardianConsent",
}

API_ROUTES = {
    "GET /public/institutions/{publicSlug}",
    "GET /public/activities",
    "GET /staff/guides",
    "GET /staff/resources?query=...",
    "GET /staff/partner-cloud-links/{id}/entry-check",
    "POST /admin/content/{type}",
    "POST /admin/content/{id}:publish",
    "POST /files/upload-intents",
    "POST /files/{id}:complete",
    "POST /admin/content/{id}:unpublish",
    "POST /onboarding/binding-applications",
    "GET /onboarding/binding-applications/{id}",
    "POST /admin/binding-applications/{id}:approve",
    "POST /teacher/tasks/{id}:start",
    "POST /teacher/daily-reports/{id}:submit",
    "POST /ai/study-sessions",
    "POST /ai/study-sessions/{id}/attempts",
    "POST /ai/study-sessions/{id}/hints",
    "GET /teacher/ai-study-summaries/{id}",
    "POST /guardian/ai-deletion-requests",
}

AI_PROHIBITIONS = {
    "答案倾倒",
    "代写作业",
    "帮助作弊",
    "开放式万能聊天",
    "情感陪伴",
    "虚拟好友",
    "心理诊断",
    "情绪识别",
    "自动能力标签",
    "自动纪律",
    "未经教师或家长确认发送敏感结论",
}


class VerificationError(Exception):
    """A deterministic verification failure."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def read_text(relative_path: str, *, nonempty: bool = True) -> str:
    path = ROOT / relative_path
    require(path.is_file(), f"missing required file: {relative_path}")
    data = path.read_bytes()
    require(not data.startswith(b"\xef\xbb\xbf"), f"UTF-8 BOM is forbidden: {relative_path}")
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as error:
        raise VerificationError(f"not strict UTF-8: {relative_path}: {error}") from error
    if nonempty:
        require(bool(text.strip()), f"empty required file: {relative_path}")
    return text


def git(*arguments: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", *arguments],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="strict",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip()
        raise VerificationError(f"git {' '.join(arguments)} failed ({result.returncode}): {detail}")
    return result


def clean_cell(value: str) -> str:
    return value.strip().strip(BT).strip()


def markdown_rows(text: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not (stripped.startswith("|") and stripped.endswith("|")):
            continue
        cells = [clean_cell(cell) for cell in stripped[1:-1].split("|")]
        if cells and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            continue
        rows.append(cells)
    return rows


def expected_ids(prefix: str, count: int) -> set[str]:
    return {f"{prefix}-{number:02d}" for number in range(1, count + 1)}


def zip_member_is_safe(name: str) -> bool:
    if not name or "\x00" in name or "\\" in name or name.endswith("/"):
        return False
    if name.startswith("/") or re.match(r"^[A-Za-z]:", name):
        return False
    parts = name.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        return False
    normalized = PurePosixPath(name).as_posix()
    return normalized == name and not PurePosixPath(name).is_absolute()


def zip_info_is_regular(info: zipfile.ZipInfo) -> bool:
    if info.is_dir():
        return False
    if info.create_system == 3:
        file_type = stat.S_IFMT((info.external_attr >> 16) & 0xFFFF)
        return file_type in {0, stat.S_IFREG}
    if info.create_system == 0:
        dos_attributes = info.external_attr & 0xFF
        return not dos_attributes & (0x10 | 0x40)
    return False


def parse_sha256s(text: str) -> dict[str, str]:
    require(not text.startswith("\ufeff"), "manifest must not contain a UTF-8 BOM")
    require("\r" not in text, "manifest must use LF line endings")
    require(text.endswith("\n") and not text.endswith("\n\n"), "manifest must have exactly one final LF")
    result: dict[str, str] = {}
    for line_number, line in enumerate(text[:-1].split("\n"), start=1):
        match = re.fullmatch(r"([0-9A-Fa-f]{64})  (.+)", line)
        require(match is not None, f"invalid manifest line {line_number}")
        digest, name = match.groups()
        require(zip_member_is_safe(name), f"unsafe manifest path: {name}")
        require(name not in result, f"duplicate manifest path: {name}")
        result[name] = digest.upper()
    require(bool(result), "manifest must not be empty")
    return result


def member_list_sha(names: set[str]) -> str:
    payload = "".join(f"{name}\n" for name in sorted(names)).encode("utf-8")
    return sha256_bytes(payload)


def validate_png_bytes(data: bytes, label: str) -> None:
    signature = b"\x89PNG\r\n\x1a\n"
    require(data.startswith(signature), f"invalid PNG signature: {label}")
    offset = len(signature)
    ihdr: tuple[int, int, int, int, int, int, int] | None = None
    idat_parts: list[bytes] = []
    chunk_number = 0
    saw_iend = False

    while offset < len(data):
        require(len(data) - offset >= 12, f"truncated PNG chunk: {label}")
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        chunk_type = data[offset + 4:offset + 8]
        require(re.fullmatch(rb"[A-Za-z]{4}", chunk_type) is not None, f"invalid PNG chunk type: {label}")
        end = offset + 12 + length
        require(end <= len(data), f"truncated PNG chunk data: {label}")
        payload = data[offset + 8:offset + 8 + length]
        stored_crc = struct.unpack(">I", data[offset + 8 + length:end])[0]
        actual_crc = zlib.crc32(chunk_type)
        actual_crc = zlib.crc32(payload, actual_crc) & 0xFFFFFFFF
        require(stored_crc == actual_crc, f"PNG chunk CRC mismatch: {label}")
        chunk_number += 1

        if chunk_type == b"IHDR":
            require(chunk_number == 1 and ihdr is None and length == 13, f"invalid PNG IHDR: {label}")
            ihdr = struct.unpack(">IIBBBBB", payload)
            width, height, bit_depth, color_type, compression, filter_method, interlace = ihdr
            require(
                1 <= width <= 8192 and 1 <= height <= 8192 and width * height <= 25_000_000,
                f"unreasonable PNG dimensions: {label}",
            )
            valid_depths = {
                0: {1, 2, 4, 8, 16},
                2: {8, 16},
                3: {1, 2, 4, 8},
                4: {8, 16},
                6: {8, 16},
            }
            require(
                color_type in valid_depths
                and bit_depth in valid_depths[color_type]
                and compression == 0
                and filter_method == 0
                and interlace in {0, 1},
                f"invalid PNG IHDR fields: {label}",
            )
        elif chunk_type == b"IDAT":
            require(ihdr is not None and not saw_iend, f"PNG IDAT outside image body: {label}")
            idat_parts.append(payload)
        elif chunk_type == b"IEND":
            require(ihdr is not None and idat_parts and length == 0, f"invalid PNG IEND: {label}")
            saw_iend = True
            offset = end
            break
        offset = end

    require(ihdr is not None and idat_parts and saw_iend, f"incomplete PNG structure: {label}")
    require(offset == len(data), f"trailing data after PNG IEND: {label}")

    width, height, bit_depth, color_type, _, _, interlace = ihdr
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color_type]
    row_bytes = (width * channels * bit_depth + 7) // 8
    limit = height * (row_bytes + 8)
    decoder = zlib.decompressobj()
    try:
        raw = decoder.decompress(b"".join(idat_parts), limit + 1)
        raw += decoder.flush()
    except zlib.error as error:
        raise VerificationError(f"invalid PNG IDAT zlib stream: {label}: {error}") from error
    require(
        decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail and len(raw) <= limit,
        f"invalid or oversized PNG image stream: {label}",
    )
    if interlace == 0:
        require(len(raw) == height * (row_bytes + 1), f"PNG image data size mismatch: {label}")


def assert_sequence(text: str, terms: list[str], label: str) -> None:
    position = -1
    for term in terms:
        position = text.find(term, position + 1)
        require(position >= 0, f"{label} missing or out of order at: {term}")


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.references: list[tuple[str, str, str]] = []
        self.stylesheets: list[str] = []
        self.scripts: list[str] = []
        self.media_tags: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag in {"img", "picture", "source"}:
            self.media_tags.append(tag)
        if tag == "link" and values.get("rel") == "stylesheet" and values.get("href"):
            self.stylesheets.append(values["href"] or "")
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"] or "")
        if values.get("id"):
            self.ids.add(values["id"] or "")
        for attribute in ("href", "src"):
            if values.get(attribute):
                self.references.append((tag, attribute, values[attribute] or ""))


class Runner:
    def __init__(self) -> None:
        self.checks = 0
        self.failures: list[str] = []
        self.deferred = 0
        self.a6_active = any((ROOT / path).exists() for path in A6_ARTIFACTS)

    def run(self, name: str, function) -> None:
        self.checks += 1
        try:
            function()
        except (VerificationError, OSError, zipfile.BadZipFile, RuntimeError) as error:
            self.failures.append(f"{name}: {error}")
            print(f"[FAIL] {name}: {error}")
        else:
            print(f"[PASS] {name}")

    def defer(self, message: str) -> None:
        self.deferred += 1
        print(f"[DEFER] {message}")


def check_self() -> None:
    def png_chunk(kind: bytes, payload: bytes) -> bytes:
        crc = zlib.crc32(payload, zlib.crc32(kind)) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", crc)

    tiny_png = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(b"\x00\x00\x00\x00\x00"))
        + png_chunk(b"IEND", b"")
    )
    validate_png_bytes(tiny_png, "one-pixel.png")
    try:
        validate_png_bytes(b"\x89PNG\r\n\x1a\n\x00", "nine-byte.png")
    except VerificationError:
        pass
    else:
        raise VerificationError("nine-byte PNG self-check")
    symlink = zipfile.ZipInfo("link")
    symlink.create_system = 3
    symlink.external_attr = 0o120777 << 16
    require(not zip_info_is_regular(symlink), "ZIP symlink metadata self-check")
    regular = zipfile.ZipInfo("regular.txt")
    regular.create_system = 3
    regular.external_attr = 0o100644 << 16
    require(zip_info_is_regular(regular), "ZIP regular metadata self-check")
    require(len(GOVERNANCE_FILES) == 19, "internal governance whitelist count")
    require(len(PRODUCT_FILES) == 9, "internal product whitelist count")
    require(len(ARCHITECTURE_FILES | AI_FILES) == 13, "internal architecture/AI whitelist count")
    require(len(PROTOTYPE_FILES) == 3 and len(A5_FILES) == 45, "internal A5 whitelist count")
    require(len(ZIP_BASE) == 48 and len(ZIP_BASE | SCREENSHOTS) == 54, "internal ZIP whitelist count")
    require(member_list_sha(ZIP_BASE) == ZIP_LIST_SHA256[48], "48-member whitelist SHA mismatch")
    require(member_list_sha(ZIP_BASE | SCREENSHOTS) == ZIP_LIST_SHA256[54], "54-member whitelist SHA mismatch")
    require(zip_member_is_safe("docs/product/PLATFORM_PRD.md"), "safe ZIP path rejected")
    for unsafe in ("../escape.txt", "/absolute.txt", "C:/drive.txt", "a//b.txt", "a/./b.txt", "a\\b.txt", "dir/"):
        require(not zip_member_is_safe(unsafe), f"unsafe ZIP path accepted: {unsafe}")
    sample = "a" * 64 + "  docs/a.md\n"
    require(parse_sha256s(sample) == {"docs/a.md": "A" * 64}, "manifest parser self-check")
    try:
        parse_sha256s(sample + "a" * 64 + "  docs/a.md\n")
    except VerificationError:
        pass
    else:
        raise VerificationError("manifest duplicate self-check")


def check_files_and_encoding(runner: Runner) -> None:
    screenshot_files = {path for path in SCREENSHOTS if (ROOT / path).exists()}
    expected_tracked = GOVERNANCE_FILES | PRODUCT_FILES | ARCHITECTURE_FILES | AI_FILES
    expected_untracked = PROTOTYPE_FILES | {VERIFIER}
    if runner.a6_active:
        expected_untracked |= A6_ARTIFACTS
    if screenshot_files:
        expected_untracked |= SCREENSHOTS

    tracked = {line for line in git("ls-files").stdout.splitlines() if line}
    untracked = {
        line for line in git("ls-files", "--others", "--exclude-standard").stdout.splitlines()
        if line
    }
    require(tracked == expected_tracked, "tracked A1-A3 path set differs from frozen HEAD")
    require(
        untracked == expected_untracked,
        "untracked stage set mismatch; missing="
        + ",".join(sorted(expected_untracked - untracked))
        + " extra="
        + ",".join(sorted(untracked - expected_untracked)),
    )

    ignored = []
    for line in git("status", "--ignored", "--porcelain=v1", "--untracked-files=all").stdout.splitlines():
        if line.startswith("!! "):
            ignored.append(line[3:].replace("\\", "/"))
    require(not ignored, "ignored project paths are forbidden: " + ", ".join(sorted(ignored)))

    text_paths = set(A5_FILES)
    if runner.a6_active:
        text_paths |= {REVIEW_REPORT, FILE_INVENTORY, ROOT_MANIFEST}
    for path in sorted(text_paths):
        read_text(path)


def check_governance() -> None:
    require(sha256_file(ROOT / CONTRACT) == CONTRACT_SHA256, "locked contract SHA-256 mismatch")
    require(git("rev-parse", "HEAD").stdout.strip() == EXPECTED_HEAD, "unexpected HEAD for A5/A6")
    require(git("branch", "--show-current").stdout.strip() == EXPECTED_BRANCH, "unexpected branch")
    require(not git("remote").stdout.strip(), "Git remote must remain absent")
    require(git("merge-base", "--is-ancestor", COMMIT_1, "HEAD", check=False).returncode == 0, "Commit 1 is not an ancestor")
    require(git("diff", "--quiet", "HEAD", "--", check=False).returncode == 0, "tracked A1-A3 worktree differs from HEAD")
    require(git("diff", "--cached", "--quiet", "HEAD", "--", check=False).returncode == 0, "Git index must be empty")
    commit_rows = []
    for line in git("log", "--reverse", "--format=%H%x09%s", "HEAD").stdout.splitlines():
        commit_hash, subject = line.split("\t", 1)
        commit_rows.append((commit_hash, subject))
    require(commit_rows == EXPECTED_COMMITS, "HEAD history must be the exact three approved commits/messages")

    commit_one_files = {
        line.strip()
        for line in git("ls-tree", "-r", "--name-only", COMMIT_1).stdout.splitlines()
        if line.strip()
    }
    require(commit_one_files == GOVERNANCE_FILES, "Commit 1 governance tree is not the exact 19-file set")
    frozen = git("diff", "--quiet", COMMIT_1, "--", *sorted(GOVERNANCE_FILES), check=False)
    require(frozen.returncode == 0, "governance files changed relative to Commit 1")

    blockers = read_text("docs/reviews/BLOCKERS.md")
    canonical_line = BT + "NO_BLOCKERS" + BT
    require(blockers.splitlines().count(canonical_line) == 1, "BLOCKERS must contain one canonical NO_BLOCKERS status")
    status_lines = [
        clean_cell(line)
        for line in blockers.splitlines()
        if re.fullmatch(r"\s*" + re.escape(BT) + r"(?:NO_BLOCKERS|BLOCKED)" + re.escape(BT) + r"\s*", line)
    ]
    require(status_lines == ["NO_BLOCKERS"], "BLOCKERS status must be exactly NO_BLOCKERS")


def check_terms_scope_and_binding() -> None:
    terminology = read_text("docs/project/TERMINOLOGY.md")
    scope = read_text("docs/project/SCOPE_AND_NON_SCOPE.md")
    baseline = read_text("docs/project/DECISION_BASELINE.md")
    combined = terminology + "\n" + scope + "\n" + baseline
    for term in (
        "访客",
        "访客状态",
        "微信小程序",
        "用户网页端",
        "机构管理网页端",
        "tenant_id",
        "campus_id",
        "模拟数据",
        "同芯AI学习助手",
    ):
        require(term in combined, f"critical locked term missing: {term}")

    current_files = PRODUCT_FILES | ARCHITECTURE_FILES | AI_FILES | PROTOTYPE_FILES
    for path in sorted(current_files):
        require("游客状态" not in read_text(path), f"obsolete current product term found: {path}")

    v01 = read_text("docs/product/V0_1_PRD.md")
    scope_text = scope + "\n" + v01
    for term in ("V0.1", "当前范围边界", "明确非范围", "正式 AI 模型", "生产部署"):
        require(term in scope_text, f"V0.1 scope/non-scope evidence missing: {term}")

    fallback_lines = [
        line for line in read_text("docs/product/USER_FLOWS.md").splitlines()
        if "文字回退" in line and "微信登录概念" in line
    ]
    require(len(fallback_lines) == 1, "binding flow must have one locked text fallback")
    assert_sequence(
        fallback_lines[0],
        ["微信登录概念", "填写手机号", "机构邀请码", "学生姓名", "班级", "提交", "机构审核", "建立关系"],
        "guardian binding order",
    )


def check_matrices_and_inventory() -> None:
    endpoint_rows = markdown_rows(read_text("docs/product/ENDPOINT_MATRIX.md"))
    require(endpoint_rows.count(ENDPOINT_HEADER) == 1, "endpoint matrix exact 9-column header")
    entries = [row for row in endpoint_rows if len(row) == 9 and row[-1] in ENDPOINT_STAGES]
    require(len(entries) == 46, "endpoint matrix must contain exactly 46 feature rows")
    require(all(all(cell for cell in row) for row in entries), "endpoint matrix contains an empty cell")
    require(len({row[0] for row in entries}) == 46, "endpoint matrix feature names must be unique")
    require(Counter(row[-1] for row in entries) == ENDPOINT_STAGES, "endpoint stage counts mismatch")

    role_rows = markdown_rows(read_text("docs/product/ROLE_MATRIX.md"))
    roles: dict[str, str] = {}
    for row in role_rows:
        if len(row) == 7 and row[0].startswith("ROLE-"):
            require(row[0] not in roles, f"duplicate role ID: {row[0]}")
            roles[row[0]] = row[1]
            require(all(row), f"role row has empty field: {row[0]}")
    require(roles == ROLE_NAMES, "role matrix must contain the exact seven locked roles")

    inventory_rows = markdown_rows(read_text("docs/product/PAGE_INVENTORY.md"))
    require(inventory_rows.count(INVENTORY_HEADER) == 5, "page inventory must repeat the exact 15-field header five times")
    catalog: dict[str, str] = {}
    group_counts: Counter[str] = Counter()
    for row in inventory_rows:
        if not row or not re.fullmatch(r"(?:A-MP|A-WEB|A-ADM|B-FLOW|C-RES)-\d{2}", row[0]):
            continue
        require(len(row) == 15 and all(row), f"inventory row must have 15 nonempty fields: {row[0]}")
        require(row[0] not in catalog, f"duplicate inventory ID: {row[0]}")
        catalog[row[0]] = row[2]
        group = row[0].rsplit("-", 1)[0]
        group_counts[group] += 1
    require(group_counts == Counter(INVENTORY_COUNTS), "inventory A/B/C group counts mismatch")
    exact_inventory_ids = set().union(
        *(expected_ids(prefix, count) for prefix, count in INVENTORY_COUNTS.items())
    )
    require(set(catalog) == exact_inventory_ids, "inventory IDs are not the exact 69-item set")
    require(len(set(catalog.values())) == 69, "inventory routes must be globally unique")

    v01 = read_text("docs/product/V0_1_PRD.md")
    for prefix, count in (("V01-PUB", 11), ("V01-STAFF", 7), ("V01-ADM", 12)):
        found = set(re.findall(rf"{re.escape(prefix)}-\d{{2}}", v01))
        require(found == expected_ids(prefix, count), f"{prefix} requirement set mismatch")


def check_flows_and_prototype() -> None:
    flows = read_text("docs/product/USER_FLOWS.md")
    headings = list(re.finditer(r"(?m)^##\s+\d+\.\s+(FLOW-\d{2})\b", flows))
    require([match.group(1) for match in headings] == [f"FLOW-{number:02d}" for number in range(1, 9)], "flow headings must be exact FLOW-01..08")
    for index, match in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else len(flows)
        section = flows[match.start():end]
        require((BT * 3 + "mermaid") in section, f"{match.group(1)} missing Mermaid")
        require("文字回退" in section, f"{match.group(1)} missing text fallback")
    for marker in (
        "USER_FLOW_COUNT=8",
        "COMPLETE_LOOP_GUARDIAN_BINDING=FLOW-03",
        "COMPLETE_LOOP_TEACHER_TASK_TO_REPORT=FLOW-04",
        "COMPLETE_LOOP_AI_LEARNING=FLOW-07",
        "AI_HINT_LAYERS=0,1,2,3,CONSOLIDATION",
        "AI_SUMMARY_DESTINATION=AUTHORIZED_TEACHER_ONLY",
    ):
        require(marker in flows, f"flow receipt marker missing: {marker}")

    inventory_rows = markdown_rows(read_text("docs/product/PAGE_INVENTORY.md"))
    inventory_catalog = {
        row[0]: row[2]
        for row in inventory_rows
        if len(row) == 15 and re.fullmatch(r"(?:A-MP|A-WEB|A-ADM|B-FLOW)-\d{2}", row[0])
    }

    app = read_text("prototypes/low-fidelity/scripts/app.js")
    try:
        node_check = subprocess.run(
            ["node", "--check", str(ROOT / "prototypes/low-fidelity/scripts/app.js")],
            cwd=ROOT,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except FileNotFoundError as error:
        raise VerificationError("node is required for prototype syntax validation") from error
    require(node_check.returncode == 0, "node --check failed: " + node_check.stderr.strip())
    begin = app.find("ROUTE_CATALOG_BEGIN")
    end = app.find("ROUTE_CATALOG_END")
    require(0 <= begin < end, "prototype route catalog markers missing or reversed")
    catalog_source = app[begin:end]
    pattern = re.compile(
        r'definePage\(\{\s*id:\s*"([^"]+)",\s*level:\s*"([^"]+)",\s*endpoint:\s*"([^"]+)",\s*route:\s*"([^"]+)"'
    )
    prototype_entries = pattern.findall(catalog_source)
    require(len(prototype_entries) == 59, "prototype catalog must contain exactly 59 A/B pages")
    prototype_catalog: dict[str, str] = {}
    endpoint_counts: Counter[str] = Counter()
    for page_id, level, endpoint, route in prototype_entries:
        require(page_id not in prototype_catalog, f"duplicate prototype ID: {page_id}")
        require(route not in prototype_catalog.values(), f"duplicate prototype route: {route}")
        require(level in {"A", "B"}, f"prototype contains non-A/B level: {page_id}")
        require(not page_id.startswith("C-"), f"prototype contains reserved C page: {page_id}")
        prototype_catalog[page_id] = route
        endpoint_counts[endpoint] += 1
    require(prototype_catalog == inventory_catalog, "prototype ID/route catalog differs from A+B inventory")
    require(endpoint_counts == Counter({"mini": 20, "web": 13, "admin": 14, "flow": 12}), "prototype endpoint counts mismatch")
    id_literals = set(
        re.findall(r'["\x27]((?:A-MP|A-WEB|A-ADM|B-FLOW|C-RES)-\d{2})["\x27]', app)
    )
    route_literals = set(
        re.findall(r'["\x27](/(?:mini|web|admin|flow)/[^"\x27]+)["\x27]', app)
    )
    require(id_literals <= set(prototype_catalog), "prototype contains an unresolved internal page ID")
    require(route_literals <= set(prototype_catalog.values()), "prototype contains an unresolved internal route")
    require("window.__PHASE_1A_BATCH_A_PROTOTYPE__" in app, "prototype verification object missing")
    for safeguard in ("externalRequests", "persistentStorage", "realData", "formalAi"):
        require(re.search(rf"\b{safeguard}\s*:\s*false\b", app) is not None, f"prototype safeguard is not false: {safeguard}")

    actor_options = {
        "B-FLOW-01": ["申请人", "机构/校区审核者"],
        "B-FLOW-03": ["教师", "家长"],
        "B-FLOW-04": ["家长", "授权教师/负责人"],
        "B-FLOW-05": ["家长", "教师", "授权教师/负责人", "受信时钟规则"],
        "B-FLOW-07": ["教师", "负责人", "受信时钟规则"],
        "B-FLOW-08": ["教师", "负责人"],
        "B-FLOW-09": ["教师", "负责人"],
    }
    actor_block = app[app.index("const flowActorOptions"):app.index("const flowActorMemory")]
    found_actor_pages = set(re.findall(r'"(B-FLOW-\d{2})"\s*:', actor_block))
    require(found_actor_pages == set(actor_options), "prototype actor-switch page set mismatch")
    for page_id, actors in actor_options.items():
        actor_pattern = r'"' + re.escape(page_id) + r'"\s*:\s*\[\s*' + r"\s*,\s*".join(
            re.escape('"' + actor + '"') for actor in actors
        ) + r"\s*\]"
        require(re.search(actor_pattern, actor_block) is not None, f"prototype actor options mismatch: {page_id}")
    for guard in (
        "transition.from.includes(current) && transition.actor === actor",
        "!uiState.currentPage || uiState.currentPage.id !== pageId || !allowed.includes(actor)",
        "!transition || !transition.from.includes(current) || transition.actor !== actor",
        "!model || !uiState.currentPage || uiState.currentPage.id !== pageId",
        'uiState.currentPage.id !== "B-FLOW-01" || actorByAction[action] !== actor',
        "handleSimpleFlow(target)",
        "handleFlowActor(target.dataset.flowActorPage, target.dataset.flowActor)",
        "handleBinding(target.dataset.bindingAction)",
    ):
        require(guard in app, f"prototype actor/handler guard missing: {guard}")

    summary_handler = app[app.index("function handleSummary"):app.index('document.addEventListener("click"')]
    summary_guard = summary_handler[:summary_handler.index("const summary = flowMemory.aiSummary;")]
    for guard in (
        '!uiState.currentPage || uiState.currentPage.id !== "B-FLOW-11"',
        'uiState.roleContext !== "授权教师（模拟审查）"',
        'flowMemory.aiSupervision.teacherScope !== "授权班级有效"',
        "return;",
    ):
        require(guard in summary_guard, f"AI teacher-summary write guard missing: {guard}")
    for marker in (
        'read: ["待教师查看"]',
        'intervene: ["待教师查看", "已阅"]',
        'resolve: ["需介入"]',
        '!allowedFrom[action] || !allowedFrom[action].includes(summary.state)',
    ):
        require(marker in summary_handler, f"AI teacher-summary transition guard missing: {marker}")

    reject_start = app[app.index("function rejectAiStart"):app.index("function renderAiLearning")]
    for forbidden_assignment in (
        'flowMemory.ai.state = "未开始";',
        'flowMemory.ai.step = "未开始";',
        "flowMemory.ai.usedLayer3 = false;",
        'flowMemory.aiSummary = { state: "暂无摘要", source: "无" };',
    ):
        require(forbidden_assignment not in reject_start, f"AI rejected action mutates protected state: {forbidden_assignment}")
    require("未创建学习会话" in reject_start, "AI failed-start receipt missing")
    render_ai = app[app.index("function renderAiLearning"):app.index("function aiActions")]
    require("rejectAiStart(guard);" not in render_ai, "AI rendering must not mutate state through rejectAiStart")
    require(app.count("if (!guard.pass)") >= 2 and app.count("rejectAiStart(guard);") == 1, "AI guard must reject in the handler without render-time writes")
    require(
        'deletionContext: "[data-deletion-action],[data-deletion-context]"' in app,
        "deletionContext focus mapping missing",
    )

    binding_handler = app[app.index("function handleBinding"):app.index("function handleSupervision")]
    for marker in (
        'wechat: "申请人"',
        'phone: "申请人"',
        'profile: "申请人"',
        'submit: "申请人"',
        'approve: "机构/校区审核者"',
        'action === "wechat" && binding.state === "待提交" && binding.step === "未开始"',
        'action === "phone" && binding.state === "待提交" && binding.step === "微信登录概念已确认"',
        'action === "profile" && binding.state === "待提交" && binding.step === "手机号占位已填写"',
        'action === "approve" && binding.state === "待审核" && binding.step === "字段已完成"',
        'binding.state = "已通过"',
        'state: "已解除"',
        'binding.state = "待提交"',
    ):
        require(marker in binding_handler, f"guardian-binding loop marker missing: {marker}")
    supervision_handler = app[app.index("function handleSupervision"):app.index("function handleDeletion")]
    for marker in (
        'uiState.currentPage.id !== "B-FLOW-12"',
        'uiState.roleContext !== "家长（模拟审查）"',
        'consent: setting.consent === "未同意" && ["未开启", "已关闭"].includes(setting.switchState)',
        'pause: setting.consent === "已同意" && setting.switchState === "已开启"',
        'if (!prerequisitesPass)',
        'if (!allowedFrom[action])',
    ):
        require(marker in supervision_handler, f"AI supervision transition guard missing: {marker}")
    deletion_handler = app[app.index("function handleDeletion"):app.index("function handleAi")]
    for marker in (
        'uiState.currentPage.id !== "B-FLOW-12"',
        'uiState.roleContext !== "家长（模拟审查）"',
        'setting.institutionSwitch !== "已启用"',
        'action === "request" && setting.deletion === "未申请"',
        'action === "complete" && setting.deletion === "待处理"',
    ):
        require(marker in deletion_handler, f"AI deletion transition guard missing: {marker}")
    simple_models = app[app.index("const simpleFlowModels"):app.index("const flowActorOptions")]
    for page_id, destination, terminal in (
        ("B-FLOW-07", "B-FLOW-08", "已完成"),
        ("B-FLOW-08", "B-FLOW-09", "已确认"),
        ("B-FLOW-09", "B-FLOW-06", "已确认"),
    ):
        start = simple_models.index('"' + page_id + '":')
        following = re.search(r'\n\s*"(?:B-FLOW-\d{2})"\s*:', simple_models[start + 1:])
        end = start + 1 + following.start() if following else len(simple_models)
        model = simple_models[start:end]
        require(f'go: "{destination}"' in model and f'to: "{terminal}"' in model, f"teacher-report loop marker missing: {page_id}")
    ai_handler = app[app.index("function handleAi"):app.index("function selectAiMode")]
    for marker in (
        'uiState.currentPage.id !== "B-FLOW-10"',
        'uiState.roleContext === "家长监督者（模拟审查）"',
        'uiState.roleContext === "授权教师监督者（模拟审查）"',
        'finish: "巩固3"',
        'ai.state === ai.step && ["已完成", "已关闭"].includes(ai.state)',
        'activeSteps.includes(ai.step)',
        '!safetyActionAllowed && !(linearStepAllowed && linearStateAllowed)',
        'ai.state = "已完成"',
        'flowMemory.aiSummary = { state: "待教师查看", source: "模拟学习完成" };',
        'ai.state = "需教师介入"',
        'summary.state = "已处理"',
    ):
        require(marker in app, f"AI loop marker missing: {marker}")
    ai_actions = {
        "未开始": ["start"],
        "学生首次尝试待提交": ["attempt"],
        "第0层": ["level1"],
        "第1层": ["retry1"],
        "第1层重答": ["understood1", "level2"],
        "第2层": ["retry2"],
        "第2层重答": ["understood2", "level3"],
        "第3层": ["consolidation1"],
        "巩固1": ["consolidation2"],
        "巩固2": ["consolidation3"],
        "巩固3": ["finish"],
    }
    action_source = app[app.index("function aiActions"):app.index("function renderAiTeacherSummary")]
    transition_source = ai_handler
    for state, actions in ai_actions.items():
        state_line = next((line for line in action_source.splitlines() if f'"{state}":' in line), "")
        for action in actions:
            require(f'data-ai-action="{action}"' in state_line, f"AI action marker missing: {state}/{action}")
            require(re.search(rf"\b{re.escape(action)}\s*:", transition_source) is not None or action == "finish", f"AI transition missing: {action}")

    delegated_handlers = app[app.index('document.addEventListener("click"'):]
    for marker in (
        'const guardianEntry = mode === "guardian"',
        'uiState.currentPage.id === "B-FLOW-12"',
        'const teacherEntry = mode === "teacher"',
        'uiState.currentPage.id === "B-FLOW-06"',
        'uiState.currentPage.id !== "B-FLOW-10" || !["guardian", "teacher"].includes(target.dataset.aiMode)',
        'const contextTransitionAllowed = (requestedContext === "processor" && currentContext === "家长申请人")',
        'flowMemory.aiSupervision.institutionSwitch !== "已启用"',
    ):
        require(marker in delegated_handlers, f"delegated B-action guard missing: {marker}")
    teacher_scope_handler = app[app.index("function toggleTeacherScope"):app.index("function activateTeacherSummary")]
    require('uiState.currentPage.id === "B-FLOW-11"' in teacher_scope_handler, "B11 teacher-scope review guard missing")
    require('uiState.currentPage.id === "B-FLOW-10" && flowMemory.ai.supervisorMode === "教师监督"' in teacher_scope_handler, "B10 teacher-scope actor guard missing")
    teacher_summary_handler = app[app.index("function activateTeacherSummary"):app.index("function handleCulture")]
    for marker in (
        'uiState.currentPage.id === "B-FLOW-10"',
        '["已完成", "需教师介入"].includes(flowMemory.ai.state)',
        'flowMemory.aiSummary.state !== "暂无摘要"',
        'uiState.currentPage.id === "B-FLOW-11"',
    ):
        require(marker in teacher_summary_handler, f"teacher-summary entry guard missing: {marker}")

    html_path = ROOT / "prototypes/low-fidelity/index.html"
    html = read_text("prototypes/low-fidelity/index.html")
    parser = AssetParser()
    parser.feed(html)
    require("page-main" in parser.ids, "prototype main target missing")
    require(parser.stylesheets == ["styles/main.css"], "index must reference styles/main.css exactly once")
    require(parser.scripts == ["scripts/app.js"], "index must reference scripts/app.js exactly once")
    require(html.count('<link rel="icon" href="data:,">') == 1, "index must suppress the implicit favicon request without an external asset")
    require(not parser.media_tags, "prototype must not contain img/picture/source assets")
    css = read_text("prototypes/low-fidelity/styles/main.css")
    require(".shell-admin .count-chip {\n  color: var(--ink);\n}" in css, "admin route-count contrast guard missing")
    for tag, attribute, target in parser.references:
        if tag == "link" and attribute == "href" and target == "data:,":
            continue
        parsed = urlsplit(target)
        require(not parsed.scheme and not parsed.netloc, f"external prototype {attribute}: {target}")
        if target.startswith("#"):
            require(target[1:] in parser.ids, f"missing HTML fragment target: {target}")
            continue
        local_target = (html_path.parent / parsed.path).resolve()
        try:
            inside = os.path.commonpath([str(local_target), str(html_path.parent.resolve())]) == str(html_path.parent.resolve())
        except ValueError:
            inside = False
        require(inside and local_target.is_file(), f"missing or escaping local asset: {target}")

    prototype_text = "\n".join(read_text(path) for path in sorted(PROTOTYPE_FILES))
    require(
        'window.addEventListener("hashchange", () => setRoleContext(nextRole), { once: true });' in prototype_text,
        "post-navigation role override guard missing",
    )
    forbidden_apis = {
        "fetch": r"\bfetch\s*\(",
        "XMLHttpRequest": r"\bXMLHttpRequest\b",
        "WebSocket": r"\bWebSocket\b",
        "EventSource": r"\bEventSource\b",
        "sendBeacon": r"\bsendBeacon\s*\(",
        "localStorage": r"\blocalStorage\b",
        "sessionStorage": r"\bsessionStorage\b",
        "indexedDB": r"\bindexedDB\b",
        "document.cookie": r"\bdocument\s*\.\s*cookie\b",
        "CacheStorage": r"\bcaches\s*\.\s*open\s*\(",
        "require": r"\brequire\s*\(",
    }
    for label, expression in forbidden_apis.items():
        require(re.search(expression, prototype_text) is None, f"prototype forbidden network/storage/dependency API: {label}")
    require(re.search(r"https?://", prototype_text, re.IGNORECASE) is None, "prototype contains an external HTTP(S) URL")
    require(re.search(r"(?i)\burl\s*\(", html + "\n" + css) is None, "prototype contains a background/resource URL")
    require(re.search(r"(?i)\b(?:srcset|poster)\s*=", html) is None, "prototype contains an external-capable media attribute")


def check_architecture_and_ai() -> None:
    data_model = read_text("docs/architecture/DATA_MODEL_DRAFT.md")
    data_rows = markdown_rows(data_model)
    object_first_cells = [row[0] for row in data_rows if row and row[0] in V01_OBJECTS | FUTURE_OBJECTS]
    require(set(object_first_cells) >= V01_OBJECTS | FUTURE_OBJECTS, "data model missing locked objects")
    for object_name in V01_OBJECTS | FUTURE_OBJECTS:
        require(object_first_cells.count(object_name) == 1, f"data model object row duplicated: {object_name}")
    for token in ("tenant_id", "campus_id", "服务端可信上下文", "客户端不能指定或覆盖"):
        require(token in data_model, f"data model isolation rule missing: {token}")

    tenancy = read_text("docs/architecture/MULTI_TENANCY_DRAFT.md")
    for token in (
        "查询",
        "写入",
        "唯一约束",
        "缓存键",
        "任务",
        "审计",
        "租户前缀",
        "AI 会话",
        "成本",
        "不信任客户端",
        "跨租户",
    ):
        require(token in tenancy, f"multi-tenancy isolation surface missing: {token}")

    api = read_text("docs/architecture/API_BOUNDARIES_DRAFT.md")
    for route in sorted(API_ROUTES):
        require(route in api, f"API boundary route missing: {route}")

    identity = read_text("docs/architecture/IDENTITY_AND_AUTHORIZATION_DRAFT.md")
    for role_name in ROLE_NAMES.values():
        require(role_name in identity, f"architecture role missing: {role_name}")
    for token in ("默认只有平台元数据", "单独批准", "最小字段", "审计"):
        require(token in identity, f"platform-admin boundary missing: {token}")

    ai_spec = read_text("docs/ai/AI_LEARNING_ASSISTANT_PRODUCT_SPEC.md")
    ai_flow = read_text("docs/ai/AI_LEARNING_FLOW.md")
    ai_safety = read_text("docs/ai/AI_SAFETY_BASELINE.md")
    ai_evaluation = read_text("docs/ai/AI_EVALUATION_DRAFT.md")
    ai_all = "\n".join((ai_spec, ai_flow, ai_safety, ai_evaluation))
    for token in (
        "学生先尝试",
        "第0层",
        "第1层",
        "第2层",
        "第3层",
        "1—3道",
        "摘要正文只回流",
        "授权教师",
        "学生首期不独立注册",
        "监护人同意",
        "人工复核",
        "可关闭/删除/审计",
    ):
        require(token in ai_all, f"AI locked boundary missing: {token}")
    require("0→1→2→必要时3" in ai_spec, "AI hint order mismatch")
    require("DIMENSIONS=11" in ai_evaluation, "AI evaluation dimension receipt mismatch")
    require("LIVE_MODEL_EVALUATION_EXECUTED=NO" in ai_evaluation, "live-model evaluation must remain NO")

    prohibition_section_match = re.search(
        r"## 4\. 明确禁止能力(?P<body>.*?)(?=\n## 5\.)",
        ai_safety,
        re.DOTALL,
    )
    require(prohibition_section_match is not None, "AI prohibition section missing")
    prohibition_items = re.findall(r"(?m)^\d+\.\s+.+$", prohibition_section_match.group("body"))
    require(len(prohibition_items) == 11, "AI prohibition list must contain exactly 11 items")
    for prohibition in AI_PROHIBITIONS:
        require(prohibition in prohibition_section_match.group("body"), f"AI prohibition missing: {prohibition}")


def valid_identity_number(value: str) -> bool:
    birth = value[6:14]
    try:
        year = int(birth[:4])
        month = int(birth[4:6])
        day = int(birth[6:8])
        parsed = date(year, month, day)
    except ValueError:
        return False
    if not date(1900, 1, 1) <= parsed <= date.today():
        return False
    weights = (7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2)
    checks = "10X98765432"
    return checks[sum(int(digit) * weight for digit, weight in zip(value[:17], weights)) % 11] == value[-1].upper()


def check_sensitive_patterns_and_claims() -> None:
    scan_files = set(A5_FILES)
    scan_files |= {path for path in (REVIEW_REPORT, FILE_INVENTORY, ROOT_MANIFEST) if (ROOT / path).is_file()}
    secret_patterns = {
        "private key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        "AWS access key": r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
        "OpenAI-style token": r"\bsk-[A-Za-z0-9_-]{20,}\b",
        "GitHub token": r"\bgh[psuro]_[A-Za-z0-9]{30,}\b",
        "JWT": r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b",
    }
    mobile_pattern = re.compile(r"(?<!\d)(?:\+?86[\s-]?)?1[3-9]\d(?:[\s-]?\d){8}(?!\d)")
    identity_pattern = re.compile(r"(?<!\d)(\d{17}[\dXx])(?!\d)")
    email_pattern = re.compile(r"(?<![\w.+-])[\w.+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})(?![\w.-])")
    claim_patterns = (
        re.compile(r"(?:本系统|本平台|本项目|当前版本|应用)\s*" + "现" + r"已(?:正式)?上线"),
        re.compile(r"(?:本系统|本平台|本项目|当前版本|应用)\s*" + "已成功" + r"部署(?:至|到)?生产"),
        re.compile(
            r"(?:\u672c\u7cfb\u7edf|\u672c\u5e73\u53f0|\u672c\u9879\u76ee|\u5f53\u524d\u7248\u672c|\u5e94\u7528)"
            r"\s*(?:\u5df2\u7ecf|\u5df2)\s*(?:\u6210\u529f)?\s*\u90e8\u7f72"
            r"(?:\u81f3|\u5230)?(?:\u4e86)?\u751f\u4ea7\u73af\u5883"
        ),
        re.compile(r"^\s*(?:生产部署|生产上线|正式上线)\s*[:=：]\s*(?:成功|完成|PASS|YES)\s*$", re.IGNORECASE),
        re.compile(r"\b(?:PRODUCTION_DEPLOYMENT|DEPLOYED_TO_PRODUCTION)\s*[:=]\s*(?:SUCCESS|LIVE|READY|YES|TRUE)\b", re.IGNORECASE),
    )
    reserved_domains = {"example.com", "example.org", "example.net", "example.test", "example.invalid"}
    placeholder_names = {"学生甲", "学生乙", "张三", "李四", "模拟姓名", "示例姓名", "姓名占位"}

    for path in sorted(scan_files):
        text = read_text(path)
        scan_text = re.sub(r"(?<![0-9A-Fa-f])[0-9A-Fa-f]{32,64}(?![0-9A-Fa-f])", "", text)
        for label, expression in secret_patterns.items():
            require(re.search(expression, scan_text) is None, f"{label} pattern found in {path}")
        require(mobile_pattern.search(scan_text) is None, f"real mobile-number shape found in {path}")
        for match in identity_pattern.finditer(scan_text):
            require(not valid_identity_number(match.group(1)), f"valid identity-number pattern found in {path}")
        for match in email_pattern.finditer(scan_text):
            domain = match.group(1).lower().rstrip(".")
            require(
                domain in reserved_domains
                or domain.endswith((".example.com", ".example.org", ".example.net", ".test", ".invalid")),
                f"non-example email address found in {path}",
            )
        for match in re.finditer(r"(?:姓名|学生姓名)\s*[:：=]\s*([\u4e00-\u9fff]{2,4})", scan_text):
            require(match.group(1) in placeholder_names, f"apparent real-name value found in {path}")
        require(
            re.search(r"(?:家庭住址|详细地址|住址)\s*[:：=]\s*[\u4e00-\u9fff0-9号栋室路街区县市省]{5,}", scan_text) is None,
            f"apparent address value found in {path}",
        )
        require(
            re.search(r"(?:过敏史|疾病|诊断|健康状况|病史)\s*[:：=]\s*(?!无|未知|模拟|占位)[^\s|,，;；]{2,}", scan_text) is None,
            f"apparent health value found in {path}",
        )
        for line_number, line in enumerate(scan_text.splitlines(), start=1):
            if any(pattern.search(line) for pattern in claim_patterns):
                raise VerificationError(f"explicit production-success claim in {path}:{line_number}")


def check_screenshots() -> None:
    present = {path for path in SCREENSHOTS if (ROOT / path).exists()}
    require(present in (set(), SCREENSHOTS), "screenshot set must be exactly zero or the approved six")
    for path in sorted(present):
        data = (ROOT / path).read_bytes()
        validate_png_bytes(data, path)


def read_zip_members(zip_path: Path, expected: set[str]) -> tuple[dict[str, str], str]:
    hashes: dict[str, str] = {}
    manifest_text = ""
    with zipfile.ZipFile(zip_path, "r") as archive:
        infos = archive.infolist()
        names = [info.filename for info in infos]
        require(len(names) == len(set(names)), "ZIP central directory contains duplicate names")
        for info in infos:
            require(info.orig_filename == info.filename, f"ZIP original/normalized name mismatch: {info.orig_filename!r}")
            require(not info.is_dir(), f"ZIP directory entry is forbidden: {info.filename}")
            require(zip_member_is_safe(info.orig_filename), f"unsafe original ZIP member path: {info.orig_filename}")
            require(zip_member_is_safe(info.filename), f"unsafe ZIP member path: {info.filename}")
            require(zip_info_is_regular(info), f"ZIP member is not a regular file: {info.filename}")
        require(set(names) == expected and len(names) == len(expected), "ZIP member set differs from exact whitelist")

        for info in infos:
            digest = hashlib.sha256()
            captured = bytearray() if info.filename == ROOT_MANIFEST else None
            with archive.open(info, "r") as handle:
                while True:
                    chunk = handle.read(1024 * 1024)
                    if not chunk:
                        break
                    digest.update(chunk)
                    if captured is not None:
                        captured.extend(chunk)
            hashes[info.filename] = digest.hexdigest().upper()
            if captured is not None:
                try:
                    manifest_text = bytes(captured).decode("utf-8")
                except UnicodeDecodeError as error:
                    raise VerificationError(f"ZIP-internal manifest is not UTF-8: {error}") from error
    require(bool(manifest_text), "ZIP-internal SHA256SUMS.txt missing or empty")
    return hashes, manifest_text


def check_a6_report(report: str, present_screens: set[str]) -> None:
    headings = []
    for match in re.finditer(r"(?m)^#{1,6}\s+(.+?)\s*$", report):
        heading = re.sub(r"^\d+(?:\.\d+)*[.、]?\s*", "", match.group(1).strip())
        headings.append(heading)
    for required_heading in REPORT_HEADINGS:
        require(
            any(heading == required_heading or heading.endswith(required_heading) for heading in headings),
            f"A6 report heading missing: {required_heading}",
        )
    for stage in range(6):
        require(any(re.search(rf"\bA{stage}\b", heading) for heading in headings), f"A6 report stage heading missing: A{stage}")
    require(
        any("A6" in heading and re.search(r"pre[- ]?package|打包前", heading, re.IGNORECASE) for heading in headings),
        "A6 report pre-package heading missing",
    )

    for commit_hash, subject in EXPECTED_COMMITS:
        require(commit_hash in report and subject in report, f"A6 report actual commit evidence missing: {commit_hash}")
    for pattern, label in (
        (r"(?:BROWSER_VERSION|浏览器版本)\s*[:=：]\s*\S+", "browser version"),
        (r"\bPLAYWRIGHT_VERSION\s*[:=]\s*v?\d+\.\d+\.\d+\b", "Playwright version"),
        (r"(?:STATIC_SERVER|SERVER|静态服务器)\s*[:=：]\s*\S+", "static server"),
        (r"(?:PAGE_COUNT|页面数)\s*[:=：]\s*59\b", "59 pages"),
        (r"\bA_ROUTES\s*[:=]\s*47\b", "47 A routes"),
        (r"\bB_ROUTES\s*[:=]\s*12\b", "12 B routes"),
        (r"\bPAGE_ERRORS\s*[:=]\s*0\b", "zero page errors"),
        (r"\bSEVERE_CONSOLE_ERRORS\s*[:=]\s*0\b", "zero severe console errors"),
        (r"\bEXTERNAL_REQUESTS\s*[:=]\s*0\b", "zero external requests"),
    ):
        require(re.search(pattern, report, re.IGNORECASE) is not None, f"A6 report browser evidence missing: {label}")

    for token in (
        "PHASE_1A_BATCH_A_A6_REVIEW_PACKAGE",
        "REPOSITORY_REVIEW",
        "THREAD_POST_PACKAGE",
        "DEFERRED_TO_COMMIT_4",
        "待项目负责人验收",
        "ZIP_MEMBER_CONFIRMATION_EVIDENCE",
        "TERMINAL_FINAL",
        "feat: add phase 1a low fidelity review prototype",
    ):
        require(token in report, f"A6 report anchor missing: {token}")
    for event in STOP_EVENTS:
        require(event in report, f"A6 report stop-event missing: {event}")
    require("Commit 4 SHA" in report and "外部回执" in report, "A6 report must state Commit 4/post-package external-only boundary")
    require(re.search(r"Commit 4 SHA\s*[:=：]\s*[0-9A-Fa-f]{40}", report) is None, "A6 report must not fabricate Commit 4 SHA")
    require(
        re.search(r"THREAD_POST_PACKAGE\s*[:=：]\s*PASS", report, re.IGNORECASE) is None,
        "A6 report must not claim post-package external receipt PASS",
    )

    if present_screens:
        for path in sorted(SCREENSHOTS):
            evidence_line = next((line for line in report.splitlines() if path in line), "")
            require(path in evidence_line and sha256_file(ROOT / path) in evidence_line.upper(), f"A6 screenshot hash evidence missing: {path}")
    else:
        require(not any(path in report for path in SCREENSHOTS), "zero-screenshot report must not enumerate screenshot files")
        require(re.search(r"(?:SCREENSHOTS\s*[:=]\s*(?:0|NOT_AVAILABLE)|(?:精确)?0\s*(?:张|项)截图)", report, re.IGNORECASE) is not None, "A6 zero-screenshot count missing")
        require("浏览器不可用" in report or "浏览器验证失败" in report, "A6 zero-screenshot reason missing")


def check_a6_inventory(inventory: str, expected_zip: set[str]) -> None:
    root_names = {".gitignore", "AGENTS.md", CONTRACT, "PLANS.md", "README.md", ROOT_MANIFEST}
    path_rows: dict[str, list[str]] = {}
    for row in markdown_rows(inventory):
        if not row:
            continue
        path = row[0]
        if "/" not in path and path not in root_names:
            continue
        require(zip_member_is_safe(path), f"unsafe FILE_INVENTORY path: {path}")
        require(path not in path_rows, f"duplicate FILE_INVENTORY path: {path}")
        path_rows[path] = row
    require(set(path_rows) == expected_zip, "FILE_INVENTORY must enumerate the exact 48/54 ZIP members")
    for path, row in path_rows.items():
        evidence = " | ".join(row[1:])
        responsibility = re.search(
            r"\bSELF\b|自身|自引用|\bGENERATED_LATER\b|generated-later|后生成|打包后生成",
            evidence,
            re.IGNORECASE,
        )
        hashes = re.findall(r"(?<![0-9A-Fa-f])[0-9A-Fa-f]{64}(?![0-9A-Fa-f])", evidence)
        if responsibility:
            require(path in {FILE_INVENTORY, ROOT_MANIFEST}, f"generated/self responsibility not allowed for: {path}")
            continue
        require(len(hashes) == 1, f"FILE_INVENTORY current SHA evidence missing or ambiguous: {path}")
        require((ROOT / path).is_file(), f"FILE_INVENTORY target missing: {path}")
        require(hashes[0].upper() == sha256_file(ROOT / path), f"FILE_INVENTORY SHA mismatch: {path}")


def check_a6_package() -> None:
    for path in sorted(A6_ARTIFACTS):
        require((ROOT / path).is_file(), f"A6 mode requires full artifact set: {path}")
    report = read_text(REVIEW_REPORT)
    inventory = read_text(FILE_INVENTORY)

    present_screens = {path for path in SCREENSHOTS if (ROOT / path).exists()}
    require(present_screens in (set(), SCREENSHOTS), "A6 screenshot set must be zero or six")
    expected_zip = ZIP_BASE | present_screens
    require(len(expected_zip) in ZIP_LIST_SHA256, "A6 ZIP member count must be 48 or 54")
    require(
        member_list_sha(expected_zip) == ZIP_LIST_SHA256[len(expected_zip)],
        "runtime ZIP whitelist SHA-256 mismatch",
    )
    check_a6_report(report, present_screens)
    check_a6_inventory(inventory, expected_zip)

    zip_hashes, internal_manifest_text = read_zip_members(ROOT / ZIP_PATH, expected_zip)
    internal_manifest = parse_sha256s(internal_manifest_text)
    expected_internal_manifest = expected_zip - {ROOT_MANIFEST}
    require(set(internal_manifest) == expected_internal_manifest, "ZIP-internal manifest coverage mismatch")
    require(ZIP_PATH not in internal_manifest, "ZIP-internal manifest must exclude the ZIP")
    for name, expected_digest in internal_manifest.items():
        require(zip_hashes[name] == expected_digest, f"ZIP member SHA mismatch: {name}")

    for name in sorted(expected_zip - {ROOT_MANIFEST}):
        require((ROOT / name).is_file(), f"local ZIP payload missing: {name}")
        require(sha256_file(ROOT / name) == zip_hashes[name], f"ZIP payload differs from local file: {name}")

    root_manifest = parse_sha256s(read_text(ROOT_MANIFEST))
    expected_root_manifest = (expected_zip - {ROOT_MANIFEST}) | {ZIP_PATH}
    require(set(root_manifest) == expected_root_manifest, "root final manifest coverage mismatch")
    for name, expected_digest in root_manifest.items():
        require((ROOT / name).is_file(), f"root manifest target missing: {name}")
        require(sha256_file(ROOT / name) == expected_digest, f"root manifest SHA mismatch: {name}")


def main() -> int:
    runner = Runner()
    runner.run("in-memory path/manifest self-check", check_self)
    runner.run("exact files and UTF-8/nonempty", lambda: check_files_and_encoding(runner))
    runner.run("contract and frozen governance", check_governance)
    runner.run("locked terms, scope, and binding order", check_terms_scope_and_binding)
    runner.run("endpoint/role matrices and 69-page inventory", check_matrices_and_inventory)
    runner.run("static flow/catalog markers and Node syntax", check_flows_and_prototype)
    runner.run("architecture and AI boundaries", check_architecture_and_ai)
    runner.run("secret, personal-data, and production-claim scan", check_sensitive_patterns_and_claims)
    runner.run("approved screenshot set", check_screenshots)
    if runner.a6_active:
        print("EXTERNAL_CONFIRMATION_GATE=REQUIRED")
        runner.run("A6 report, inventory, manifests, and ZIP", check_a6_package)
        a6_mode = "REQUIRED"
    else:
        runner.defer(
            "A6-only artifacts absent: review report, file inventory, root SHA256SUMS, and review ZIP "
            "are not required until A6; creation of any one auto-requires and validates the full set"
        )
        a6_mode = "DEFERRED"

    print(
        f"SUMMARY checks={runner.checks} failures={len(runner.failures)} "
        f"deferred={runner.deferred}"
    )
    print(f"VERIFICATION={'PASS' if not runner.failures else 'FAIL'}")
    print(f"A6_MODE={a6_mode}")
    print("PROTOTYPE_EVIDENCE=STATIC_MARKERS_AND_NODE_SYNTAX_ONLY")
    print("BROWSER_RUNTIME_EVIDENCE=REQUIRED_SEPARATELY_BY_A5")
    return 0 if not runner.failures else 1


if __name__ == "__main__":
    sys.exit(main())
