"""Deterministic source-only Windows package. Never include runtime captures/keys."""
from pathlib import Path
import hashlib
import zipfile

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
FILES = ["README.md", "THIRD_PARTY_NOTICES.md", "history_probe.py", "collector.py", "probe.py",
         "requirements.txt", "config.example.json", "1-install.cmd", "2-start.cmd", "3-open-report.cmd",
         "example.synthetic.json", "test_probe.py", "integration_test.py", "build_package.py", ".gitignore"]
NAME = "nyang-battle-history-probe-v0.1.zip"


def main():
    destination = REPO / "clan-battle/public/downloads" / NAME
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in FILES:
            data = (ROOT / name).read_bytes()
            if name.endswith(".cmd"):
                data = data.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
            info = zipfile.ZipInfo("nyang-battle-history-probe/" + name, (2026, 10, 24, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    mirror = REPO / "docs/downloads" / NAME
    mirror.parent.mkdir(parents=True, exist_ok=True)
    mirror.write_bytes(destination.read_bytes())
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(FILES)
        assert all(not any(part in path for part in ["output/", ".certs/", ".venv/", "config.json", "__pycache__", ".har"]) for path in archive.namelist())
    print(destination)
    print("sha256:", hashlib.sha256(destination.read_bytes()).hexdigest())
    print("bytes:", destination.stat().st_size)


if __name__ == "__main__":
    main()
