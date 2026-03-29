"""Universe AI — Self-modification engine (CP4).

Pipeline: pending → classifying → generating_frontend → generating_backend
         → validating → applying → done  (or failed at any step)

Runs entirely in a background daemon thread so the Flask server stays
responsive during the (potentially slow) LLM calls.
"""

import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import httpx

# ── Paths ──────────────────────────────────────────────────────────────────────
# Sidecar lives at  App/sidecar/self_modifier.py
# Generated TSX goes to App/frontend/src/generated/<mod_id>.tsx
# Generated Python goes to App/sidecar/generated/<mod_id>.py

_HERE = Path(__file__).parent
FRONTEND_GENERATED = _HERE.parent / "frontend" / "src" / "generated"
BACKEND_GENERATED = _HERE / "generated"


# ── Public entry point ─────────────────────────────────────────────────────────

def run_modification_async(
    mod_id: str,
    prompt: str,
    load_mods: Callable,
    save_mods: Callable,
    get_cfg: Callable,
    on_backend_ready: Callable[[str], None] | None = None,
) -> None:
    """Kick off the full pipeline in a background daemon thread."""
    t = threading.Thread(
        target=_run,
        args=(mod_id, prompt, load_mods, save_mods, get_cfg, on_backend_ready),
        daemon=True,
        name=f"modifier-{mod_id}",
    )
    t.start()


# ── Pipeline ───────────────────────────────────────────────────────────────────

def _patch_mod(mod_id: str, patch: dict, load_mods: Callable, save_mods: Callable) -> None:
    mods = load_mods()
    for i, m in enumerate(mods):
        if m["id"] == mod_id:
            mods[i] = {
                **m,
                **patch,
                "id": mod_id,
                "updated_at": datetime.now(timezone.utc).isoformat() + "Z",
            }
            save_mods(mods)
            return


def _run(
    mod_id: str,
    prompt: str,
    load_mods: Callable,
    save_mods: Callable,
    get_cfg: Callable,
    on_backend_ready: Callable[[str], None] | None = None,
) -> None:
    def update(patch: dict) -> None:
        _patch_mod(mod_id, patch, load_mods, save_mods)

    try:
        cfg = get_cfg()

        # ── 1. Classify ──────────────────────────────────────────────────────
        update({"status": "classifying"})
        classification = _classify(prompt, cfg)

        # Determine change_type based on classification:
        # new_component  → live       (Vite HMR picks up new TSX in dev)
        # new_tool       → restart_required  (backend blueprint needs sidecar restart)
        # other          → live
        change_type = "restart_required" if classification == "new_tool" else "live"
        update({"change_type": change_type})

        # ── 2. Generate frontend ─────────────────────────────────────────────
        update({"status": "generating_frontend"})
        frontend_code = _generate_frontend(prompt, classification, cfg)
        if not frontend_code:
            raise RuntimeError(
                "LLM returned no code. "
                "Is Ollama running with a model loaded, or Anthropic enabled in Settings?"
            )

        # ── 3. Generate backend (only for tool-type mods) ────────────────────
        backend_code: str | None = None
        if classification == "new_tool":
            update({"status": "generating_backend"})
            backend_code = _generate_backend(prompt, cfg)

        # ── 4. Validate ──────────────────────────────────────────────────────
        update({"status": "validating"})
        _validate_tsx(frontend_code)

        # ── 5. Apply — write files to disk ───────────────────────────────────
        update({"status": "applying"})

        FRONTEND_GENERATED.mkdir(parents=True, exist_ok=True)
        BACKEND_GENERATED.mkdir(parents=True, exist_ok=True)

        # Auto-prepend React import if the LLM omitted it (common with smaller models)
        if "from 'react'" not in frontend_code and 'import React' not in frontend_code:
            frontend_code = "import { useState, useEffect } from 'react'\n\n" + frontend_code

        # Ensure there is an export default — wrap if missing
        if "export default function" not in frontend_code and "export default " not in frontend_code:
            # Try to find the main function name and re-export it
            import re as _re
            m = _re.search(r'function\s+(\w+)\s*\(', frontend_code)
            if m:
                fn_name = m.group(1)
                frontend_code = frontend_code.replace(f'function {fn_name}', f'export default function {fn_name}', 1)
            else:
                frontend_code += "\n\nexport default function GeneratedComponent() { return <div>Component</div> }"

        # Write TSX component
        frontend_filename = f"{mod_id}.tsx"
        (FRONTEND_GENERATED / frontend_filename).write_text(frontend_code, encoding="utf-8")

        # Write Python route (optional)
        backend_filename: str | None = None
        if backend_code:
            backend_filename = f"{mod_id}.py"
            (BACKEND_GENERATED / backend_filename).write_text(backend_code, encoding="utf-8")
            if on_backend_ready:
                try:
                    on_backend_ready(backend_filename)
                except Exception:
                    pass  # blueprint registration failure must not abort the mod

        # ── Done ─────────────────────────────────────────────────────────────
        update({
            "status": "done",
            "frontend_file": frontend_filename,
            "backend_file": backend_filename,
        })

    except Exception as exc:
        update({"status": "failed", "error": str(exc)[:500]})


