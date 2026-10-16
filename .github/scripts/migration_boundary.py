"""Print the highest migration version in the most recent release tag at a base SHA."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys

DIRECTORY = "backend/src/main/resources/db/migration/"
VERSION = re.compile(r"V([1-9][0-9]*)__.*\.sql$")
RELEASE_TAG = re.compile(r"v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)")


def latest_release_boundary(base: str) -> tuple[str, int]:
    tags = subprocess.check_output(
        ["git", "tag", "--merged", base, "--sort=-version:refname"], text=True
    ).splitlines()
    for tag in tags:
        if not RELEASE_TAG.fullmatch(tag):
            continue
        paths = subprocess.check_output(
            ["git", "ls-tree", "-r", "--name-only", tag, "--", DIRECTORY], text=True
        ).splitlines()
        versions = [int(match.group(1)) for path in paths if (match := VERSION.fullmatch(path.rsplit("/", 1)[-1]))]
        if versions:
            return tag, max(versions)
    raise ValueError(f"No release tag with Flyway migrations exists at {base}.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    args = parser.parse_args()
    try:
        tag, version = latest_release_boundary(args.base)
    except (subprocess.CalledProcessError, ValueError) as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1
    print(f"MIGRATION_BASE_TAG={tag}")
    print(f"MIGRATION_BASE_VERSION={version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
