import sys
from pathlib import Path

# Make eval/run_eval.py and eval/wayback_diff.py importable as modules.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "eval"))
