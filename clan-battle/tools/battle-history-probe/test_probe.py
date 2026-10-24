import base64
import copy
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

from history_probe import (KNOWN_PREFIX, MAX_BODY, ProbeError, Session, decode_body,
                           endpoint_of, extract_records, game_time, infer_legacy_iv,
                           integer, report_html, shape)
from collector import BattleHistoryCollector

ROOT = Path(__file__).resolve().parent


def sample():
    return json.loads((ROOT / "example.synthetic.json").read_text(encoding="utf-8"))


def encrypt(obj, iv, key=b"X" * 32):
    import msgpack
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    data = msgpack.packb(obj, use_bin_type=True)
    data += bytes([16 - len(data) % 16]) * (16 - len(data) % 16)
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv)).encryptor()
    return cipher.update(data) + cipher.finalize() + key


class ProbeTests(unittest.TestCase):
    def test_korean_json_and_unknown_carry(self):
        obj, codec = decode_body(json.dumps(sample(), ensure_ascii=False).encode())
        rows = extract_records(obj, "/clan_battle/top")
        self.assertEqual(codec, "json")
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0]["damage"], 123456789)
        self.assertIs(rows[0]["carry"], False)
        self.assertIsNone(rows[1]["carry"])
        self.assertIs(rows[2]["carry"], True)
        self.assertTrue(rows[0]["gameAt"].endswith("+09:00"))

    def test_real_record_shapes_exclude_simulated_public_and_aggregate(self):
        obj = {"data": {"actual_logs": [{"mylog_id": 1, "order_num": 2, "lap_num": 30, "total_damage": 500, "battle_time": 90}],
                        "rehearsal_logs": [{"mylog_id": 2}], "training_logs": [{"mylog_id": 3}]}}
        rows = extract_records(obj, "/clan_battle/mylog")
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]["gameAt"])
        self.assertEqual(rows[0]["memberName"], "")
        self.assertIsNone(rows[0]["carry"])
        for route in ("/clan_battle/finish", "/clan_battle/battle_log_list", "/clan_battle/damage_report", "/clan_battle/history_report"):
            self.assertEqual(extract_records(sample(), route), [])

    def test_validation_no_date_or_carry_guesses(self):
        for value in (-1, 1.5, True, "9x", float("nan"), float("inf"), 10 ** 200):
            self.assertIsNone(integer(value))
        self.assertEqual(integer(0), 0)
        for value in (90, "0:45", "2026-02-30T12:00", None):
            self.assertIsNone(game_time(value))
        row = sample()["data"]["damage_history"][0]
        row.update(is_carry_over="2", kill=1, start_remain_time=60, damage=0)
        rows = extract_records({"data": {"damage_history": [row]}}, "/clan_battle/top")
        self.assertIsNone(rows[0]["carry"])
        self.assertEqual(rows[0]["damage"], 0)
        self.assertEqual(rows[0]["startRemainTime"], 60)

    def test_scope_aware_dedup_conflict_and_unknown_preservation(self):
        with tempfile.TemporaryDirectory() as tmp:
            session = Session(tmp)
            self.assertEqual(session.consume("/clan_battle/top", sample()), 3)
            self.assertEqual(session.consume("/clan_battle/top", sample()), 0)
            changed = sample()
            changed["data"]["damage_history"][0]["damage"] = 7
            session.consume("/clan_battle/top", changed)
            self.assertEqual(len(session.rows), 3)
            self.assertEqual(next(iter(session.rows.values()))["damage"], 123456789)
            self.assertTrue(any("같은 원본 ID" in reason for reason in next(iter(session.rows.values()))["reviewReasons"]))
            changed["data"]["clan_battle_id"] += 1
            self.assertEqual(session.consume("/clan_battle/top", changed), 3)
        with tempfile.TemporaryDirectory() as tmp:
            obj = sample()
            for row in obj["data"]["damage_history"]:
                row.pop("history_id")
            session = Session(tmp)
            session.consume("/clan_battle/top", obj)
            session.consume("/clan_battle/top", obj)
            self.assertEqual(len(session.rows), 6)

    def test_no_headers_auth_values_or_raw_body_saved_and_html_csv_safe(self):
        obj = sample()
        secret = "DO_NOT_SAVE_THIS_SESSION_TOKEN"
        obj["data_headers"]["sid"] = secret
        obj["access_token"] = secret
        obj["data"]["arbitrary_auth"] = secret
        obj["data"]["damage_history"][0]["name"] = "<script>alert(1)</script>"
        obj["data"]["damage_history"][1]["name"] = "=WEBSERVICE(1)"
        with tempfile.TemporaryDirectory() as tmp:
            session = Session(tmp)
            session.consume("/clan_battle/top", obj, {"sid": secret})
            for path in Path(tmp).iterdir():
                self.assertNotIn(secret, path.read_text(encoding="utf-8"))
            diagnostic = (Path(tmp) / "diagnostic.json").read_text()
            self.assertNotIn("alert(1)", diagnostic)
            self.assertEqual(json.loads(diagnostic)["endpoints"]["/clan_battle/top"]["shape"]["data"]["damage_history"]["item"]["name"], "string")
            self.assertNotIn("<script>", (Path(tmp) / "report.html").read_text())
            self.assertIn("'=WEBSERVICE(1)", (Path(tmp) / "battle-history.csv").read_text(encoding="utf-8-sig"))

    def test_bounded_decoding_api_errors_and_path_matching(self):
        with self.assertRaises(ProbeError):
            decode_body(b"x" * (MAX_BODY + 1))
        for obj in ({"data_headers": {"result_code": 214}, "data": {}}, {"data": {"damage_history": 123}}):
            with self.assertRaises(ProbeError):
                extract_records(obj, "/clan_battle/top")
        self.assertEqual(endpoint_of("https://example.test:10080/index.php/clan_battle/top?sid=secret"), "/clan_battle/top")
        self.assertEqual(endpoint_of("/other/index.php/clan_battle/top"), "/other/index.php/clan_battle/top")
        self.assertLess(len(json.dumps(shape({"a": [[[[[[["secret"]]]]]]]}))), 300)

    def test_legacy_cipher_and_iv_recovery(self):
        import msgpack
        iv = b"0123456789abcdef"
        response = {"data_headers": {"short_udid": 1, "viewer_id": 2, "sid": "not-exported", "servertime": 3, "result_code": 1}, "data": {}}
        self.assertEqual(msgpack.packb(response, use_bin_type=True)[:16], KNOWN_PREFIX)
        req = encrypt({"viewer_id": 2, "sample": "request"}, iv)
        res = base64.b64encode(encrypt(response, iv))
        self.assertEqual(infer_legacy_iv(res, req), iv)
        self.assertEqual(decode_body(res, iv)[0], response)
        self.assertEqual(decode_body(base64.b64encode(msgpack.packb(sample(), use_bin_type=True)))[0], sample())
        with self.assertRaises(ProbeError):
            decode_body(res, b"wrong-IV-0000000")

    def test_real_mitmproxy_flow_and_no_mutations(self):
        from mitmproxy import http
        from mitmproxy.test import tflow
        with tempfile.TemporaryDirectory() as tmp:
            addon = BattleHistoryCollector(tmp, ["example.test"])
            flow = tflow.tflow()
            flow.request = http.Request.make("POST", "https://example.test:10080/index.php/clan_battle/top", json.dumps({"clan_id": 99, "clan_battle_id": 88, "sid": "SECRET"}).encode())
            flow.response = http.Response.make(200, json.dumps(sample(), ensure_ascii=False).encode(), {"Content-Type": "application/json"})
            req, res = bytes(flow.request.content), bytes(flow.response.content)
            addon.requestheaders(flow)
            addon.responseheaders(flow)
            addon.response(flow)
            self.assertEqual(len(addon.session.rows), 3)
            self.assertEqual(flow.request.content, req)
            self.assertEqual(flow.response.content, res)
            flow.request.host = "unrelated.test"
            addon.requestheaders(flow)
            addon.responseheaders(flow)
            addon.response(flow)
            self.assertIs(flow.request.stream, True)
            self.assertIs(flow.response.stream, True)
            self.assertEqual(len(addon.session.rows), 3)
            self.assertTrue(all("SECRET" not in f.read_text() for f in Path(tmp).iterdir()))
            addon.done()

    def test_discovery_only_names_never_decodes_or_saves_payload(self):
        from mitmproxy import http
        from mitmproxy.test import tflow
        with tempfile.TemporaryDirectory() as tmp:
            addon = BattleHistoryCollector(tmp, ["live.pcr.kakaogame.com"])
            addon.discovery = True
            flow = tflow.tflow()
            flow.request = http.Request.make("CONNECT", "https://live.pcr.kakaogame.com:10080")
            flow.response = http.Response.make(200, json.dumps(sample()).encode())
            addon.http_connect(flow)
            addon.requestheaders(flow)
            addon.responseheaders(flow)
            addon.response(flow)
            self.assertEqual(len(addon.session.rows), 0)
            self.assertEqual(addon.session.diagnostic["gameHosts"]["live.pcr.kakaogame.com"]["ports"], [10080])
            self.assertIs(flow.response.stream, True)
            flow.request.host = "unrelated-private-website.test"
            addon.http_connect(flow)
            self.assertNotIn(flow.request.host, addon.session.diagnostic["gameHosts"])
            self.assertNotIn("예제 클랜원", (Path(tmp) / "diagnostic.json").read_text())


if __name__ == "__main__":
    unittest.main(verbosity=2)
