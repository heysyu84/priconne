"""Windows-friendly entry point for the Korean battle history probe."""
import argparse
import base64
import importlib.metadata
import ipaddress
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import webbrowser
from datetime import datetime
from urllib.parse import urlsplit

from history_probe import (DEFAULT_HOSTS, ENDPOINTS, MAX_BODY, ProbeError, Session,
                           decode_body, endpoint_of, KST)

ROOT = Path(__file__).resolve().parent


def new_output():
    # Never overwrite a previous real capture or merge it silently with another month.
    base = ROOT / "output" / datetime.now(KST).strftime("%Y%m%d-%H%M%S")
    output = base
    index = 1
    while output.exists():
        output = base.with_name(base.name + "-" + str(index))
        index += 1
    return output


def settings():
    config = {"hosts": DEFAULT_HOSTS, "listen": "127.0.0.1", "port": 8877}
    path = ROOT / "config.json"
    if path.exists():
        config.update(json.loads(path.read_text(encoding="utf-8-sig")))
    hosts = config.get("hosts")
    if not isinstance(hosts, list) or not hosts or any(not isinstance(h, str) or not re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?", h) for h in hosts):
        raise ProbeError("config.json의 hosts에는 프로토콜·포트 없이 서버 호스트 이름만 적으세요.")
    config["hosts"] = [h.lower() for h in hosts]
    port = config.get("port")
    if type(port) is not int or not 1024 <= port <= 65535:
        raise ProbeError("프록시 port는 1024~65535 정수여야 합니다.")
    try:
        listen = ipaddress.ip_address(config["listen"])
        if listen.version != 4 or not (listen.is_private or listen.is_loopback or listen.is_unspecified):
            raise ValueError()
    except (TypeError, ValueError):
        raise ProbeError("listen에는 127.0.0.1, PC의 사설 IPv4 주소 또는 0.0.0.0을 적으세요.")
    return config


def find_mitmdump():
    binary = Path(sys.executable).parent / ("mitmdump.exe" if os.name == "nt" else "mitmdump")
    if not binary.exists():
        raise ProbeError("먼저 1-install.cmd를 실행하세요. mitmproxy 설치가 필요합니다.")
    return binary


def run_capture(args):
    config = settings()
    if args.listen:
        config["listen"] = args.listen
        # Validate CLI override through the same IPv4 check without writing config.
        address = ipaddress.ip_address(args.listen)
        if address.version != 4 or not (address.is_private or address.is_loopback or address.is_unspecified):
            raise ProbeError("PC의 사설 IPv4 주소를 사용하세요.")
    binary = find_mitmdump()
    output = new_output()
    session = Session(output)
    discovery = args.command == "discover"
    if discovery:
        session.diagnostic.update(mode="connection-discovery", gameHosts={})
        session.flush()
    print("냥냥클랜 · 한국 서버 배틀이력 추출 검증 v0.1", flush=True)
    print("프록시:", config["listen"], ":", config["port"], flush=True)
    print("검토 화면:", output / "report.html", flush=True)
    print("앱플레이어의 프록시를 연결한 뒤 게임에서 클랜전 상황판 / 배틀이력을 열어 주세요.", flush=True)
    print("종료: Ctrl+C. 종료 후 앱플레이어의 프록시 설정을 해제하세요.", flush=True)
    print("지원 여부는 실측 전입니다. 기존 사이트 기록은 변경하지 않습니다.", flush=True)
    if discovery:
        print("연결 확인 모드: TLS를 복호화하지 않고 게임 관련 서버 주소만 확인합니다. 인증서 설치는 필요 없습니다.", flush=True)
    env = dict(os.environ, NYANG_PROBE_RUNNING="1", NYANG_PROBE_OUTPUT=str(output), NYANG_PROBE_HOSTS=",".join(config["hosts"]), NYANG_PROBE_DISCOVERY="1" if discovery else "0")
    # Restrict TLS interception to explicitly configured game hosts. No game API
    # retries, auto-login, credential input, request replay, or flow-dump file.
    command = [str(binary), "-s", str(ROOT / "collector.py"),
               "--listen-host", config["listen"], "--listen-port", str(config["port"]),
               "--set", "confdir=" + str(ROOT / ".certs"),
               "--set", "flow_detail=0", "--set", "termlog_verbosity=warn",
               "--set", "connection_strategy=lazy", "--set", "http2=false"]
    if discovery:
        command.extend(["--ignore-hosts", ".*"])
    else:
        for host in config["hosts"]:
            command.extend(["--allow-hosts", r"^" + re.escape(host) + r"(?::\d+)?$"])
    print("mitmproxy", importlib.metadata.version("mitmproxy"), flush=True)
    if not args.no_open:
        webbrowser.open((output / "report.html").as_uri())
    try:
        return subprocess.call(command, env=env, cwd=ROOT)
    except KeyboardInterrupt:
        return 0
    finally:
        print("검증 결과:", output, flush=True)


def convert(args):
    source = Path(args.input)
    if source.stat().st_size > 64 * 1024 * 1024:
        raise ProbeError("입력 파일은 64MB 이하로 사용하세요.")
    output = new_output()
    session = Session(output)
    if source.suffix.lower() == ".har":
        document = json.loads(source.read_text(encoding="utf-8-sig"))
        hosts = set(settings()["hosts"])
        for entry in document.get("log", {}).get("entries", []):
            url = entry.get("request", {}).get("url", "")
            route = endpoint_of(url)
            if urlsplit(url).hostname not in hosts or route not in ENDPOINTS:
                continue
            if not 200 <= entry.get("response", {}).get("status", 0) < 300:
                session.record_error("game-http-error")
                continue
            content = entry.get("response", {}).get("content", {})
            try:
                body = content.get("text", "").encode("utf-8")
                if content.get("encoding") == "base64":
                    body = base64.b64decode(body, validate=True)
                obj, codec = decode_body(body)
                request_text = entry.get("request", {}).get("postData", {}).get("text", "").encode()
                context = {}
                if request_text:
                    try:
                        context, _ = decode_body(request_text)
                    except ProbeError:
                        pass
                session.consume(route, obj, context, codec)
            except (ProbeError, ValueError):
                session.record_error("har-response-decode-failed")
    else:
        obj, codec = decode_body(source.read_bytes())
        if obj.get("_probe_fixture") is True:
            session.diagnostic["inputKind"] = "synthetic-fixture"
        session.consume(endpoint_of(args.endpoint), obj, codec=codec)
    print("검토 화면:", output / "report.html")
    print("공격 후보:", len(session.rows), "건")
    if not args.no_open:
        webbrowser.open((output / "report.html").as_uri())
    return 0


def main():
    parser = argparse.ArgumentParser(description="한국 프리코네 클랜전 응답 추출 검증 (읽기 전용)")
    sub = parser.add_subparsers(dest="command", required=True)
    for name, help_text in [("run", "수동으로 연 이력 응답을 수집"), ("discover", "TLS를 복호화하지 않고 게임 서버 주소 확인")]:
        run = sub.add_parser(name, help=help_text)
        run.add_argument("--listen")
        run.add_argument("--no-open", action="store_true")
    file = sub.add_parser("convert", help="기존 JSON 응답 또는 HAR를 검토 파일로 변환")
    file.add_argument("input")
    file.add_argument("--endpoint", default="/clan_battle/top", choices=sorted(ENDPOINTS))
    file.add_argument("--no-open", action="store_true")
    sub.add_parser("check", help="환경 확인")
    args = parser.parse_args()
    try:
        if args.command in ("run", "discover"):
            return run_capture(args)
        if args.command == "convert":
            return convert(args)
        config = settings()
        print("Python:", sys.version.split()[0])
        print("mitmproxy:", importlib.metadata.version("mitmproxy"))
        print("프록시:", config["listen"], config["port"])
        print("과거 한섭 서버 주소:", ", ".join(config["hosts"]))
        print("현재 한섭 실측 검증: 대기")
        print("게임 계정/비밀번호 입력: 없음")
        return 0
    except (ProbeError, OSError, ValueError, importlib.metadata.PackageNotFoundError) as error:
        # File/parse errors may contain secrets; show specific ProbeError messages only.
        print("오류:", str(error) if isinstance(error, ProbeError) else "입력 파일·설정 또는 설치 상태를 확인하세요.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
