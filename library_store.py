import json
import threading
import uuid
from pathlib import Path
from .store import StudioError, identifier


def new_library():
    return {"version": 1, "folders": [{"id": uuid.uuid4().hex, "name": name, "parent": ""} for name in ("角色", "场景", "物品", "风格", "音效")], "assets": {}}


def validate_library(value):
    if not isinstance(value, dict) or value.get("version") != 1 or not isinstance(value.get("folders"), list) or not isinstance(value.get("assets"), dict):
        raise StudioError("资产库格式无效。")
    if len(value["folders"]) > 2000 or len(value["assets"]) > 10000 or len(json.dumps(value, ensure_ascii=False)) > 16_000_000:
        raise StudioError("资产库信息过大。")
    folders = {}
    for folder in value["folders"]:
        if not isinstance(folder, dict) or not isinstance(folder.get("name"), str) or not folder["name"].strip() or len(folder["name"]) > 200:
            raise StudioError("资产文件夹名称无效。")
        key = identifier(folder.get("id"))
        if key in folders:
            raise StudioError("资产文件夹 ID 重复。")
        folders[key] = folder
    for key, folder in folders.items():
        seen = {key}
        parent = folder.get("parent", "")
        while parent:
            if parent not in folders or parent in seen:
                raise StudioError("资产文件夹层级无效。")
            seen.add(parent)
            parent = folders[parent].get("parent", "")
    for key, asset in value["assets"].items():
        identifier(key)
        if not isinstance(asset, dict) or asset.get("id") != key or asset.get("folder", "") not in {"", *folders}:
            raise StudioError("资产记录无效。")
        ref = asset.get("ref")
        if not isinstance(ref, dict) or ref.get("type") not in {"input", "output", "temp"} or not isinstance(ref.get("filename"), str) or not ref["filename"]:
            raise StudioError("资产文件引用无效。")
        if not isinstance(asset.get("name"), str) or len(asset["name"]) > 1000:
            raise StudioError("资产名称无效。")
        if type(asset.get("rating", 0)) is not int or not 0 <= asset.get("rating", 0) <= 5:
            raise StudioError("资产评级无效。")
    return value


class LibraryStore:
    lock = threading.RLock()

    def __init__(self, root):
        self.path = Path(root) / "library.json"

    def read(self):
        with self.lock:
            if not self.path.exists():
                return self.write(new_library())
            return validate_library(json.loads(self.path.read_text(encoding="utf-8")))

    def write(self, value):
        value = validate_library(value)
        with self.lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.path.parent / (uuid.uuid4().hex + ".tmp")
            try:
                temporary.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
                temporary.replace(self.path)
            finally:
                temporary.unlink(missing_ok=True)
        return value
