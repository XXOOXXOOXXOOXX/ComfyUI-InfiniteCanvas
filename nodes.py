import json
from pathlib import Path

def media_path(ref):
    import folder_paths
    if not isinstance(ref, dict) or ref.get("type", "input") not in {"input", "output", "temp"}:
        raise ValueError("素材引用无效。")
    root = Path(getattr(folder_paths, "get_" + ref.get("type", "input") + "_directory")()).resolve()
    filename = str(ref.get("filename", ""))
    if not filename or Path(filename).name != filename or "/" in filename or "\\" in filename:
        raise ValueError("素材文件名无效。")
    path = (root / str(ref.get("subfolder", "")) / filename).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError("素材已移除或路径无效，请重新上传。")
    return path

class InfiniteCanvasText:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"text": ("STRING", {"multiline": True, "default": ""})}}
    RETURN_TYPES = ("STRING",)
    FUNCTION = "run"
    CATEGORY = "Infinite Canvas"
    def run(self, text):
        return (text,)

class InfiniteCanvasNote(InfiniteCanvasText):
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"text": ("STRING", {"multiline": True, "default": "在这里填写这个分组的使用说明；在无限画布添加对应节点时显示。"})}}

class InfiniteCanvasImage:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"sources": ("STRING", {"default": "[]", "multiline": True, "tooltip": "由无限画布填入参考图片列表。多图按连接顺序输出；不同尺寸按第一张对齐。"})}}
    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("images", "mask")
    FUNCTION = "run"
    CATEGORY = "Infinite Canvas"
    def run(self, sources):
        import torch
        import numpy as np
        from PIL import Image, ImageOps
        refs = json.loads(sources)
        if not isinstance(refs, list) or not refs:
            raise ValueError("请在无限画布连接参考图片；纯文生图无需添加此节点。")
        images, masks, size = [], [], None
        for ref in refs:
            with Image.open(media_path(ref)) as source:
                image = ImageOps.exif_transpose(source).convert("RGBA")
                size = size or image.size
                if image.size != size:
                    image = image.resize(size, Image.Resampling.LANCZOS)
                array = np.array(image).astype(np.float32) / 255
                images.append(torch.from_numpy(array[:, :, :3]))
                masks.append(torch.from_numpy(1 - array[:, :, 3]))
        return torch.stack(images), torch.stack(masks)
    @classmethod
    def IS_CHANGED(cls, sources):
        return float("nan")

class AnyType(str):
    def __ne__(self, other):
        return False

class InfiniteCanvasResult:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"value": (AnyType("*"), {"forceInput": True})}}
    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "run"
    CATEGORY = "Infinite Canvas"
    def run(self, value):
        if isinstance(value, str):
            return {"ui": {"text": [value]}}
        # An IMAGE terminal gets a native temporary preview so history and the
        # canvas receive real file descriptors rather than Python object strings.
        if hasattr(value, "shape") and len(value.shape) == 4 and value.shape[-1] in (1, 3, 4):
            from nodes import PreviewImage
            return PreviewImage().save_images(value)
        return {}
