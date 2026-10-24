import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest

ROOT = Path(__file__).parents[1]
package = types.ModuleType('library_test_package')
package.__path__ = [str(ROOT)]
sys.modules[package.__name__] = package
from importlib import import_module
library = import_module('library_test_package.library_store')


class LibraryTests(unittest.TestCase):
    def test_roundtrip_and_user_isolation(self):
        with tempfile.TemporaryDirectory() as root:
            first = library.LibraryStore(Path(root) / 'first')
            second = library.LibraryStore(Path(root) / 'second')
            value = first.read()
            value['assets']['a'*32] = {'id': 'a'*32, 'name': '素材.png', 'folder': value['folders'][0]['id'], 'rating': 5, 'ref': {'type': 'input', 'filename': 'file.png'}}
            first.write(value)
            self.assertEqual(first.read()['assets']['a'*32]['rating'], 5)
            self.assertFalse(second.read()['assets'])

    def test_folder_cycle_and_dangling_asset_rejected(self):
        value = library.new_library()
        value['folders'][0]['parent'] = value['folders'][0]['id']
        with self.assertRaises(ValueError):
            library.validate_library(value)
        value = library.new_library()
        value['assets']['a'*32] = {'id': 'a'*32, 'name': 'bad', 'folder': 'b'*32, 'ref': {'type':'input','filename':'file.png'}}
        with self.assertRaises(ValueError):
            library.validate_library(value)


if __name__ == '__main__':
    unittest.main()
