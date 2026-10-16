import sys
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parent))
from check_migrations import validate as validate_migrations
from check_pr_policy import (
    openspec_targets,
    run_openspec,
    risk_errors,
    sensitive_content_errors,
    sensitive_path_errors,
    versions_match,
    workflow_policy_errors,
)
from migration_boundary import latest_release_boundary
from check_backend_artifact import artifact_errors
from zipfile import ZipFile


MIGRATIONS = "backend/src/main/resources/db/migration/"


class MigrationPolicyTests(unittest.TestCase):
    def test_new_higher_version_passes(self):
        self.assertEqual([], validate_migrations([MIGRATIONS + "V29__baseline.sql"], [("A", MIGRATIONS + "V30__new_index.sql")]))

    def test_modified_deleted_and_renamed_history_fail(self):
        base = [MIGRATIONS + "V29__baseline.sql"]
        for change in (("M", base[0]), ("D", base[0])):
            with self.subTest(change=change):
                self.assertTrue(validate_migrations(base, [change]))
        # Git reports a rename as deletion plus addition because the checker disables rename detection.
        self.assertTrue(validate_migrations(base, [("D", base[0]), ("A", MIGRATIONS + "V30__renamed.sql")]))

    def test_bad_duplicate_and_low_versions_fail(self):
        base = [MIGRATIONS + "V29__baseline.sql"]
        cases = [
            [("A", MIGRATIONS + "migration.sql")],
            [("A", MIGRATIONS + "V29__duplicate.sql")],
            [("A", MIGRATIONS + "V30__first.sql"), ("A", MIGRATIONS + "V30__second.sql")],
        ]
        for changes in cases:
            with self.subTest(changes=changes):
                self.assertTrue(validate_migrations(base, changes))


class PrPolicyTests(unittest.TestCase):
    def test_production_artifact_excludes_local_configuration_and_tools(self):
        with tempfile.TemporaryDirectory() as temp:
            jar = Path(temp) / "fixture.jar"
            with ZipFile(jar, "w") as archive:
                archive.writestr("BOOT-INF/classes/com/dndadvlog/backend/BackendApplication.class", b"fixture")
            self.assertEqual([], artifact_errors(jar))
            with ZipFile(jar, "a") as archive:
                archive.writestr("BOOT-INF/classes/application-local.properties", b"fixture")
                archive.writestr("BOOT-INF/classes/com/dndadvlog/backend/config/LocalDevLauncher.class", b"fixture")
                archive.writestr("BOOT-INF/lib/embedded-postgres-fixture.jar", b"fixture")
            self.assertEqual(3, len(artifact_errors(jar)))

    def test_empty_jar_is_not_a_valid_production_artifact(self):
        with tempfile.TemporaryDirectory() as temp:
            jar = Path(temp) / "fixture.jar"
            with ZipFile(jar, "w"):
                pass
            self.assertTrue(artifact_errors(jar))

    def test_product_versions_must_all_match(self):
        pom = "<project xmlns='http://maven.apache.org/POM/4.0.0'><version>2.1.0</version></project>"
        package = {"version": "2.1.0"}
        lock = {"version": "2.1.0", "packages": {"": {"version": "2.1.0"}}}
        self.assertTrue(versions_match(package, lock, pom))
        lock["packages"][""]["version"] = "2.0.0"
        self.assertFalse(versions_match(package, lock, pom))

    def test_doc_only_and_unchanged_legacy_change_do_not_invoke_spec_validation(self):
        self.assertEqual((False, []), openspec_targets(["README.md"]))
        # An unchanged legacy change is absent from changed paths, so it cannot become a target.
        self.assertEqual((False, []), openspec_targets(["docs/release.md"]))

    def test_invalid_new_spec_is_selected_for_strict_validation(self):
        path = "openspec/changes/new-change/specs/auth/spec.md"
        self.assertEqual((False, ["new-change"]), openspec_targets([path]))
        with tempfile.TemporaryDirectory() as temp:
            change = Path(temp) / "openspec" / "changes" / "new-change"
            change.mkdir(parents=True)
            (change / "proposal.md").write_text("incomplete", encoding="utf-8")
            runner = lambda *args, **kwargs: SimpleNamespace(returncode=1, stdout="invalid spec", stderr="")
            self.assertTrue(run_openspec([path], Path(temp), runner))

    def test_risk_template_must_be_completed(self):
        good = "風險分級：中\n風險理由：修改驗證流程\n影響範圍：登入\n驗證內容：Maven verify\n復原方式：回退版本"
        self.assertEqual([], risk_errors(good))
        self.assertTrue(risk_errors(good.replace("風險分級：中", "風險分級：低").replace("影響範圍：登入", "影響範圍：TODO")))

    def test_sensitive_paths_and_added_secret_lines(self):
        self.assertEqual(
            ["backend/src/main/resources/application-local.properties", "database-backup.sql.gz"],
            sensitive_path_errors([
                "backend/src/main/resources/application-local.properties", ".env.example", "database-backup.sql.gz"
            ]),
        )
        opaque_value = "somecredentialvalueover20chars123456"
        self.assertTrue(sensitive_content_errors(["+private_key=" + opaque_value]))
        self.assertEqual([], sensitive_content_errors(["+password=synthetic-test-password-value-123456789"]))
        self.assertTrue(sensitive_content_errors(["+secret=" + opaque_value + " # example fixture"]))

    def test_safe_placeholder_does_not_hide_another_credential_on_the_same_line(self):
        opaque_value = "somecredentialvalueover20chars123456"
        safe_prefix = "+password=synthetic-fixture-password-123456; "
        self.assertTrue(sensitive_content_errors([safe_prefix + "secret=" + opaque_value]))
        self.assertTrue(sensitive_content_errors([safe_prefix + "ghp_" + "x" * 36]))
        self.assertTrue(sensitive_content_errors([safe_prefix + "-----BEGIN " + "PRIVATE KEY-----"]))

    @patch("migration_boundary.subprocess.check_output")
    def test_migration_boundary_uses_latest_reachable_release_tag(self, run_git):
        run_git.side_effect = [
            "v2.1.0\nv2.0.1\n",
            "backend/src/main/resources/db/migration/V29__last.sql\n",
        ]
        self.assertEqual(("v2.1.0", 29), latest_release_boundary("base-sha"))

    @patch("migration_boundary.subprocess.check_output")
    def test_migration_boundary_ignores_snapshot_and_prerelease_tags(self, run_git):
        run_git.side_effect = [
            "snapshot-99\nv3.0.0-rc.1\nv2.1.0\n",
            "backend/src/main/resources/db/migration/V29__last.sql\n",
        ]
        self.assertEqual(("v2.1.0", 29), latest_release_boundary("base-sha"))
        self.assertEqual(2, run_git.call_count)

    def test_workflows_are_unprivileged_and_have_fixed_status_names(self):
        root = Path(__file__).resolve().parents[2] / ".github" / "workflows"
        workflows = {name: (root / name).read_text(encoding="utf-8") for name in ("ci.yml", "check-migrations.yml")}
        self.assertEqual([], workflow_policy_errors(workflows))
        workflows["ci.yml"] += "\n  deploy:\n    environment: production\n"
        self.assertTrue(workflow_policy_errors(workflows))


if __name__ == "__main__":
    unittest.main()
