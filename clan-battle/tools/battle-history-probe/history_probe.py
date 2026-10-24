"""Read-only clan battle capture/normalization prototype. No game requests are sent.

JSON is tried first (historical Korean cyutils implementation). Optional MessagePack
and legacy AES-CBC support follow the documented pcr-exporter wire format.
"""
from __future__ import annotations

import base64
import csv
import hashlib
import html
import io
import json
import math
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

VERSION = "0.1.0"
KST = timezone(timedelta(hours=9))
MAX_BODY = 8 * 1024 * 1024
MAX_ROWS = 20000
DEFAULT_HOSTS = ["live.pcr.kakaogame.com"]
# Only these observed read endpoints are decoded. Public tactic logs, rankings,
# per-unit reports, simulated battles and battle start/finish are excluded.
ENDPOINTS = {"/clan_battle/top", "/clan_battle/mylog"}
AGREEMENT = "/check/check_agreement"
CONTEXT_KEYS = ("clan_id", "clan_battle_id")
KNOWN_PREFIX = bytes([130, 172, 100, 97, 116, 97, 95, 104, 101, 97, 100, 101, 114, 115, 133, 170])


class ProbeError(ValueError):
    pass


def endpoint_of(url: str) -> str:
    path = urlsplit(url).path.rstrip("/")
    if path.startswith("/index.php/"):
        path = path[len("/index.php"):]
    return path


def integer(value, low=0, high=9007199254740991):
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, str):
        if not re.fullmatch(r"\d{1,16}", value):
            return None
        value = int(value)
    if not isinstance(value, (int, float)) or (isinstance(value, float) and (not math.isfinite(value) or int(value) != value)):
        return None
    return int(value) if low <= value <= high else None


def text(value, limit=80):
    if not isinstance(value, str):
        return ""
    return re.sub(r"[\x00-\x1f\x7f]", "", value).strip()[:limit]


def first(row, *keys):
    return next((row[k] for k in keys if row.get(k) is not None), None)


def game_time(value):
    """Only explicit game timestamps, never capture time or battle duration."""
    stamp = integer(value, 1262304000, 4102444799)
    if stamp is not None:
        return datetime.fromtimestamp(stamp, KST).isoformat(timespec="seconds")
    if isinstance(value, str) and re.fullmatch(r"20\d{2}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\+09:00|Z)?", value):
        try:
            date = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return date.replace(tzinfo=date.tzinfo or KST).astimezone(KST).isoformat(timespec="seconds")
        except ValueError:
            pass
    return None


def object_body(body: bytes):
    if len(body) > MAX_BODY:
        raise ProbeError("body-too-large")
    try:
        obj = json.loads(body.decode("utf-8-sig"))
        if isinstance(obj, dict):
            return obj, "json"
    except (UnicodeError, ValueError, RecursionError):
        pass
    try:
        import msgpack
        obj = msgpack.unpackb(body, raw=False, strict_map_key=False)
        if isinstance(obj, dict) and obj:
            return obj, "msgpack"
    except (ImportError, ValueError, TypeError, UnicodeError):
        pass
    raise ProbeError("unknown-format")


def wire_candidates(body):
    yield body
    try:
        decoded = base64.b64decode(body.strip(), validate=True)
        if decoded and decoded != body:
            yield decoded
    except ValueError:
        pass


def legacy_decrypt(body, iv):
    if len(iv) != 16 or len(body) < 48 or (len(body) - 32) % 16:
        raise ProbeError("legacy-layout-mismatch")
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    decryptor = Cipher(algorithms.AES(body[-32:]), modes.CBC(iv)).decryptor()
    plain = decryptor.update(body[:-32]) + decryptor.finalize()
    padding = plain[-1]
    if not 1 <= padding <= 16 or plain[-padding:] != bytes([padding]) * padding:
        raise ProbeError("legacy-padding-mismatch")
    return plain[:-padding]


def decode_body(body, iv=None):
    for candidate in wire_candidates(body):
        try:
            return object_body(candidate)
        except ProbeError:
            pass
        if iv is not None:
            try:
                obj, _ = object_body(legacy_decrypt(candidate, iv))
                return obj, "legacy-aes-msgpack"
            except (ProbeError, ImportError, ValueError):
                pass
    raise ProbeError("decode-failed")


