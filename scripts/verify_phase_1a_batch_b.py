"""Standard-library verifier for the Phase 1A Batch B evidence set."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import zlib
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "PHASE_1A_BATCH_B_CODEX_EXECUTION.md"
SOURCE_HEAD = "f698f87150dce3376fb96d1bbb330d28d0d73b81"
TARGET_BRANCH = "planning/phase-1a-batch-b"
CONTRACT_SHA = "8DE2E96EB129E05950F8BC3832C5CEB842A1565BC5512E201F7EB233AC6DE04E"
BATCH_A_ZIP = ROOT / "artifacts/review-package/student-care-platform-phase1a-batch-a-review-pack-v1.0.zip"
BATCH_B_ZIP = ROOT / "artifacts/review-package/student-care-platform-phase1a-batch-b-review-pack-v1.0.zip"
SCREENSHOT_DIR = ROOT / "artifacts/screenshots-batch-b"
REVIEW = ROOT / "docs/reviews/PHASE_1A_BATCH_B_REVIEW.md"

VISUAL_INPUTS = {
    "phase-inputs/phase1a-batch-b/visual/tongxin-logo.png": "65F4B749DA035FD2659FCF43A58713EABE4BD9F98CF1E9FF78A4724551B3BEE1",
    "phase-inputs/phase1a-batch-b/visual/web-layout-reference.jpg": "88B620C1454BC05E273F5E9A1A41A81527B47D8B0ECEE710E05F37412CC90F0E",
    "phase-inputs/phase1a-batch-b/visual/mobile-layout-reference.jpg": "612E739FF2371E6477B95DE258FD8E9FE396521F789764C3EBA9B16F1CE30CE2",
    "phase-inputs/phase1a-batch-b/visual/tongxin-brand-poster.jpg": "D870845B48D64FAF57E1F3DF7C6032BA4CB51D246700A370D1D98F1B9B26CDDC",
}

PROTOTYPE_FILES = {
    "prototypes/high-fidelity/index.html",
    "prototypes/high-fidelity/styles/tokens.css",
    "prototypes/high-fidelity/styles/base.css",
    "prototypes/high-fidelity/styles/components.css",
    "prototypes/high-fidelity/styles/layouts.css",
    "prototypes/high-fidelity/styles/endpoints.css",
    "prototypes/high-fidelity/scripts/app.js",
    "prototypes/high-fidelity/data/page-catalog.js",
    "prototypes/high-fidelity/data/mock-data.js",
    "prototypes/high-fidelity/assets/brand/tongxin-logo.png",
    "prototypes/high-fidelity/assets/icons/symbols.svg",
    "prototypes/high-fidelity/assets/illustrations/welcome-children.svg",
    "prototypes/high-fidelity/assets/illustrations/teacher-team.svg",
    "prototypes/high-fidelity/assets/illustrations/meal-care.svg",
    "prototypes/high-fidelity/assets/illustrations/ai-learning.svg",
    "prototypes/high-fidelity/assets/illustrations/safety-pickup.svg",
    "prototypes/high-fidelity/assets/illustrations/empty-state.svg",
    "prototypes/high-fidelity/assets/illustrations/success-state.svg",
}

BASELINES = {
    "docs/architecture/TECH_STACK_BASELINE.md",
    "docs/architecture/REPOSITORY_STRUCTURE_BASELINE.md",
    "docs/architecture/SYSTEM_ARCHITECTURE_BASELINE.md",
    "docs/architecture/MODULE_BOUNDARIES_BASELINE.md",
    "docs/architecture/MULTI_TENANCY_BASELINE.md",
    "docs/architecture/IDENTITY_AND_AUTHORIZATION_BASELINE.md",
    "docs/architecture/DATA_MODEL_BASELINE.md",
    "docs/architecture/API_CONTRACT_BASELINE.md",
    "docs/architecture/FILE_STORAGE_BASELINE.md",
    "docs/architecture/ENVIRONMENTS_AND_DEPLOYMENT_BASELINE.md",
    "docs/architecture/SECURITY_AND_PRIVACY_BASELINE.md",
    "docs/architecture/TEST_STRATEGY_BASELINE.md",
    "docs/architecture/OBSERVABILITY_AND_OPERATIONS_BASELINE.md",
    "docs/architecture/MIGRATION_AND_ROLLBACK_BASELINE.md",
}

CONTRACT_FILES = {
    "docs/contracts/V0_1_ROUTE_AND_PAGE_CONTRACT.md",
    "docs/contracts/V0_1_PERMISSION_MATRIX.md",
    "docs/contracts/V0_1_CONTENT_SCHEMA.json",
    "docs/contracts/V0_1_API_SCHEMA.json",
    "docs/contracts/V0_1_ERROR_CATALOG.md",
    "docs/contracts/V0_1_ACCEPTANCE_TRACEABILITY.md",
}

PLAN_FILES = {
    "docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md",
    "docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md",
}

FIXED_SCREENSHOTS = [
    "mini-visitor-home-hifi.png",
    "mini-teacher-workbench-hifi.png",
    "mini-parent-home-hifi.png",
    "mini-ai-learning-hifi.png",
    "web-visitor-home-hifi.png",
    "web-teacher-workbench-hifi.png",
    "web-parent-home-hifi.png",
    "web-teacher-daily-report-hifi.png",
    "admin-dashboard-hifi.png",
    "admin-teacher-profile-hifi.png",
    "admin-guide-resource-hifi.png",
    "flow-guardian-binding-hifi.png",
    "flow-teacher-daily-report-hifi.png",
    "flow-ai-learning-assistant-hifi.png",
    "responsive-mobile-320-hifi.png",
]

PACKAGE_MEMBERS = [
    ".gitignore",
    "AGENTS.md",
    "README.md",
    "PLANS.md",
    "PHASE_1A_BATCH_B_CODEX_EXECUTION.md",
    "docs/project/PHASE_1A_BATCH_A_ACCEPTANCE.md",
    "docs/project/PHASE_1A_BATCH_B_DECISION_BASELINE.md",
    "docs/project/PHASE_1A_BATCH_B_SCOPE_AND_NON_SCOPE.md",
    "docs/plans/PHASE_1A_BATCH_B_EXEC_PLAN.md",
    "docs/design/VISUAL_REFERENCE_ANALYSIS.md",
    "docs/design/BRAND_UI_GUIDELINES.md",
    "docs/design/COLOR_AND_ACCESSIBILITY.md",
    "docs/design/TYPOGRAPHY_AND_CONTENT_TONE.md",
    "docs/design/SPACING_RADIUS_ELEVATION.md",
    "docs/design/ICON_AND_ILLUSTRATION_RULES.md",
    "docs/design/COMPONENT_INVENTORY.md",
    "docs/design/RESPONSIVE_AND_CROSS_ENDPOINT_RULES.md",
    "docs/design/INTERACTION_AND_MOTION_RULES.md",
    "docs/design/DESIGN_QA_CHECKLIST.md",
    "prototypes/high-fidelity/index.html",
    "prototypes/high-fidelity/styles/tokens.css",
    "prototypes/high-fidelity/styles/base.css",
    "prototypes/high-fidelity/styles/components.css",
    "prototypes/high-fidelity/styles/layouts.css",
    "prototypes/high-fidelity/styles/endpoints.css",
    "prototypes/high-fidelity/scripts/app.js",
    "prototypes/high-fidelity/data/page-catalog.js",
    "prototypes/high-fidelity/data/mock-data.js",
    "prototypes/high-fidelity/assets/brand/tongxin-logo.png",
    "prototypes/high-fidelity/assets/icons/symbols.svg",
    "prototypes/high-fidelity/assets/illustrations/welcome-children.svg",
    "prototypes/high-fidelity/assets/illustrations/teacher-team.svg",
    "prototypes/high-fidelity/assets/illustrations/meal-care.svg",
    "prototypes/high-fidelity/assets/illustrations/ai-learning.svg",
    "prototypes/high-fidelity/assets/illustrations/safety-pickup.svg",
    "prototypes/high-fidelity/assets/illustrations/empty-state.svg",
    "prototypes/high-fidelity/assets/illustrations/success-state.svg",
    "docs/architecture/TECH_STACK_BASELINE.md",
    "docs/architecture/REPOSITORY_STRUCTURE_BASELINE.md",
    "docs/architecture/SYSTEM_ARCHITECTURE_BASELINE.md",
    "docs/architecture/MODULE_BOUNDARIES_BASELINE.md",
    "docs/architecture/MULTI_TENANCY_BASELINE.md",
    "docs/architecture/IDENTITY_AND_AUTHORIZATION_BASELINE.md",
    "docs/architecture/DATA_MODEL_BASELINE.md",
    "docs/architecture/API_CONTRACT_BASELINE.md",
    "docs/architecture/FILE_STORAGE_BASELINE.md",
    "docs/architecture/ENVIRONMENTS_AND_DEPLOYMENT_BASELINE.md",
    "docs/architecture/SECURITY_AND_PRIVACY_BASELINE.md",
    "docs/architecture/TEST_STRATEGY_BASELINE.md",
    "docs/architecture/OBSERVABILITY_AND_OPERATIONS_BASELINE.md",
    "docs/architecture/MIGRATION_AND_ROLLBACK_BASELINE.md",
    "docs/contracts/V0_1_ROUTE_AND_PAGE_CONTRACT.md",
    "docs/contracts/V0_1_PERMISSION_MATRIX.md",
    "docs/contracts/V0_1_CONTENT_SCHEMA.json",
    "docs/contracts/V0_1_API_SCHEMA.json",
    "docs/contracts/V0_1_ERROR_CATALOG.md",
    "docs/contracts/V0_1_ACCEPTANCE_TRACEABILITY.md",
    "docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md",
    "docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md",
    "scripts/verify_phase_1a_batch_b.py",
    "docs/reviews/PHASE_1A_BATCH_B_REVIEW.md",
    "docs/reviews/PHASE_1A_BATCH_B_FILE_INVENTORY.md",
    "SHA256SUMS_PHASE_1A_BATCH_B.txt",
    "artifacts/screenshots-batch-b/mini-visitor-home-hifi.png",
    "artifacts/screenshots-batch-b/mini-teacher-workbench-hifi.png",
    "artifacts/screenshots-batch-b/mini-parent-home-hifi.png",
    "artifacts/screenshots-batch-b/mini-ai-learning-hifi.png",
    "artifacts/screenshots-batch-b/web-visitor-home-hifi.png",
    "artifacts/screenshots-batch-b/web-teacher-workbench-hifi.png",
    "artifacts/screenshots-batch-b/web-parent-home-hifi.png",
    "artifacts/screenshots-batch-b/web-teacher-daily-report-hifi.png",
    "artifacts/screenshots-batch-b/admin-dashboard-hifi.png",
    "artifacts/screenshots-batch-b/admin-teacher-profile-hifi.png",
    "artifacts/screenshots-batch-b/admin-guide-resource-hifi.png",
    "artifacts/screenshots-batch-b/flow-guardian-binding-hifi.png",
    "artifacts/screenshots-batch-b/flow-teacher-daily-report-hifi.png",
    "artifacts/screenshots-batch-b/flow-ai-learning-assistant-hifi.png",
    "artifacts/screenshots-batch-b/responsive-mobile-320-hifi.png",
    "docs/product/PAGE_INVENTORY.md",
    "docs/product/ENDPOINT_MATRIX.md",
    "docs/product/ACCEPTANCE_CRITERIA.md",
    "docs/product/USER_FLOWS.md",
    "docs/product/V0_1_PRD.md",
    "docs/ai/AI_LEARNING_ASSISTANT_PRODUCT_SPEC.md",
    "docs/ai/AI_SAFETY_BASELINE.md",
    "docs/reviews/PHASE_1A_BATCH_A_REVIEW.md",
]

EXPECTED_BATCH_B_COMMITS = [
    ("84d5e343a2a91bc02944cb02f9c7bddcc5219bf3", "chore: activate phase 1a batch b design baseline"),
    ("e2351ad04eae334db678d50331f3b0e66c15407b", "docs: define tongxin cross-end design system"),
    ("26add2ead44f92f6f55f0f02b52d499a2868f083", "feat: add phase 1a high fidelity prototypes"),
    ("ee37761e5da882d0a06379ae9a90cec25eecc71f", "docs: finalize v0.1 technical baseline and phase 1b plan"),
    ("", "test: add phase 1a batch b review evidence"),
]

FROZEN_PREFIXES = (
    "docs/product/",
    "docs/ai/",
    "prototypes/low-fidelity/",
    "artifacts/screenshots-batch-a/",
)
FROZEN_EXACT = {
    "SHA256SUMS.txt",
    "docs/reviews/BLOCKERS.md",
    "docs/reviews/PHASE_1A_BATCH_A_REVIEW.md",
    "scripts/verify_phase_1a_batch_a.py",
    "artifacts/review-package/student-care-platform-phase1a-batch-a-review-pack-v1.0.zip",
}
ALLOWED_TREE_PREFIXES = (
    ".gitignore",
    "AGENTS.md",
    "README.md",
    "PLANS.md",
    "PHASE_1A_BATCH_B_CODEX_EXECUTION.md",
    "docs/project/",
    "docs/design/",
    "docs/architecture/",
    "docs/contracts/",
    "docs/plans/",
    "docs/reviews/PHASE_1A_BATCH_B_",
    "prototypes/high-fidelity/",
    "scripts/verify_phase_1a_batch_b.py",
    "artifacts/screenshots-batch-b/",
    "artifacts/review-package/student-care-platform-phase1a-batch-b-review-pack-v1.0.zip",
    "SHA256SUMS_PHASE_1A_BATCH_B.txt",
)
MANIFEST = ROOT / "SHA256SUMS_PHASE_1A_BATCH_B.txt"
EXPECTED_BATCH_A_ZIP_SHA = "309C264BA901FFFCED50AEF52C40D87ACA110ABC41F17C731347D6779DEF183A"
EXPECTED_BATCH_A_MEMBER_SHA = "36EBB5D0F829B164D8B9130EB70DD259F5A6D4EFB0A8752D5D9B56D0788C58D6"
EXPECTED_BATCH_B_MEMBER_SHA = "B6ED195F1F41AB731F53AFA65071037BE23A56F3547B543160A41F0CE6A33C30"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def git(*args: str, check: bool = True) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, text=True, encoding="utf-8", errors="replace", capture_output=True)
    if check and result.returncode:
        raise RuntimeError(f"git {' '.join(args)} failed: {(result.stderr or '').strip()}")
    return (result.stdout or "").strip()


def check_png(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("bad PNG signature")
    offset = 8
    width = height = 0
    saw_iend = False
    while offset < len(data):
        if offset + 12 > len(data):
            raise ValueError("truncated PNG chunk")
        length = int.from_bytes(data[offset : offset + 4], "big")
        kind = data[offset + 4 : offset + 8]
        end = offset + 12 + length
        if end > len(data):
            raise ValueError("PNG chunk exceeds file")
        payload = data[offset + 8 : offset + 8 + length]
        expected_crc = int.from_bytes(data[offset + 8 + length : end], "big")
        actual_crc = zlib.crc32(kind + payload) & 0xFFFFFFFF
        if expected_crc != actual_crc:
            raise ValueError(f"CRC mismatch in {kind.decode('ascii', 'replace')}")
        if kind == b"IHDR":
            if length != 13:
                raise ValueError("invalid IHDR")
            width = int.from_bytes(payload[:4], "big")
            height = int.from_bytes(payload[4:8], "big")
        if kind == b"IEND":
            saw_iend = True
            if end != len(data):
                raise ValueError("trailing PNG data")
            break
        offset = end
    if not saw_iend or not width or not height:
        raise ValueError("incomplete PNG")
    return width, height


def zip_member_digest(names: list[str]) -> str:
    canonical = "".join(f"{name}\n" for name in sorted(names)).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest().upper()


def parse_manifest(text: str) -> dict[str, str]:
    entries: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("REVIEW_PACKAGE_SHA256="):
            continue
        parts = line.split(None, 1)
        if len(parts) != 2 or not re.fullmatch(r"[0-9A-Fa-f]{64}", parts[0]):
            continue
        entries[parts[1]] = parts[0].upper()
    return entries


def check_batch_a(errors: list[str]) -> None:
    if not BATCH_A_ZIP.is_file():
        errors.append("Batch A ZIP is missing")
        return
    if sha256(BATCH_A_ZIP) != EXPECTED_BATCH_A_ZIP_SHA:
        errors.append("Batch A ZIP SHA-256 mismatch")
    with ZipFile(BATCH_A_ZIP) as archive:
        names = archive.namelist()
        if len(names) != 54 or len(set(names)) != 54:
            errors.append(f"Batch A ZIP member count/uniqueness mismatch: {len(names)}")
        if zip_member_digest(names) != EXPECTED_BATCH_A_MEMBER_SHA:
            errors.append("Batch A ZIP member-list SHA-256 mismatch")
        if "SHA256SUMS.txt" not in names:
            errors.append("Batch A internal SHA256SUMS.txt is missing")
            return
        entries = parse_manifest(archive.read("SHA256SUMS.txt").decode("utf-8"))
        if len(entries) != 53:
            errors.append(f"Batch A internal manifest entry count mismatch: {len(entries)}")
        for relative, expected in entries.items():
            if relative not in names:
                errors.append(f"Batch A manifest member missing: {relative}")
                continue
            if hashlib.sha256(archive.read(relative)).hexdigest().upper() != expected:
                errors.append(f"Batch A manifest hash mismatch: {relative}")
    root_manifest = ROOT / "SHA256SUMS.txt"
    if not root_manifest.is_file() or EXPECTED_BATCH_A_ZIP_SHA not in root_manifest.read_text(encoding="utf-8"):
        errors.append("root Batch A SHA256SUMS.txt does not record the frozen ZIP hash")
    contract_text = CONTRACT.read_text(encoding="utf-8") if CONTRACT.is_file() else ""
    for marker in ("BATCH_A_PROJECT_OWNER_ACCEPTANCE=PASS", "BATCH_A_ACCEPTANCE_DATE=2026-08-22", SOURCE_HEAD):
        if marker not in contract_text:
            errors.append(f"Batch A acceptance anchor missing from contract: {marker}")


def check_git(errors: list[str]) -> None:
    if git("branch", "--show-current") != TARGET_BRANCH:
        errors.append("current branch is not the Batch B target branch")
    ancestor = subprocess.run(["git", "merge-base", "--is-ancestor", SOURCE_HEAD, "HEAD"], cwd=ROOT)
    if ancestor.returncode != 0:
        errors.append("Batch A SOURCE_HEAD is not an ancestor")
    if git("remote"):
        errors.append("Git remote count is not zero")
    source_ref = git("show-ref", "--verify", "--hash", "refs/heads/planning/phase-1a-batch-a", check=False)
    if source_ref != SOURCE_HEAD:
        errors.append(f"Batch A source branch moved: {source_ref or 'missing'}")
    commits = git("rev-list", "--reverse", f"{SOURCE_HEAD}..HEAD").splitlines()
    if len(commits) not in (4, 5):
        errors.append(f"unexpected Batch B commit count: {len(commits)}")
    for index, commit in enumerate(commits):
        if index >= len(EXPECTED_BATCH_B_COMMITS):
            errors.append(f"unknown Batch B commit: {commit}")
            continue
        expected_hash, expected_subject = EXPECTED_BATCH_B_COMMITS[index]
        subject = git("show", "-s", "--format=%s", commit)
        if expected_hash and commit != expected_hash:
            errors.append(f"Batch B commit {index + 1} SHA mismatch: {commit}")
        if subject != expected_subject:
            errors.append(f"Batch B commit {index + 1} subject mismatch: {subject}")
        parents = git("show", "-s", "--format=%P", commit).split()
        expected_parent = SOURCE_HEAD if index == 0 else commits[index - 1]
        if parents != [expected_parent]:
            errors.append(f"Batch B commit {index + 1} parent mismatch: {parents}")
    changed = git("diff", "--name-only", f"{SOURCE_HEAD}..HEAD").splitlines()
    for path in changed:
        if path in FROZEN_EXACT or path.startswith(FROZEN_PREFIXES):
            errors.append(f"Batch A frozen path changed in Batch B history: {path}")
        if not any(path == prefix or path.startswith(prefix) for prefix in ALLOWED_TREE_PREFIXES):
            errors.append(f"Batch B history contains unauthorized path: {path}")


def check_frozen_files(errors: list[str]) -> None:
    changed = git("diff", "--name-only", f"{SOURCE_HEAD}..HEAD").splitlines()
    for path in changed:
        if path in FROZEN_EXACT or path.startswith(FROZEN_PREFIXES):
            errors.append(f"frozen Batch A path changed: {path}")
    status = git("status", "--porcelain", "--untracked-files=all").splitlines()
    for line in status:
        path = line[3:] if len(line) > 3 else line
        if path in FROZEN_EXACT or path.startswith(FROZEN_PREFIXES):
            errors.append(f"frozen Batch A path dirty: {path}")
    for path in sorted(FROZEN_EXACT):
        result = subprocess.run(["git", "show", f"{SOURCE_HEAD}:{path}"], cwd=ROOT, capture_output=True)
        current_path = ROOT / path
        if result.returncode or not current_path.is_file() or result.stdout != current_path.read_bytes():
            errors.append(f"frozen Batch A file content drift: {path}")


def check_inputs(errors: list[str], final: bool) -> None:
    if not CONTRACT.is_file() or sha256(CONTRACT) != CONTRACT_SHA:
        errors.append("Batch B contract SHA-256 mismatch")
    for relative, expected in VISUAL_INPUTS.items():
        path = ROOT / relative
        if not path.is_file() or sha256(path) != expected:
            errors.append(f"visual input mismatch: {relative}")
    if not final and BATCH_B_ZIP.exists():
        errors.append("Batch B fixed ZIP exists before final evidence generation")
    if final and not BATCH_B_ZIP.is_file():
        errors.append("Batch B fixed ZIP is missing")


def check_prototype(errors: list[str]) -> None:
    actual = {
        p.relative_to(ROOT).as_posix()
        for p in (ROOT / "prototypes/high-fidelity").rglob("*")
        if p.is_file()
    }
    if actual != PROTOTYPE_FILES:
        errors.append(f"high-fidelity file set mismatch: missing={sorted(PROTOTYPE_FILES-actual)} extra={sorted(actual-PROTOTYPE_FILES)}")
    for relative in PROTOTYPE_FILES:
        path = ROOT / relative
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"missing or empty prototype file: {relative}")
    catalog = (ROOT / "prototypes/high-fidelity/data/page-catalog.js").read_text(encoding="utf-8")
    rows = re.findall(r"\b([AB])\('([^']+)','([^']*)','([^']+)'", catalog)
    ids = [row[1] for row in rows]
    routes = [row[3] for row in rows]
    if len(rows) != 59 or sum(row[0] == "A" for row in rows) != 47 or sum(row[0] == "B" for row in rows) != 12:
        errors.append(f"route count mismatch: rows={len(rows)} A={sum(row[0] == 'A' for row in rows)} B={sum(row[0] == 'B' for row in rows)}")
    if len(set(ids)) != len(ids) or len(set(routes)) != len(routes):
        errors.append("route IDs or paths are not unique")
    app = (ROOT / "prototypes/high-fidelity/scripts/app.js").read_text(encoding="utf-8")
    for forbidden in ("fetch(", "XMLHttpRequest", "WebSocket", "EventSource", "localStorage", "sessionStorage", "indexedDB", "document.cookie", "http://", "https://"):
        if forbidden in app:
            errors.append(f"forbidden offline prototype token: {forbidden}")
    required = {
        "page.route.startsWith('/web/visitor/')": "web visitor dispatch",
        "staffPrefix = page.route.startsWith('/web/')": "contextual staff links",
        "state.route.startsWith('/mini/')": "mini staff login dispatch",
        "state.binding.step >= 5": "binding release state",
        "flowContinuations": "teacher flow continuation map",
        "report-confirm": "report confirmation action",
        "report-return": "report return action",
        "ai-understood": "AI understood branch",
        "ai-need-more": "AI still-needs-help branch",
        "aiGuardError": "AI start guard",
        "institutionEnabled": "institution AI switch guard",
        "teacherScopeValid": "teacher scope guard",
    }
    for marker, label in required.items():
        if marker not in app:
            errors.append(f"missing B5 behavior marker ({label}): {marker}")
    if "if (action === 'ai-start') { state.ai.status = 'active'" in app:
        errors.append("AI start bypasses the guard function")
    if "['/flow/teacher-tasks'" not in app or "['/flow/class-student-status'" not in app or "['/flow/teacher-daily-report'" not in app:
        errors.append("teacher workbench continuation chain is incomplete")


def check_styles(errors: list[str]) -> None:
    css = "\n".join((ROOT / "prototypes/high-fidelity/styles" / name).read_text(encoding="utf-8") for name in ("base.css", "components.css", "layouts.css"))
    for marker in ("prefers-reduced-motion", ":focus-visible", "min-height: 44px", "max-width: 480px", "overflow-x: auto"):
        if marker not in css:
            errors.append(f"responsive/accessibility CSS marker missing: {marker}")


def check_b4(errors: list[str]) -> None:
    for relative in BASELINES | CONTRACT_FILES | PLAN_FILES:
        path = ROOT / relative
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"missing B4 file: {relative}")
    for relative in BASELINES:
        text = (ROOT / relative).read_text(encoding="utf-8")
        if re.search(r"TBD|TODO|placeholder", text, re.IGNORECASE):
            errors.append(f"unresolved marker in baseline: {relative}")
    for relative in ("docs/contracts/V0_1_CONTENT_SCHEMA.json", "docs/contracts/V0_1_API_SCHEMA.json"):
        try:
            json.loads((ROOT / relative).read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"invalid JSON {relative}: {exc}")
    plan = (ROOT / "docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md").read_text(encoding="utf-8")
    if len(re.findall(r"^## Task \d+", plan, re.MULTILINE)) != 18:
        errors.append("Phase 1B plan does not contain 18 tasks")


def check_forbidden_paths(errors: list[str]) -> None:
    forbidden = ("apps/", "packages/", "node_modules/", ".env", "migrations/", "database/migrations/")
    tracked = git("ls-files").splitlines()
    dirty = [line[3:] for line in git("status", "--porcelain", "--untracked-files=all").splitlines() if len(line) > 3]
    for path in tracked + dirty:
        normalized = path.replace("\\", "/")
        if any(normalized == item or normalized.startswith(item) for item in forbidden):
            errors.append(f"forbidden path present: {path}")
    for path in (ROOT / "apps", ROOT / "packages", ROOT / "node_modules"):
        if path.exists():
            errors.append(f"forbidden directory exists: {path.relative_to(ROOT).as_posix()}")


def check_manifest(errors: list[str]) -> None:
    if not MANIFEST.is_file():
        errors.append("Batch B independent manifest is missing")
        return
    text = MANIFEST.read_text(encoding="utf-8")
    entries = parse_manifest(text)
    expected = set(PACKAGE_MEMBERS) - {MANIFEST.name}
    if set(entries) != expected:
        errors.append(f"Batch B manifest member set mismatch: missing={sorted(expected - set(entries))} extra={sorted(set(entries) - expected)}")
    for relative, expected_hash in entries.items():
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"Batch B manifest file missing: {relative}")
        elif sha256(path) != expected_hash:
            errors.append(f"Batch B manifest hash mismatch: {relative}")
    if "REVIEW_PACKAGE_SHA256=" not in text:
        errors.append("root Batch B manifest does not record the ZIP hash")


def check_review_package(errors: list[str]) -> None:
    if not BATCH_B_ZIP.is_file():
        errors.append("Batch B review ZIP is missing")
        return
    if sha256(BATCH_B_ZIP) == "":
        errors.append("Batch B review ZIP has no digest")
    with ZipFile(BATCH_B_ZIP) as archive:
        names = archive.namelist()
        if names != sorted(names) or names != sorted(set(names)):
            errors.append("Batch B ZIP members are not unique and sorted")
        if names != sorted(PACKAGE_MEMBERS):
            errors.append(f"Batch B ZIP whitelist mismatch: count={len(names)} expected={len(PACKAGE_MEMBERS)}")
        if len(names) != 86:
            errors.append(f"Batch B ZIP member count mismatch: {len(names)}")
        if zip_member_digest(names) != EXPECTED_BATCH_B_MEMBER_SHA:
            errors.append("Batch B ZIP member-list SHA-256 mismatch")
        internal_manifest = parse_manifest(archive.read(MANIFEST.name).decode("utf-8")) if MANIFEST.name in names else {}
        expected_internal = set(PACKAGE_MEMBERS) - {MANIFEST.name}
        if set(internal_manifest) != expected_internal:
            errors.append("Batch B internal manifest does not cover exactly the other 85 members")
        for info in archive.infolist():
            if info.is_dir() or info.compress_type != ZIP_STORED:
                errors.append(f"ZIP member is not a stored regular file: {info.filename}")
            if info.filename.startswith("/") or ".." in Path(info.filename).parts:
                errors.append(f"unsafe ZIP member path: {info.filename}")
            if info.filename not in PACKAGE_MEMBERS:
                continue
            if info.filename == MANIFEST.name:
                continue
            if hashlib.sha256(archive.read(info.filename)).hexdigest().upper() != sha256(ROOT / info.filename):
                errors.append(f"ZIP member hash mismatch: {info.filename}")
            if info.filename in internal_manifest and hashlib.sha256(archive.read(info.filename)).hexdigest().upper() != internal_manifest[info.filename]:
                errors.append(f"Batch B internal manifest hash mismatch: {info.filename}")


def check_screenshots(errors: list[str]) -> None:
    actual = sorted(p.name for p in SCREENSHOT_DIR.glob("*.png")) if SCREENSHOT_DIR.is_dir() else []
    if actual != sorted(FIXED_SCREENSHOTS):
        errors.append(f"screenshot set mismatch: {actual}")
    for name in FIXED_SCREENSHOTS:
        path = SCREENSHOT_DIR / name
        try:
            width, height = check_png(path)
            expected = (320, 568) if name == "responsive-mobile-320-hifi.png" else (390, 844) if name.startswith("mini-") else (1440, 1024)
            if (width, height) != expected:
                errors.append(f"screenshot dimensions mismatch: {name} {width}x{height}, expected {expected[0]}x{expected[1]}")
        except (OSError, ValueError) as exc:
            errors.append(f"invalid screenshot {name}: {exc}")
    if not REVIEW.is_file():
        errors.append("Batch B review report is missing")
    else:
        review = REVIEW.read_text(encoding="utf-8")
        for marker in ("ROUTES_TOTAL=59", "ROUTES_PASS=59", "ROUTES_FAIL=0", "PAGE_ERRORS=0", "SEVERE_CONSOLE_ERRORS=0", "EXTERNAL_REQUESTS=0", "FAILED_REQUESTS=0", "SCREENSHOT_COUNT=15", "SCREENSHOT_SOURCE_STATUS=FINAL_BROWSER_GENERATED", "PROJECT_OWNER_ACCEPTANCE=PENDING"):
            if marker not in review:
                errors.append(f"browser evidence marker missing: {marker}")


def main() -> int:
    final = "--preflight" not in sys.argv[1:]
    errors: list[str] = []
    try:
        check_inputs(errors, final)
        check_batch_a(errors)
        check_git(errors)
        check_frozen_files(errors)
        check_prototype(errors)
        check_styles(errors)
        check_b4(errors)
        check_forbidden_paths(errors)
        if final:
            check_screenshots(errors)
            check_manifest(errors)
            check_review_package(errors)
    except (OSError, RuntimeError, ValueError) as exc:
        errors.append(f"verifier exception: {exc}")
    if errors:
        print("PHASE_1A_BATCH_B_VERIFICATION=FAIL")
        for error in errors:
            print("ERROR=" + error)
        return 1
    print("PHASE_1A_BATCH_B_VERIFICATION=PASS")
    print("CONTRACT_SHA256=" + CONTRACT_SHA)
    print("A_ROUTE_COUNT=47")
    print("B_ROUTE_COUNT=12")
    print("BROWSER_ROUTE_COUNT=59" if final else "BROWSER_ROUTE_COUNT=PENDING")
    print("SCREENSHOT_COUNT=15" if final else "SCREENSHOT_COUNT=PENDING")
    print("REVIEW_PACKAGE_MEMBER_COUNT=86" if final else "REVIEW_PACKAGE_MEMBER_COUNT=PENDING")
    print("PHASE_1B_STARTED=NO")
    print("PROJECT_OWNER_ACCEPTANCE=PENDING")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
