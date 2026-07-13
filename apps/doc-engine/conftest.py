import os
import sys

# Make `doc_engine` importable from tests without installing the package.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