# ── LLM helper ─────────────────────────────────────────────────────────────────

def _call_llm(messages: list[dict], cfg: dict, max_tokens: int = 2048) -> str:
    """Try Ollama first, then Anthropic. Returns stripped text or empty string."""
    model = cfg.get("ollama_model", "mistral:7b-instruct")
    ollama_url = cfg.get("ollama_url", "http://localhost:11434")

    # Ollama
    try:
        r = httpx.post(
            ollama_url + "/api/chat",
            json={"model": model, "messages": messages, "stream": False},
            timeout=180.0,
        )
        if r.is_success:
            return r.json()["message"]["content"].strip()
    except Exception:
        pass

    # Anthropic fallback
    if cfg.get("anthropic_enabled") and cfg.get("anthropic_key"):
        sys_msgs  = [m for m in messages if m["role"] == "system"]
        user_msgs = [m for m in messages if m["role"] != "system"]
        payload: dict = {
            "model": "claude-haiku-4-5",
            "max_tokens": max_tokens,
            "messages": user_msgs,
        }
        if sys_msgs:
            payload["system"] = "\n".join(m["content"] for m in sys_msgs)
        try:
            r = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": cfg["anthropic_key"],
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=60.0,
            )
            if r.is_success:
                return r.json()["content"][0]["text"].strip()
        except Exception:
            pass

    return ""


# ── Classification ─────────────────────────────────────────────────────────────

_CLASSIFY_CATS = ("new_component", "new_tool", "other")


def _classify(prompt: str, cfg: dict) -> str:
    msgs = [
        {
            "role": "system",
            "content": (
                "You classify app modification requests. "
                "Reply with EXACTLY one word — no punctuation, no explanation:\n"
                "  new_component  (a new UI panel, dashboard, or widget)\n"
                "  new_tool       (a new tool that needs backend API calls)\n"
                "  other          (settings change, documentation, etc.)"
            ),
        },
        {"role": "user", "content": f'Classify: "{prompt}"'},
    ]
    result = _call_llm(msgs, cfg, max_tokens=10).strip().lower()
    for cat in _CLASSIFY_CATS:
        if cat in result:
            return cat
    return "new_component"


# ── Frontend generation ────────────────────────────────────────────────────────

_FRONTEND_SYSTEM = """\
You are an expert React TypeScript developer building UI panels for Universe AI, a local desktop AI app.

Generate a COMPLETE, WORKING React TSX component. Follow these rules EXACTLY:

STRUCTURE (copy this template):
```
import { useState, useEffect } from 'react'

export default function GeneratedComponent() {
  // state here
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#0d0d1a', color: '#e8e8f0' }}>
      {/* content here */}
    </div>
  )
}
```

COLOR PALETTE (use these hex values in inline styles):
- Background:  #0d0d1a
- Surface:     #13131f
- Card:        #1a1a2e
- Border:      #1e1e2e
- Accent:      #7c6ff7
- Text:        #e8e8f0
- Muted:       #6b6b8a
- Green:       #4ade80
- Red:         #f87171
- Amber:       #fbbf24

RULES:
1. ONLY inline styles — no className, no CSS files, no external CSS
2. Import ONLY from 'react' — no other imports
3. Use useState and useEffect for interactivity
4. Make cards with borderRadius:10, background:'#1a1a2e', border:'1px solid #1e1e2e', padding:16
5. Make buttons with background:'#7c6ff7', border:'none', borderRadius:8, color:'#e8e8f0', cursor:'pointer', padding:'8px 18px'
6. Component must look polished and be genuinely interactive/useful
7. Include realistic sample data or fetch from 'http://localhost:8765/...' if needed

OUTPUT: Only the TypeScript/TSX code. No markdown fences. No explanation. Start immediately with "import".\
"""


