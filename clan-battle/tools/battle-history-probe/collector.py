"""mitmproxy addon: observes existing responses, never sends/replays game APIs."""
import logging
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from history_probe import (AGREEMENT, CONTEXT_KEYS, DEFAULT_HOSTS, ENDPOINTS,
                           MAX_BODY, ProbeError, Session, decode_body,
                           endpoint_of, infer_legacy_iv, integer)


class BattleHistoryCollector:
    def __init__(self, output=None, hosts=None):
        self.hosts = set(hosts or os.environ.get("NYANG_PROBE_HOSTS", ",".join(DEFAULT_HOSTS)).split(","))
        self.session = Session(output or os.environ.get("NYANG_PROBE_OUTPUT", "output"))
        self.ivs = {}
        self.discovery = os.environ.get("NYANG_PROBE_DISCOVERY") == "1"
        if self.discovery:
            self.session.diagnostic["mode"] = "connection-discovery"
            self.session.diagnostic["gameHosts"] = {}
            self.session.flush()

    def observe_host(self, flow):
        host = flow.request.host.lower()
        if not re.fullmatch(r"[a-z0-9.-]{1,253}", host):
            return
        related = re.search(r"(?:^|[.-])(?:pcr|priconne)(?:[.-]|$)", host)
        related = related or any(host == suffix or host.endswith("." + suffix) for suffix in ("kakaogame.com", "kakaogames.com", "priconne-redive.jp"))
        if related:
            hosts = self.session.diagnostic.setdefault("gameHosts", {})
            if host in hosts or len(hosts) < 40:
                info = hosts.setdefault(host, {"connections": 0, "ports": []})
                info["connections"] += 1
                if flow.request.port not in info["ports"]:
                    info["ports"].append(flow.request.port)
                self.session.flush()

    def http_connect(self, flow):
        if self.discovery:
            self.observe_host(flow)

    def target(self, flow):
        if self.discovery:
            return False
        if flow.request.host.lower() not in self.hosts:
            return False
        return endpoint_of(flow.request.path) in ENDPOINTS | {AGREEMENT}

    def requestheaders(self, flow):
        if self.discovery:
            self.observe_host(flow)
        if not self.target(flow):
            flow.request.stream = True

    def responseheaders(self, flow):
        if not self.target(flow):
            flow.response.stream = True

    def response(self, flow):
        if self.discovery:
            return
        if flow.request.host.lower() not in self.hosts or not flow.response:
            return
        endpoint = endpoint_of(flow.request.path)
        # Observe route NAMES only for diagnosing changed Korean endpoints.
        # Non-target request/response bodies are streamed and are never saved.
        if re.fullmatch(r"/clan_battle/[a-z_]{1,70}", endpoint):
            routes = self.session.diagnostic.setdefault("observedRoutes", {})
            if endpoint in routes or len(routes) < 80:
                routes[endpoint] = routes.get(endpoint, 0) + 1
        if not self.target(flow):
            self.session.flush()
            return
        if not 200 <= flow.response.status_code < 300:
            self.session.record_error("game-http-" + str(flow.response.status_code))
            return
        try:
            # Content is decompressed by mitmproxy; no changes to the original flow.
            response = flow.response.content or b""
            request = flow.request.content or b""
            if len(response) > MAX_BODY or len(request) > MAX_BODY:
                raise ProbeError("body-too-large")
            client = (flow.client_conn.peername or ("local",))[0]
            key = (client, flow.request.host)
            iv = self.ivs.get(key)
            if endpoint == AGREEMENT:
                # Plain JSON needs no session-specific decryption material.
                try:
                    decode_body(response)
                    return
                except ProbeError:
                    pass
                self.ivs.pop(key, None)
                self.ivs[key] = infer_legacy_iv(response, request)
                logging.info("[냥냥클랜] 구형 통신 형식 확인됨 (키는 저장하지 않습니다).")
                return
            obj, codec = decode_body(response, iv)
            context = {}
            if request:
                try:
                    req, _ = decode_body(request, iv)
                    context = {k: integer(req.get(k)) for k in CONTEXT_KEYS if integer(req.get(k)) is not None}
                except ProbeError:
                    pass
            count = self.session.consume(endpoint, obj, context, codec)
            logging.info("[냥냥클랜] %s · 공격 후보 %d건 추가 · 총 %d건", endpoint, count, len(self.session.rows))
        except ProbeError as error:
            self.session.record_error(str(error))
            logging.warning("[냥냥클랜] 추출 보류: %s", str(error))
        except Exception:
            # Exception messages may contain payload values; never log them.
            self.session.record_error("collector-processing-error")
            logging.warning("[냥냥클랜] 형식을 확인할 수 없습니다. 진단 파일을 확인하세요.")

    def error(self, flow):
        if flow.request.host.lower() in self.hosts:
            self.session.record_error("connection-or-certificate-error")

    def done(self):
        self.ivs.clear()
        self.session.flush()


addons = [BattleHistoryCollector()] if os.environ.get("NYANG_PROBE_RUNNING") == "1" else []
