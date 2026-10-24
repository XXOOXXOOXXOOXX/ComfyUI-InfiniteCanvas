import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("ic_store", ROOT / "store.py")
store = importlib.util.module_from_spec(spec)
spec.loader.exec_module(store)

class StoreTests(unittest.TestCase):
    def board(self):
        return {"version": 1, "id": "a" * 32, "name": "室内设计", "nodes": [{"id": "b" * 32, "kind": "image", "x": 0, "y": 0, "w": 400, "h": 300, "prompt": "北欧风格"}], "links": [], "assets": {}, "view": {"x": 100, "y": 90, "scale": 1}}
    def test_roundtrip_and_path_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            current = store.BoardStore(directory)
            board = current.write("a" * 32, self.board())
            self.assertEqual(current.read(board["id"])["nodes"][0]["prompt"], "北欧风格")
            self.assertEqual(current.list()[0]["name"], "室内设计")
            with self.assertRaises(ValueError):
                current.read("../outside")
            with self.assertRaises(ValueError):
                current.write("c" * 32, board)
    def test_invalid_ids_positions_and_links(self):
        for mutate in [lambda b: b["nodes"][0].update(x=float("nan")), lambda b: b["nodes"].append(dict(b["nodes"][0])), lambda b: b["links"].append({"from": "b"*32,"to":"c"*32})]:
            board = self.board()
            mutate(board)
            with self.assertRaises(ValueError):
                store.validate_board(board)

if __name__ == "__main__":
    unittest.main()
