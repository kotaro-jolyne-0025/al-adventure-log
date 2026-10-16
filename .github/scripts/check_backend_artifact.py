"""Check artifact entry names without reading any private configuration values."""

from __future__ import annotations

import argparse
from pathlib import Path
from zipfile import ZipFile


def artifact_errors(path: Path) -> list[str]:
    with ZipFile(path) as archive:
        names = archive.namelist()
    errors = []
    if "BOOT-INF/classes/com/dndadvlog/backend/BackendApplication.class" not in names:
        errors.append("Expected a repackaged Spring Boot application JAR.")
    for name in names:
        filename = name.rsplit("/", 1)[-1]
        if (filename == "application-local.properties" or filename.endswith(".local.properties")
                or filename == ".env" or filename.startswith(".env.")
                or (name.endswith(".class") and "LocalDevLauncher" in filename)
                or (name.startswith("BOOT-INF/lib/") and "embedded-postgres" in filename)):
            errors.append(f"Local-only entry must not be packaged: {name}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("jar", type=Path)
    errors = artifact_errors(parser.parse_args().jar)
    for error in errors:
        print(f"::error::{error}")
    if not errors:
        print("Production artifact excludes local settings, launcher, and embedded PostgreSQL.")
    return int(bool(errors))


if __name__ == "__main__":
    raise SystemExit(main())
