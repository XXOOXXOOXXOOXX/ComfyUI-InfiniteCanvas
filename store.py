import json
import math
import re
import threading
import time
import uuid
from pathlib import Path

class StudioError(ValueError):
    pass

def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{32}", value):
        raise StudioError("画布 ID 无效。")
    return value

def validate_board(board):
    if not isinstance(board, dict) or board.get("version") != 1:
        raise StudioError("不是有效的无限画布文件。")
    identifier(board.get("id"))
    if not isinstance(board.get("name"), str) or len(board["name"]) > 500:
        raise StudioError("画布名称无效。")
    if not isinstance(board.get("folder", ""), str) or len(board.get("folder", "")) > 500:
        raise StudioError("项目文件夹名称无效。")
    nodes, links, assets = board.get("nodes"), board.get("links"), board.get("assets")
    if not isinstance(nodes, list) or len(nodes) > 10000 or not isinstance(links, list) or len(links) > 30000 or not isinstance(assets, dict):
        raise StudioError("画布节点或连线格式无效。")
    seen = set()
    for node in nodes:
        if not isinstance(node, dict) or node.get("kind") not in {"asset", "ollama", "text", "image", "video", "director", "audio", "script"}:
            raise StudioError("画布节点类型无效。")
        key = identifier(node.get("id"))
        if key in seen:
            raise StudioError("节点 ID 重复。")
        seen.add(key)
        if any(type(node.get(field)) not in (int, float) or not math.isfinite(node[field]) for field in ("x", "y", "w", "h")):
            raise StudioError("节点位置或尺寸无效。")
    for link in links:
        if not isinstance(link, dict) or link.get("from") not in seen or link.get("to") not in seen or link["from"] == link["to"]:
            raise StudioError("连线引用无效。")
    if len(json.dumps(board, ensure_ascii=False)) > 16_000_000:
        raise StudioError("画布信息过大；请删除不需要的节点后重试。")
    return board

class BoardStore:
    lock = threading.RLock()
    def __init__(self, root):
        self.root = Path(root)
    def file(self, key):
        return self.root / (identifier(key) + ".json")
    def read(self, key):
        return json.loads(self.file(key).read_text(encoding="utf-8"))
    def list(self):
        items = []
        for path in self.root.glob("*.json"):
            try:
                board = self.read(path.stem)
                assets = board.get("assets", {})
                cover = assets.get(board.get("coverId")) or next((assets.get(key) for node in board["nodes"] for key in node.get("assetIds", []) if assets.get(key, {}).get("kind") == "image"), None)
                items.append({"id": board["id"], "name": board["name"], "updated": board.get("updated", 0), "nodes": len(board["nodes"]), "folder": board.get("folder", ""), "cover": cover})
            except (OSError, ValueError, KeyError):
                continue
        return sorted(items, key=lambda item: item["updated"], reverse=True)
    def write(self, key, board):
        validate_board(board)
        if identifier(key) != board["id"]:
            raise StudioError("画布 ID 不匹配。")
        with self.lock:
            self.root.mkdir(parents=True, exist_ok=True)
            board = dict(board, updated=time.time())
            temporary = self.root / (uuid.uuid4().hex + ".tmp")
            try:
                temporary.write_text(json.dumps(board, ensure_ascii=False), encoding="utf-8")
                temporary.replace(self.file(key))
            finally:
                temporary.unlink(missing_ok=True)
        return board