def _generate_frontend(prompt: str, classification: str, cfg: dict) -> str:
    extra = ""
    if classification == "new_tool":
        extra = (
            "\n\nThis is a TOOL PANEL. Include: "
            "a clearly labelled input area, a 'Run' or 'Execute' button with the accent color, "
            "and an output/results area below it."
        )

    msgs = [
        {"role": "system", "content": _FRONTEND_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Build a React component for: {prompt}{extra}\n\n"
                "Make it immediately useful with working interactivity."
            ),
        },
    ]
    raw = _call_llm(msgs, cfg, max_tokens=2048)
    return _extract_code(raw)


# ── Backend generation ─────────────────────────────────────────────────────────

_BACKEND_SYSTEM = """\
Generate a Python Flask Blueprint module for Universe AI sidecar backend.

TEMPLATE to follow:
```
from flask import Blueprint, jsonify, request

bp = Blueprint('generated_MODID', __name__)

@bp.route('/api/generated/MODID/action', methods=['POST'])
def action():
    body = request.get_json(silent=True) or {}
    # ... logic ...
    return jsonify({'result': 'ok'})
```

RULES:
1. Import only: from flask import Blueprint, jsonify, request
2. Blueprint name must be unique (include a short descriptor)
3. Route prefix must be /api/generated/...
4. Return jsonify() responses
5. OUTPUT: Only Python code. No markdown. No explanation.\
"""


def _generate_backend(prompt: str, cfg: dict) -> str:
    msgs = [
        {"role": "system", "content": _BACKEND_SYSTEM},
        {"role": "user", "content": f"Create a Flask route for: {prompt}"},
    ]
    raw = _call_llm(msgs, cfg, max_tokens=1024)
    return _extract_code(raw)


# ── Validation ─────────────────────────────────────────────────────────────────

def _validate_tsx(code: str) -> None:
    """Raise ValueError if the generated code fails basic sanity checks."""
    # Accept either export default function OR a regular function that will be wrapped
    if "export default function" not in code and "export default" not in code:
        if "function " not in code:
            raise ValueError(
                "Generated code is missing a function definition. "
                "The LLM may have produced incomplete output."
            )
    has_return = (
        "return (" in code
        or "return(" in code
        or "return <" in code
        or "return\n" in code
    )
    if not has_return:
        raise ValueError("Generated code has no return statement.")
    opens  = code.count("{")
    closes = code.count("}")
    if abs(opens - closes) > 8:
        raise ValueError(
            f"Brace mismatch ({opens} open, {closes} close) — "
            "LLM may have truncated the output."
        )


# ── Code extraction ────────────────────────────────────────────────────────────

def _extract_code(raw: str) -> str:
    """Strip markdown fences that LLMs add despite instructions."""
    raw = raw.strip()
    # Remove opening fence (```tsx, ```typescript, ```ts, ```, etc.)
    raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw, flags=re.MULTILINE)
    # Remove closing fence
    raw = re.sub(r"\n?```\s*$", "", raw, flags=re.MULTILINE)
    raw = raw.strip()
    # If there's preamble before the first import/export, strip it
    for keyword in ("import ", "export ", "function "):
        idx = raw.find(keyword)
        if idx > 2:          # skip tiny offsets (e.g. a stray newline)
            raw = raw[idx:]
            break
    return raw.strip()


# ── Tool enhancement ──────────────────────────────────────────────────────────

