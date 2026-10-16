#!/usr/bin/env python3
"""Validate the immutable Flyway history and newly added migration versions."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import Counter

MIGRATION_DIR = "backend/src/main/resources/db/migration/"
MIGRATION_NAME = re.compile(r"V([1-9][0-9]*)__([A-Za-z0-9][A-Za-z0-9_]*?)\.sql$")


def version_of(path: str) -> int | None:
    match = MIGRATION_NAME.fullmatch(path.rsplit("/", 1)[-1])
    return int(match.group(1)) if match else None


def validate(base_paths: list[str], changes: list[tuple[str, str]]) -> list[str]:
    errors: list[str] = []
    base_versions = [version_of(path) for path in base_paths if path.startswith(MIGRATION_DIR)]
    base_versions = [version for version in base_versions if version is not None]
    duplicates = sorted(version for version, count in Counter(base_versions).items() if count > 1)
    if duplicates:
        errors.append(f"Base contains duplicate Flyway versions: {duplicates}")
    highest_base = max(base_versions, default=0)

    added_versions: list[int] = []
    for status, path in changes:
        if not path.startswith(MIGRATION_DIR):
            continue
        if status != "A":
            errors.append(f"Existing migration history is immutable: {status} {path}")
            continue
        version = version_of(path)
        if version is None:
            errors.append(f"New migration must use V<number>__Description.sql: {path}")
        else:
            added_versions.append(version)
            if version <= highest_base:
                errors.append(f"New migration version {version} must exceed base version {highest_base}: {path}")

    duplicates = sorted(version for version, count in Counter(added_versions).items() if count > 1)
    if duplicates:
        errors.append(f"New migrations contain duplicate Flyway versions: {duplicates}")
    return errors


def git_lines(*args: str) -> list[str]:
    return subprocess.check_output(["git", *args], text=True).splitlines()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    args = parser.parse_args()
    base = git_lines("ls-tree", "-r", "--name-only", args.base, "--", MIGRATION_DIR)
    raw = git_lines("diff", "--name-status", "--no-renames", args.base, args.head, "--", MIGRATION_DIR)
    changes: list[tuple[str, str]] = []
    for line in raw:
        status, path = line.split("\t", 1)
        changes.append((status, path))
    errors = validate(base, changes)
    if errors:
        print("\n".join(f"::error::{error}" for error in errors), file=sys.stderr)
        return 1
    print("Flyway history is immutable; added migrations are valid and above the base version.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
