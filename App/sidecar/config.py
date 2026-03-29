"""Simple JSON-backed config — no pydantic required."""

import json
import os
from pathlib import Path

DATA_DIR = Path.home() / ".universe-ai"
DATA_DIR.mkdir(exist_ok=True)
SETTINGS_FILE = DATA_DIR / "settings.json"

DEFAULTS = {
    "ollama_url": "http://localhost:11434",
    "ollama_model": "mistral:7b-instruct",
    "anthropic_enabled": False,
    "anthropic_key": "",
    "budget": 2.0,
    "tone": "professional",
    "port": 8765,
    "hf_token": "",
}


def load() -> dict:
    cfg = dict(DEFAULTS)
    if SETTINGS_FILE.exists():
        try:
            cfg.update(json.loads(SETTINGS_FILE.read_text()))
        except Exception:
            pass
    # Allow env-var overrides: UAI_OLLAMA_URL, UAI_ANTHROPIC_KEY, etc.
    for key in DEFAULTS:
        env_val = os.environ.get(f"UAI_{key.upper()}")
        if env_val is not None:
            cfg[key] = env_val
    return cfg


def save(cfg: dict) -> None:
    to_save = {k: v for k, v in cfg.items() if k != "port"}
    SETTINGS_FILE.write_text(json.dumps(to_save, indent=2))