def infer_legacy_iv(response, request):
    """Legacy compatibility only; candidate IV is validated against BOTH messages.

    Session-specific IV is kept in memory, never printed, exported or persisted.
    A changed prefix/protocol fails closed rather than inventing decoded values.
    """
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    for raw in wire_candidates(response):
        if len(raw) < 48 or (len(raw) - 32) % 16:
            continue
        decryptor = Cipher(algorithms.AES(raw[-32:]), modes.CBC(bytes(16))).decryptor()
        head = decryptor.update(raw[:16])
        iv = bytes(a ^ b for a, b in zip(head, KNOWN_PREFIX))
        try:
            obj, _ = decode_body(response, iv)
            req, codec = decode_body(request, iv)
            if codec.startswith("legacy-") and isinstance(obj.get("data_headers"), dict) and req:
                return iv
        except ProbeError:
            pass
    raise ProbeError("legacy-iv-unavailable")


def shape(obj):
    """Bounded structural diagnostics: key names/types/counts, never values."""
    def outline(value, depth=0):
        if depth > 3 and isinstance(value, (list, dict)):
            return "array" if isinstance(value, list) else "object"
        if isinstance(value, dict):
            if depth > 3:
                return "object"
            return {key: outline(val, depth + 1) for key, val in list(value.items())[:80]
                    if isinstance(key, str) and re.fullmatch(r"[a-z_][a-z0-9_]{0,63}", key)}
        if isinstance(value, list):
            return {"type": "array", "count": len(value), "item": outline(value[0], depth + 1) if value else None}
        return "null" if value is None else "bool" if isinstance(value, bool) else "number" if isinstance(value, (int, float)) else "string"
    return outline(obj)


