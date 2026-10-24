"""Exercise the actual proxy against a LOCAL synthetic game response.

No connection is made to a game server, account, or the production clan site.
"""
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import ssl
import ipaddress
from datetime import datetime, timedelta, timezone
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parent
SECRET = "INTEGRATION_SESSION_SECRET_NOT_TO_EXPORT"
SAMPLE = json.loads((ROOT / "example.synthetic.json").read_text(encoding="utf-8"))
SAMPLE["data_headers"]["sid"] = SECRET
BODY = json.dumps(SAMPLE, ensure_ascii=False).encode()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        request = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        assert SECRET in request.decode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(BODY)))
        self.send_header("Set-Cookie", "sid=" + SECRET)
        self.end_headers()
        self.wfile.write(BODY)

    def log_message(self, *args):
        pass


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        proxy_port = sock.getsockname()[1]
    binary = Path(sys.executable).parent / ("mitmdump.exe" if os.name == "nt" else "mitmdump")
    with tempfile.TemporaryDirectory() as tmp:
        output = Path(tmp) / "capture"
        env = dict(os.environ, NYANG_PROBE_RUNNING="1", NYANG_PROBE_OUTPUT=str(output), NYANG_PROBE_HOSTS="127.0.0.1")
        with open(Path(tmp) / "process.log", "w+b") as log:
            process = subprocess.Popen([str(binary), "-s", str(ROOT / "collector.py"),
                "--listen-host", "127.0.0.1", "--listen-port", str(proxy_port),
                "--set", "confdir=" + str(Path(tmp) / "certs"),
                "--set", "flow_detail=0", "--set", "termlog_verbosity=warn"],
                env=env, cwd=ROOT, stdout=log, stderr=log)
            try:
                deadline = time.monotonic() + 15
                while True:
                    if process.poll() is not None:
                        raise AssertionError("proxy startup failed")
                    try:
                        with socket.create_connection(("127.0.0.1", proxy_port), timeout=.2):
                            break
                    except OSError:
                        if time.monotonic() > deadline:
                            raise AssertionError("proxy startup timed out")
                        time.sleep(.05)
                for route in ["/index.php/clan_battle/top", "/index.php/clan_battle/top",
                              "/index.php/clan_battle/battle_log_list", "/index.php/clan_battle/finish"]:
                    connection = http.client.HTTPConnection("127.0.0.1", proxy_port, timeout=10)
                    request = json.dumps({"clan_id": 999001, "clan_battle_id": 999002, "sid": SECRET})
                    connection.request("POST", "http://127.0.0.1:" + str(server.server_port) + route,
                                       request, {"Authorization": "Bearer " + SECRET})
                    response = connection.getresponse()
                    assert response.status == 200
                    assert response.read() == BODY, "original game response was changed"
                    assert response.getheader("Set-Cookie") == "sid=" + SECRET
                    connection.close()
                records = json.loads((output / "battle-history-review.json").read_text())["records"]
                diagnostic = json.loads((output / "diagnostic.json").read_text())
                assert len(records) == 3, "duplicate/public/non-history handling failed"
                assert diagnostic["responses"] == 2
                assert diagnostic["duplicates"] == 3
                assert diagnostic["liveKoreanVerification"] == "pending"
                assert not diagnostic["errors"], diagnostic["errors"]
                assert diagnostic["observedRoutes"]["/clan_battle/battle_log_list"] == 1
                assert all(SECRET not in path.read_text(encoding="utf-8") for path in output.iterdir())
                print("PASS: actual mitmdump forwarded requests/responses unchanged; 3 candidates, 3 duplicates; public/action routes excluded; no session values saved.")
                print("Actual Korean game server verification: pending (local synthetic integration only).")
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
                server.shutdown()
                server.server_close()
    tls_discovery_test(binary)
    return 0


def tls_discovery_test(binary):
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Local integration fixture")])
    now = datetime.now(timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now - timedelta(minutes=1))
            .not_valid_after(now + timedelta(days=1))
            .add_extension(x509.SubjectAlternativeName([x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]), False)
            .sign(key, hashes.SHA256()))
    with tempfile.TemporaryDirectory() as tmp:
        directory = Path(tmp)
        pem = directory / "fixture-cert.pem"
        pem.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
        private = directory / "fixture-key.pem"
        private.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(pem, private)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        output = directory / "capture"
        env = dict(os.environ, NYANG_PROBE_RUNNING="1", NYANG_PROBE_DISCOVERY="1", NYANG_PROBE_OUTPUT=str(output))
        with open(directory / "process.log", "w+b") as log:
            process = subprocess.Popen([str(binary), "-s", str(ROOT / "collector.py"),
                "--listen-host", "127.0.0.1", "--listen-port", str(port), "--ignore-hosts", ".*",
                "--set", "confdir=" + str(directory / "certs"), "--set", "flow_detail=0", "--set", "termlog_verbosity=warn"],
                env=env, cwd=ROOT, stdout=log, stderr=log)
            try:
                deadline = time.monotonic() + 15
                while True:
                    if process.poll() is not None:
                        raise AssertionError("discovery proxy startup failed")
                    try:
                        with socket.create_connection(("127.0.0.1", port), timeout=.2):
                            break
                    except OSError:
                        if time.monotonic() > deadline:
                            raise AssertionError("discovery proxy startup timed out")
                        time.sleep(.05)
                # Only the fixture server cert is trusted; the proxy's CA is NOT.
                trust = ssl.create_default_context(cafile=str(pem))
                connection = http.client.HTTPSConnection("127.0.0.1", port, timeout=10, context=trust)
                connection.set_tunnel("127.0.0.1", server.server_port)
                connection.request("POST", "/index.php/clan_battle/top", json.dumps({"sid": SECRET}))
                response = connection.getresponse()
                assert response.status == 200 and response.read() == BODY
                connection.close()
                data = json.loads((output / "diagnostic.json").read_text())
                assert data["mode"] == "connection-discovery" and data["responses"] == 0
                assert data["candidates"] == 0
                assert all(SECRET not in f.read_text() for f in output.iterdir())
                print("PASS: discovery forwards TLS unchanged without trusting proxy CA; zero payloads decoded or saved.")
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
                server.shutdown()
                server.server_close()


if __name__ == "__main__":
    raise SystemExit(main())
