"""新版大屏启动入口。

保留原文件名，实际运行与当前大屏匹配的监控服务。
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
import hashlib
import hmac
import json
import mimetypes
import os
import secrets


ROOT = Path(__file__).resolve().parent
STATIC_DIR = Path(os.getenv("MONITOR_STATIC_DIR", ROOT / "dist" / "client")).resolve()
HOST = os.getenv("MONITOR_HOST", "127.0.0.1")
PORT = int(os.getenv("MONITOR_PORT", "8000"))
PASSWORD = os.getenv("MONITOR_PASSWORD", "demo123")
SECRET_KEY = os.getenv("MONITOR_SECRET_KEY", "change-me-in-production")

FLOW_DEFINITIONS = [
    ("开市流程", 150), ("LTS冒烟", 120), ("系统重启", 130),
    ("A5清算后流程", 140), ("营运流程", 160),
    ("闭市清算流程", 150), ("日间定时流程", 150),
]
OPERATION_NAMES = ["前置检查", "查询数据库", "参数校验", "启动任务", "结果校验", "生成文件", "发送下游", "等待回执", "状态更新", "完成确认"]
OPERATION_SOURCES = ["调度平台", "业务库", "规则引擎", "作业调度器", "校验服务", "文件服务", "下游系统", "外部回执", "状态库", "任务中心"]
STATUS_TEXT = {"done": "执行完成", "running": "执行中", "error": "操作异常", "timeout": "操作超时", "waiting": "未执行", "ack": "异常已确认"}
PRIORITY = {"error": 0, "timeout": 1, "running": 2, "done": 3}


def sign(value: str) -> str:
    digest = hmac.new(SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()
    return f"{value}.{digest}"


def valid_token(token: str) -> bool:
    if not token or "." not in token:
        return False
    value, digest = token.rsplit(".", 1)
    return value == "authenticated" and hmac.compare_digest(sign(value).rsplit(".", 1)[1], digest)


def load_fixture() -> list[tuple[str, int | None]]:
    """复用当前前端的演示状态，确保两个界面初始显示一致。"""
    fixture_file = ROOT / "lib" / "mock-fixture.json"
    try:
        raw = json.loads(fixture_file.read_text(encoding="utf-8"))
        return [(item[0], item[1]) for item in raw]
    except (OSError, ValueError, IndexError, TypeError):
        return [("done", None)] * sum(total for _, total in FLOW_DEFINITIONS)


def build_operations(overall: str, stop_step: int | None) -> list[dict]:
    operations = []
    for index, name in enumerate(OPERATION_NAMES):
        status = "waiting"
        if overall == "done":
            status = "done"
        elif stop_step is not None and index < stop_step:
            status = "done"
        elif stop_step == index:
            status = overall

        operation = {
            "index": index,
            "name": name,
            "status": status,
            "duration": {"done": f"{90 + ((index + 1) * 53) % 700}ms", "running": "进行中", "error": "3.4s", "timeout": "9.1s", "waiting": "—", "ack": "420ms"}[status],
            "source": OPERATION_SOURCES[index],
        }
        if status == "error":
            operation.update(issue="数据库连接失败，操作未完成", code="OPS-DB-102")
        if status == "timeout":
            operation.update(issue="等待下游响应超过阈值", code="OPS-TIMEOUT-018")
        operations.append(operation)
    return operations


def load_demo_flows() -> list[dict]:
    """演示数据入口。接真实数据时只替换本函数，并保持返回字段不变。"""
    fixture = load_fixture()
    flows: list[dict] = []
    sequence = 1
    for big_index, (big_name, total) in enumerate(FLOW_DEFINITIONS):
        for local_index in range(1, total + 1):
            overall, stop_step = fixture[sequence - 1]
            flows.append({
                "id": f"SF-{sequence:05d}", "bigIndex": big_index, "bigName": big_name,
                "name": f"{big_name}-{local_index:03d}", "overall": overall,
                "startTime": f"{8 + sequence % 11:02d}:{sequence * 7 % 60:02d}:{sequence * 13 % 60:02d}",
                "operations": build_operations(overall, stop_step),
            })
            sequence += 1
    return flows


def dashboard() -> dict:
    flows = load_demo_flows()
    groups = []
    for index, (name, total) in enumerate(FLOW_DEFINITIONS):
        rows = [flow for flow in flows if flow["bigIndex"] == index]
        rows.sort(key=lambda flow: (PRIORITY[flow["overall"]], flow["id"]))
        counts = Counter(flow["overall"] for flow in rows)
        groups.append({
            "index": index, "name": name, "total": total,
            "done": counts["done"], "running": counts["running"],
            "error": counts["error"], "timeout": counts["timeout"],
            "all": rows, "problems": [flow for flow in rows if flow["overall"] in ("error", "timeout")],
        })
    return {
        "total": len(flows),
        "done": sum(group["done"] for group in groups), "running": sum(group["running"] for group in groups),
        "error": sum(group["error"] for group in groups), "timeout": sum(group["timeout"] for group in groups),
        "groups": groups,
    }


def alerts() -> dict:
    """由异常流程生成当前告警示例；真实接入时改为读取监控平台或告警表。"""
    now = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S")
    devices = [("10.21.8.17", "生产数据库-01", "资金清算", "Zabbix"), ("10.21.5.32", "应用节点-A03", "交易中台", "应用日志"), ("10.21.9.46", "文件服务器-02", "批处理平台", "Prometheus")]
    result = []
    for index, flow in enumerate(flow for flow in load_demo_flows() if flow["overall"] in ("error", "timeout")):
        ip, device, system, source = devices[index % len(devices)]
        failed = next(operation for operation in flow["operations"] if operation["status"] in ("error", "timeout"))
        result.append({
            "id": f"ALT-{flow['id'].replace('SF-', '')}",
            "level": "紧急" if flow["overall"] == "error" else "严重",
            "ip": ip, "device": device, "system": system, "source": source, "time": now,
            "content": f"{flow['name']}：{failed['issue']}", "status": "未确认",
            "flowId": flow["id"], "operationIndex": failed["index"],
        })
    return {"total": len(result), "items": result}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        return

    def authenticated(self) -> bool:
        cookies = SimpleCookie()
        cookies.load(self.headers.get("Cookie", ""))
        morsel = cookies.get("monitor_auth")
        return bool(morsel and valid_token(morsel.value))

    def send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, file_path: Path) -> None:
        try:
            body = file_path.read_bytes()
        except OSError:
            return self.send_json({"error": "not found"}, 404)
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache" if file_path.suffix == ".html" else "public, max-age=3600")
        self.end_headers()
        self.wfile.write(body)

    def static_file(self, path: str) -> Path | None:
        request_path = "index.html" if path in ("", "/") else unquote(path).lstrip("/")
        candidate = (STATIC_DIR / request_path).resolve()
        if candidate.is_dir():
            candidate /= "index.html"
        try:
            candidate.relative_to(STATIC_DIR)
        except ValueError:
            return None
        if candidate.is_file():
            return candidate
        return STATIC_DIR / "index.html" if (STATIC_DIR / "index.html").is_file() else None

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        if parsed.path == "/api/health":
            return self.send_json({"status": "ok", "time": datetime.now(timezone.utc).isoformat()})
        if parsed.path.startswith("/api/"):
            if not self.authenticated():
                return self.send_json({"error": "unauthorized"}, 401)
            if parsed.path == "/api/dashboard":
                return self.send_json(dashboard())
            if parsed.path == "/api/alerts":
                return self.send_json(alerts())
            if parsed.path == "/api/flow":
                flow_id = params.get("id", [""])[0]
                flow = next((item for item in load_demo_flows() if item["id"] == flow_id), None)
                return self.send_json(flow or {"error": "小流程不存在"}, 200 if flow else 404)
            return self.send_json({"error": "not found"}, 404)

        target = self.static_file(parsed.path)
        if target is None:
            return self.send_json({"error": "请先运行 pnpm run build 生成网页文件"}, 404)
        self.send_file(target)


def run() -> None:
    if PASSWORD == "demo123" or SECRET_KEY == "change-me-in-production":
        print("警告：当前为演示凭据；接入真实数据前必须设置 MONITOR_PASSWORD 和 MONITOR_SECRET_KEY。")
    print(f"监控服务：http://{HOST}:{PORT}")
    print("流程接口：/api/dashboard，告警接口：/api/alerts，健康检查：/api/health")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()



if __name__ == "__main__":
    run()