_ENHANCE_SYSTEM = """\
You are an expert React TypeScript developer enhancing a built-in UI tool in Universe AI.

TASK: Generate a COMPLETE, enhanced React component that includes ALL original tool functionality
PLUS the requested enhancement. Never remove existing features.

COLOR PALETTE (inline styles only):
  Background: #0d0d1a  |  Surface: #13131f  |  Card: #1a1a2e  |  Border: #1e1e2e
  Accent: #7c6ff7  |  Text: #e8e8f0  |  Muted: #6b6b8a
  Green: #4ade80  |  Red: #f87171  |  Amber: #fbbf24  |  Blue: #60a5fa

AI CALL PATTERN (for features that need AI):
  const r = await fetch('http://localhost:8765/api/chat', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ messages: [{role:'user', content: prompt}] })
  })
  const { content } = await r.json()

RULES:
1. ONLY inline styles — no className, no external CSS
2. Import ONLY from 'react'
3. For history/saved items use localStorage (key: 'uai_[toolname]_history')
4. For file export use Blob + URL.createObjectURL
5. Must export default function
6. Keep cards: borderRadius:10, background:'#1a1a2e', border:'1px solid #1e1e2e', padding:16
7. Keep buttons: background:'#7c6ff7', border:'none', borderRadius:8, color:'#e8e8f0', cursor:'pointer'
8. Make it polished and genuinely useful

OUTPUT: Only TSX code. No markdown fences. No explanation. Start with "import".\
"""


def run_enhancement_async(
    mod_id: str,
    tool_name: str,
    tool_desc: str,
    enhancement_request: str,
    load_mods: Callable,
    save_mods: Callable,
    get_cfg: Callable,
) -> None:
    """Kick off a tool-enhancement pipeline in a background daemon thread."""
    t = threading.Thread(
        target=_run_enhancement,
        args=(mod_id, tool_name, tool_desc, enhancement_request, load_mods, save_mods, get_cfg),
        daemon=True,
        name=f"enhancer-{mod_id}",
    )
    t.start()


def _run_enhancement(
    mod_id: str,
    tool_name: str,
    tool_desc: str,
    enhancement_request: str,
    load_mods: Callable,
    save_mods: Callable,
    get_cfg: Callable,
) -> None:
    def update(patch: dict) -> None:
        _patch_mod(mod_id, patch, load_mods, save_mods)

    try:
        cfg = get_cfg()
        update({"status": "generating_frontend", "change_type": "live"})

        msgs = [
            {"role": "system", "content": _ENHANCE_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"Enhance the {tool_name} tool.\n\n"
                    f"Current capabilities: {tool_desc}\n\n"
                    f"Enhancement to add: {enhancement_request}\n\n"
                    f"Return the COMPLETE React component with all original functionality "
                    f"AND the enhancement integrated naturally."
                ),
            },
        ]
        raw = _call_llm(msgs, cfg, max_tokens=3500)
        code = _extract_code(raw)

        if not code:
            raise RuntimeError(
                "LLM returned no code. Is Ollama running with a model loaded, or Anthropic enabled?"
            )

        update({"status": "validating"})
        _validate_tsx(code)

        update({"status": "applying"})
        FRONTEND_GENERATED.mkdir(parents=True, exist_ok=True)

        if "from 'react'" not in code and "import React" not in code:
            code = "import { useState, useEffect } from 'react'\n\n" + code

        if "export default function" not in code and "export default " not in code:
            import re as _re
            m = _re.search(r"function\s+(\w+)\s*\(", code)
            if m:
                code = code.replace(f"function {m.group(1)}", f"export default function {m.group(1)}", 1)
            else:
                code += "\n\nexport default function EnhancedTool() { return <div>Enhanced Tool</div> }"

        filename = f"{mod_id}.tsx"
        (FRONTEND_GENERATED / filename).write_text(code, encoding="utf-8")

        update({"status": "done", "frontend_file": filename, "backend_file": None})

    except Exception as exc:
        update({"status": "failed", "error": str(exc)[:500]})


# ── Source reader (used by Flask route) ───────────────────────────────────────

def get_frontend_source(frontend_filename: str) -> str | None:
    """Return file content for a generated TSX file, or None if not found."""
    path = FRONTEND_GENERATED / frontend_filename
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def get_backend_source(backend_filename: str) -> str | None:
    """Return file content for a generated Python file, or None if not found."""
    path = BACKEND_GENERATED / backend_filename
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def delete_generated_files(frontend_filename: str | None, backend_filename: str | None) -> None:
    """Remove generated files when a modification is deleted."""
    if frontend_filename:
        p = FRONTEND_GENERATED / frontend_filename
        if p.exists():
            p.unlink()
    if backend_filename:
        p = BACKEND_GENERATED / backend_filename
        if p.exists():
            p.unlink()