def extract_records(obj, endpoint, request=None):
    if endpoint not in ENDPOINTS:
        return []
    headers = obj.get("data_headers")
    if isinstance(headers, dict) and headers.get("result_code") is not None and integer(headers["result_code"]) != 1:
        raise ProbeError("game-api-error")
    data = obj.get("data", obj)
    if not isinstance(data, dict):
        raise ProbeError("data-not-object")
    # Mode enum values are not confirmed on the current Korean server.
    # Preserve the code for review, without assuming 0/1 means clan/single.
    game_mode = integer(data.get("clan_battle_mode"), 0, 10)
    request = request if isinstance(request, dict) else {}
    scope = {}
    for key in CONTEXT_KEYS:
        val = integer(first(data, key), 1)
        if val is None:
            val = integer(request.get(key), 1)
        if val is not None:
            scope[key] = str(val)
    list_key = "damage_history" if endpoint.endswith("/top") else "actual_logs"
    records = data.get(list_key)
    if records is None:
        return []
    if not isinstance(records, list):
        raise ProbeError("history-not-list")
    if len(records) > MAX_ROWS:
        raise ProbeError("too-many-records")
    output = []
    for raw in records:
        if not isinstance(raw, dict):
            continue
        member = text(first(raw, "name", "user_name", "member_name"))
        damage = integer(first(raw, "damage", "total_damage"))
        boss = integer(raw.get("order_num"), 1, 5)
        lap = integer(raw.get("lap_num"), 1, 100000)
        stage = integer(first(raw, "phase", "phase_num"), 1, 10)
        at = game_time(first(raw, "create_time", "battle_end_time"))
        carry_value = first(raw, "is_carry_over", "is_carry", "carry_over_flag")
        carry_int = integer(carry_value, 0, 1)
        carry = carry_value if isinstance(carry_value, bool) else bool(carry_int) if carry_int is not None else None
        start = integer(raw.get("start_remain_time"), 0, 90)
        source_id = integer(first(raw, "history_id", "battle_log_id", "mylog_id"), 1)
        kind = "clan-history" if list_key == "damage_history" else "my-history"
        row = dict(recordKind=kind, memberName=member, bossId=boss, lap=lap,
                   stage=stage, damage=damage, gameAt=at, carry=carry,
                   startRemainTime=start, gameMode=game_mode, scope=scope.copy(), sourceRecordId=str(source_id) if source_id else None)
        identity = [kind, scope, str(source_id)] if source_id and scope.get("clan_battle_id") else [kind, scope, member, boss, lap, damage, at, source_id]
        row["recordKey"] = hashlib.sha256(json.dumps(identity, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:32]
        reasons = []
        if game_mode is not None:
            reasons.append("게임 모드 코드 확인 필요")
        for value, message in [(member, "닉네임 미확인"), (boss, "보스 미확인"), (lap, "회차 미확인"), (at, "공격 시각 미확인")]:
            if not value:
                reasons.append(message)
        if damage is None:
            reasons.append("피해량 미확인")
        if carry is None:
            reasons.append("이월 사용 여부 확인 필요")
        if not scope.get("clan_id"):
            reasons.append("클랜 범위 확인 필요")
        if not scope.get("clan_battle_id"):
            reasons.append("클랜전 개최 범위 확인 필요")
        if not source_id:
            reasons.append("원본 기록 ID 미확인 · 중복 여부 확인 필요")
        # Stage can be computed by the site's configured lap rules, never guessed here.
        row["reviewReasons"] = reasons
        output.append(row)
    return output


def atomic_write(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    with open(temp, "w", encoding="utf-8", newline="") as file:
        file.write(content)
    os.replace(temp, path)


def csv_text(rows):
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
    fields = ["recordKey", "recordKind", "memberName", "bossId", "lap", "stage", "damage", "gameAt", "carry", "startRemainTime", "reviewReasons"]
    writer.writerow(fields)
    for row in rows:
        values = []
        for key in fields:
            value = row.get(key)
            value = " · ".join(value) if isinstance(value, list) else "" if value is None else str(value)
            # Prevent spreadsheet formula execution for player-supplied names.
            values.append("'" + value if value.startswith(("=", "+", "-", "@")) else value)
        writer.writerow(values)
    return "\ufeff" + buffer.getvalue()


def report_html(rows, diagnostic):
    esc = lambda value: html.escape(str(value if value is not None else "—"), quote=True)
    body = "".join("<tr>" + "".join("<td>" + esc(value) + "</td>" for value in [
        r["memberName"] or "—", r["bossId"], r["lap"], r["damage"], r["gameAt"],
        "사용" if r["carry"] is True else "미사용" if r["carry"] is False else "미확인",
        " · ".join(r["reviewReasons"]) or "필수 값 확인됨"]) + "</tr>" for r in rows)
    status = "응답 추출됨 · 게임 화면 대조 필요" if rows else "배틀이력 추출 대기"
    if diagnostic.get("mode") == "connection-discovery":
        status = "서버 주소 확인 중 · 인증서 설치 없이 연결을 확인합니다"
    if diagnostic.get("inputKind") == "synthetic-fixture":
        status = "합성 예제 결과 · 실제 게임에서 추출한 기록이 아닙니다"
    return """<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>냥냥클랜 · 배틀이력 추출 검증</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f1f8;color:#352941;font:16px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:48px auto;padding:0 20px}header,section{padding:26px;background:#fff;border:1px solid #e5ddef;border-radius:18px;margin-bottom:20px}h1{margin:0 0 10px;font-size:27px}h2{font-size:18px;margin:0 0 12px}p{margin:8px 0}.tag{display:inline-block;background:#ece4f6;color:#68498c;padding:4px 12px;border-radius:8px;font-weight:700}.muted{color:#74677e;font-size:14px}.count{font-size:32px;font-weight:800}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid #eee7f4;vertical-align:top}th{background:#f9f6fc;white-space:nowrap}td:nth-child(4){font-variant-numeric:tabular-nums;font-weight:700}td:last-child{min-width:180px;color:#8b6269}a{color:#704ca1;font-weight:650}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f8f5fb;padding:16px;border-radius:10px;font-size:13px}@media(max-width:600px){main{margin:20px auto;padding:0 12px}header,section{padding:18px}h1{font-size:22px}}
</style><main><header><div class="tag">한국 서버 호환성 검증 · v0.1</div><h1>냥냥클랜 배틀이력 수집기</h1><p>STATUS</p><p><strong>""" + esc(status) + "</strong></p><p class=muted>이 보고서는 게임에서 PC로 수신된 응답을 정리한 검증 결과입니다. 사이트의 기존 배틀로그에는 등록하지 않습니다. 최신 결과를 보려면 새로고침하세요.</p></header><section><h2>추출한 공격 후보</h2><div class=count>" + str(len(rows)) + "건</div><p><a href=battle-history-review.json>검토용 JSON</a> · <a href=battle-history.csv>CSV</a> · <a href=diagnostic.json>진단 파일</a></p><div class=scroll><table><thead><tr><th>클랜원</th><th>보스</th><th>회차</th><th>피해량</th><th>공격 시각 (한국)</th><th>이월</th><th>확인할 항목</th></tr></thead><tbody>" + (body or '<tr><td colspan=7>게임에서 클랜전 상황판과 배틀이력을 열어 주세요.</td></tr>') + "</tbody></table></div></section><section><h2>연결 진단</h2><p class=muted>진단 파일에는 응답 형식과 필드 이름만 포함됩니다. 공격 후보가 있어도 한섭 호환성 검증 완료를 뜻하지는 않습니다.</p><pre>" + esc(json.dumps(diagnostic, ensure_ascii=False, indent=2)) + "</pre></section></main></html>"


class Session:
    def __init__(self, output):
        self.output = Path(output)
        self.rows = {}
        self.diagnostic = {"version": VERSION, "liveKoreanVerification": "pending", "responses": 0, "duplicates": 0, "endpoints": {}, "errors": []}
        self.flush()

    def record_error(self, code):
        if code not in self.diagnostic["errors"]:
            self.diagnostic["errors"].append(code)
        self.flush()

    def consume(self, endpoint, response, request=None, codec="json"):
        if endpoint not in ENDPOINTS:
            return 0
        self.diagnostic["responses"] += 1
        self.diagnostic["endpoints"][endpoint] = {"codec": codec, "shape": shape(response)}
        records = extract_records(response, endpoint, request)
        added = 0
        for row in records:
            key = row["recordKey"]
            stable_id = row["sourceRecordId"] and all(row["scope"].get(k) for k in CONTEXT_KEYS)
            if key in self.rows and stable_id:
                self.diagnostic["duplicates"] += 1
                # Do not silently overwrite conflicting damage/name/time from another response.
                previous = self.rows[key]
                if any(previous[k] != row[k] for k in ("memberName", "bossId", "lap", "damage", "gameAt")):
                    reason = "같은 원본 ID의 값이 달라 원문 대조 필요"
                    if reason not in previous["reviewReasons"]:
                        previous["reviewReasons"].append(reason)
                continue
            if key in self.rows:
                # Equal values are not proof of an identical attack without a scoped ID.
                reason = "원본 ID·범위 부족으로 중복 후보 보존 · 직접 확인 필요"
                if reason not in self.rows[key]["reviewReasons"]:
                    self.rows[key]["reviewReasons"].append(reason)
                row["reviewReasons"].append(reason)
                index = 2
                while key + "-" + str(index) in self.rows:
                    index += 1
                key += "-" + str(index)
                row["recordKey"] = key
            if len(self.rows) >= MAX_ROWS:
                raise ProbeError("session-record-limit")
            self.rows[key] = row
            added += 1
        self.flush()
        return added

    def flush(self):
        rows = sorted(self.rows.values(), key=lambda r: r["gameAt"] or "9999")
        # Equal-second attacks cannot be ordered by random IDs; make this explicit.
        times = {}
        for row in rows:
            if row["gameAt"]:
                times.setdefault(row["gameAt"], []).append(row)
        for group in times.values():
            if len(group) > 1:
                for row in group:
                    reason = "같은 초의 공격 순서 확인 필요"
                    if reason not in row["reviewReasons"]:
                        row["reviewReasons"].append(reason)
        self.diagnostic["candidates"] = len(rows)
        diagnostic = json.dumps(self.diagnostic, ensure_ascii=False, indent=2)
        document = {"format": "nyang-battle-history-review-v1", "server": "kr-unverified", "automaticallyImportable": False, "records": rows}
        atomic_write(self.output / "battle-history-review.json", json.dumps(document, ensure_ascii=False, indent=2))
        atomic_write(self.output / "battle-history.csv", csv_text(rows))
        atomic_write(self.output / "diagnostic.json", diagnostic)
        atomic_write(self.output / "report.html", report_html(rows, self.diagnostic))
