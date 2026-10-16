#!/usr/bin/env python3
"""Shared, unprivileged PR checks for versions, risk, specs, and sensitive files."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SENSITIVE_PATHS = (
    re.compile(r"(^|/)\.env(?:$|\.)", re.I),
    re.compile(r"(^|/)application-local\.properties$", re.I),
    re.compile(r"(^|/)[^/]*service-account[^/]*\.json$", re.I),
    re.compile(r"\.(?:pem|p8|key|p12|pfx|dump|pgdump|backup|sqlite(?:3)?|db)(?:$|\.)", re.I),
    re.compile(r"(^|/)(?:cookies|local storage|session storage|user data)(?:/|$)", re.I),
    re.compile(r"(^|/)(?:chrome|chromium|edge|browser)[-_ ]?(?:profile|user[-_ ]?data)(?:/|$)", re.I),
    re.compile(r"(^|/)[^/]*(?:database[-_ ]?)?(?:backup|dump)[^/]*\.(?:sql(?:\.gz)?|dump|pgdump|backup|zip)$", re.I),
    re.compile(r"(^|/)(?:target|node_modules|dist)/|\.(?:jar|class)$", re.I),
)
SECRET_LINES = (
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    re.compile(r"(?i)\b(?:password|secret|token|api[_-]?key|private[_-]?key)\s*[:=]\s*['\"]?[A-Za-z0-9/+_=-]{20,}"),
)
SAFE_SECRET_PLACEHOLDER = re.compile(
    r"(?i)\b(?:password|secret|token|api[_-]?key|private[_-]?key)\s*[:=]\s*['\"]?"
    r"(?:\$\{\{|your_|example|dummy|synthetic|fixture|replace[-_]?me|change[-_]?me)"
)
REQUIRED_FIELDS = ("風險理由", "影響範圍", "驗證內容", "復原方式")
PLACEHOLDER = re.compile(r"(?:TODO|TBD|待填|請填|請選|placeholder|n/?a)", re.I)


def versions_match(frontend: dict, lock: dict, pom_text: str) -> bool:
    try:
        package_version = frontend["version"]
        lock_version = lock["version"]
        lock_root_version = lock["packages"][""]["version"]
        root = ET.fromstring(pom_text)
        namespace = {"m": "http://maven.apache.org/POM/4.0.0"}
        backend_version = root.findtext("m:version", namespaces=namespace)
    except (KeyError, TypeError, ET.ParseError):
        return False
    return bool(package_version) and package_version == lock_version == lock_root_version == backend_version


def sensitive_path_errors(paths: list[str]) -> list[str]:
    return [
        path for path in paths
        if not path.lower().endswith((".example", ".sample"))
        and any(pattern.search(path) for pattern in SENSITIVE_PATHS)
    ]


def sensitive_content_errors(lines: list[str]) -> list[int]:
    bad: list[int] = []
    for number, line in enumerate(lines, start=1):
        if line.startswith("+") and not line.startswith("+++"):
            content = line[1:]
            credential = any(pattern.search(content) for pattern in SECRET_LINES[:2])
            assignments = SECRET_LINES[2].finditer(content)
            if credential or any(not SAFE_SECRET_PLACEHOLDER.match(match.group(0)) for match in assignments):
                bad.append(number)
    return bad


def risk_errors(body: str) -> list[str]:
    errors = []
    risk = re.search(r"(?im)^\s*風險分級\s*[:：]\s*(低|中|高)\s*$", body)
    if not risk:
        errors.append("PR body must include `風險分級：低`, `風險分級：中`, or `風險分級：高`.")
    for field in REQUIRED_FIELDS:
        match = re.search(rf"(?im)^\s*{field}\s*[:：]\s*(.+?)\s*$", body)
        if not match or PLACEHOLDER.search(match.group(1)):
            errors.append(f"PR body must provide a non-placeholder `{field}`.")
    return errors


def openspec_targets(paths: list[str]) -> tuple[bool, list[str]]:
    specs_changed = any(path.startswith("openspec/specs/") for path in paths)
    changes = sorted({
        parts[2]
        for path in paths
        if (parts := path.split("/")) and len(parts) > 3
        and parts[0:2] == ["openspec", "changes"] and parts[2] != "archive"
    })
    return specs_changed, changes


def workflow_policy_errors(workflows: dict[str, str]) -> list[str]:
    errors = []
    for name, content in workflows.items():
        if re.search(r"(?m)^\s*pull_request_target\s*:", content):
            errors.append(f"{name} must not use the privileged pull_request_target event.")
        if not re.search(r"(?m)^permissions:\s*\n\s+contents:\s*read\s*$", content):
            errors.append(f"{name} must declare read-only contents permission.")
        if re.search(r"(?i)id-token\s*:\s*write|\benvironment\s*:|secrets\.", content):
            errors.append(f"{name} must not request deployment identity, an environment, or secrets.")
    ci = workflows.get("ci.yml", "")
    for job in ("pr-frontend", "pr-backend", "pr-policy"):
        if not re.search(rf"(?m)^  {job}:\s*$", ci):
            errors.append(f"CI is missing the fixed `{job}` status job.")
    migration = workflows.get("check-migrations.yml", "")
    if not re.search(r"(?m)^  immutable-migrations:\s*$", migration):
        errors.append("Migration policy is missing the fixed `immutable-migrations` status job.")
    return errors


def changed_files(base: str, head: str) -> tuple[list[str], list[tuple[str, str]]]:
    raw = subprocess.check_output(
        ["git", "diff", "--name-status", "--no-renames", base, head], cwd=ROOT, text=True
    ).splitlines()
    statuses, paths = [], []
    for line in raw:
        status, path = line.split("\t", 1)
        statuses.append((status, path))
        paths.append(path)
    return paths, statuses


def run_openspec(paths: list[str], root: Path = ROOT, runner=subprocess.run) -> list[str]:
    specs_changed, changes = openspec_targets(paths)
    commands = []
    if specs_changed:
        commands.append(["openspec", "validate", "--specs", "--strict"])
    for name in changes:
        if (root / "openspec" / "changes" / name).is_dir():
            commands.append(["openspec", "validate", name, "--strict"])
    for command in commands:
        result = runner(command, cwd=root, text=True, capture_output=True)
        if result.returncode:
            print(result.stdout)
            print(result.stderr, file=sys.stderr)
            return [f"OpenSpec validation failed: {' '.join(command)}"]
        print(result.stdout)
    return []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--event", required=True)
    args = parser.parse_args()
    errors: list[str] = []
    frontend = json.loads((ROOT / "frontend/package.json").read_text(encoding="utf-8"))
    lock = json.loads((ROOT / "frontend/package-lock.json").read_text(encoding="utf-8"))
    pom = (ROOT / "backend/pom.xml").read_text(encoding="utf-8")
    if not versions_match(frontend, lock, pom):
        errors.append("Frontend package, lockfile root, and backend Maven versions must match.")

    paths, _ = changed_files(args.base, args.head)
    bad_paths = sensitive_path_errors(paths)
    errors.extend(f"Sensitive/local/generated path must not be committed: {path}" for path in bad_paths)
    diff = subprocess.check_output(["git", "diff", "--unified=0", args.base, args.head], cwd=ROOT, text=True)
    bad_lines = sensitive_content_errors(diff.splitlines())
    errors.extend(f"Added line {line} resembles a credential; remove it or use a safe placeholder." for line in bad_lines)

    if args.event == "pull_request":
        errors.extend(risk_errors(os.environ.get("PR_BODY", "")))
    workflows = {
        name: (ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8")
        for name in ("ci.yml", "check-migrations.yml")
    }
    errors.extend(workflow_policy_errors(workflows))
    errors.extend(run_openspec(paths))
    if errors:
        print("\n".join(f"::error::{error}" for error in errors), file=sys.stderr)
        return 1
    print("PR policy checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
