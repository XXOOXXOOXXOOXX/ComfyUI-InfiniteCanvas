from .nodes import InfiniteCanvasText, InfiniteCanvasImage, InfiniteCanvasNote, InfiniteCanvasResult

NODE_CLASS_MAPPINGS = {cls.__name__: cls for cls in (InfiniteCanvasText, InfiniteCanvasImage, InfiniteCanvasNote, InfiniteCanvasResult)}
NODE_DISPLAY_NAME_MAPPINGS = {"InfiniteCanvasText": "无限画布 · 通用文本", "InfiniteCanvasImage": "无限画布 · 参考图片", "InfiniteCanvasNote": "无限画布 · 分组注释", "InfiniteCanvasResult": "无限画布 · 结果输出"}
WEB_DIRECTORY = "./web"
from . import routes
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
