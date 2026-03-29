"""Universe AI sidecar — Flask, Python 3.14 compatible."""

import importlib.util
import json
import sys
import threading
import time
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Generator
import os
import csv

import httpx
from flask import Flask, Response, jsonify, request, stream_with_context, send_file
from flask_cors import CORS

import config as cfg_module
import self_modifier
import polish_agent

# ── Paths ─────────────────────────────────────────────────────────────────────

DATA_DIR = cfg_module.DATA_DIR
PIPELINES_FILE   = DATA_DIR / "pipelines.json"
TOOLS_FILE       = DATA_DIR / "tools.json"
MODS_FILE        = DATA_DIR / "modifications.json"
SPEND_FILE       = DATA_DIR / "spend.json"
OUTBOX_FILE = DATA_DIR / "outbox.json"
if not OUTBOX_FILE.exists():
    OUTBOX_FILE.write_text('[]')

# ── Config state ──────────────────────────────────────────────────────────────

_cfg = cfg_module.load()
_cfg_lock = threading.Lock()


def get_cfg() -> dict:
    with _cfg_lock:
        return dict(_cfg)


def update_cfg(patch: dict) -> None:
    with _cfg_lock:
        _cfg.update(patch)
        cfg_module.save(_cfg)


# ── JSON file helpers ─────────────────────────────────────────────────────────

def read_json(path: Path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return default


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# ── Spend tracking ────────────────────────────────────────────────────────────

def get_today_spend() -> float:
    today = date.today().isoformat()
    spend = read_json(SPEND_FILE, {})
    return float(spend.get(today, 0.0))


def add_spend(amount: float) -> float:
    today = date.today().isoformat()
    spend = read_json(SPEND_FILE, {})
    spend[today] = float(spend.get(today, 0.0)) + amount
    write_json(SPEND_FILE, spend)
    return spend[today]


# ── Default tools registry ────────────────────────────────────────────────────

DEFAULT_TOOLS = [
    {"id": "voice",      "icon": "🎙️", "name": "Voice Recorder",       "desc": "Record audio and auto-transcribe with Whisper",    "cat": "Media",     "status": "coming-soon", "enabled": False},
    {"id": "summarizer", "icon": "📝", "name": "Summarizer",            "desc": "Summarize any document, URL, or pasted text",      "cat": "Text",      "status": "coming-soon", "enabled": False},
    {"id": "translator", "icon": "🌐", "name": "Translator",            "desc": "Translate between 100+ languages via M2M-100",     "cat": "Language",  "status": "coming-soon", "enabled": False},
    {"id": "imagegen",   "icon": "🖼️", "name": "Image Generator",       "desc": "Generate images from text with local diffusion",   "cat": "Media",     "status": "coming-soon", "enabled": False},
    {"id": "ocr",        "icon": "🔍", "name": "OCR & Document Reader", "desc": "Extract text from PDFs and images",                "cat": "Documents", "status": "coming-soon", "enabled": False},
    {"id": "coderunner", "icon": "💻", "name": "Code Runner",           "desc": "Execute and test code snippets with sandboxing",   "cat": "Dev",       "status": "coming-soon", "enabled": False},
    {"id": "webfetch",   "icon": "🌐", "name": "Web Fetch & Scrape",    "desc": "Pull and parse content from any URL",              "cat": "Data",      "status": "coming-soon", "enabled": False},
    {"id": "csvtool",    "icon": "📊", "name": "CSV / Data Analyzer",   "desc": "Upload CSV and query it with natural language",    "cat": "Data",      "status": "coming-soon", "enabled": False},
]


# ── App ───────────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)

# ── Generated blueprint auto-loader ──────────────────────────────────────────

_BACKEND_GENERATED = Path(__file__).parent / "generated"


def _register_blueprint_from_file(filepath: Path) -> bool:
    """Dynamically load a generated Python file and register its Flask Blueprint."""
    module_name = f"universe_gen_{filepath.stem}"
    if module_name in sys.modules:
        return True  # already registered
    try:
        spec = importlib.util.spec_from_file_location(module_name, filepath)
        if spec is None or spec.loader is None:
            return False
        mod = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = mod
        spec.loader.exec_module(mod)  # type: ignore[union-attr]
        if hasattr(mod, "bp"):
            app.register_blueprint(mod.bp)
            print(f"[modifier] Blueprint registered: {module_name}")
            return True
    except Exception as exc:
        print(f"[modifier] Failed to load {filepath.name}: {exc}")
    return False


def _load_all_generated_blueprints() -> None:
    """Load every existing generated mod-*.py on sidecar startup."""
    if not _BACKEND_GENERATED.exists():
        return
    for py_file in sorted(_BACKEND_GENERATED.glob("mod-*.py")):
        _register_blueprint_from_file(py_file)


def _on_backend_generated(filename: str) -> None:
    """Callback invoked by self_modifier when a new backend file is written."""
    _register_blueprint_from_file(_BACKEND_GENERATED / filename)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    cfg = get_cfg()
    ollama_ok = False
    models: list[str] = []
    try:
        r = httpx.get(cfg["ollama_url"] + "/api/tags", timeout=2.0)
        if r.is_success:
            ollama_ok = True
            data = r.json()
            models = [m["name"] for m in data.get("models", [])]
    except Exception:
        pass
    return jsonify({
        "status": "ok",
        "ollama": ollama_ok,
        "models": models,
        "spend_today": get_today_spend(),
    })


# ── Settings ──────────────────────────────────────────────────────────────────

@app.get("/api/settings")
def get_settings():
    cfg = get_cfg()
    safe = {k: v for k, v in cfg.items() if k not in ("anthropic_key", "port")}
    safe["anthropic_key_set"] = bool(cfg.get("anthropic_key"))
    safe["spend_today"] = get_today_spend()
    return jsonify(safe)


@app.put("/api/settings")
def save_settings():
    body = request.get_json(silent=True) or {}
    field_map = {
        "ollamaUrl":        "ollama_url",
        "ollamaModel":      "ollama_model",
        "anthropicEnabled": "anthropic_enabled",
        "anthropicKey":     "anthropic_key",
        "budget":           "budget",
        "tone":             "tone",
    }
    patch = {}
    for js_key, py_key in field_map.items():
        if js_key in body and body[js_key] is not None:
            if js_key == "anthropicKey" and body[js_key] == "":
                continue
            patch[py_key] = body[js_key]
    update_cfg(patch)
    return jsonify({"ok": True})


# ── Anthropic test (key never leaves backend) ─────────────────────────────────

@app.post("/api/anthropic/test")
def anthropic_test():
    """
    Tests the stored Anthropic key (or a key passed in the body for first-time
    save-and-test flow). The key is never echoed back in the response.
    """
    body = request.get_json(silent=True) or {}
    cfg = get_cfg()

    # Accept a key in the body so users can test before saving
    key = body.get("key") or cfg.get("anthropic_key", "")
    if not key:
        return jsonify({"ok": False, "error": "No API key provided"}), 400

    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5",
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
            },
            timeout=15.0,
        )
        if r.is_success:
            text = r.json()["content"][0]["text"]
            return jsonify({"ok": "OK" in text})
        return jsonify({"ok": False, "error": f"HTTP {r.status_code}"}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 200


# ── Ollama passthrough ────────────────────────────────────────────────────────

@app.get("/api/ollama/models")
def ollama_models():
    cfg = get_cfg()
    try:
        r = httpx.get(cfg["ollama_url"] + "/api/tags", timeout=5.0)
        r.raise_for_status()
        data = r.json()
        return jsonify({"models": [m["name"] for m in data.get("models", [])]})
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.post("/api/ollama/pull")
def ollama_pull():
    cfg = get_cfg()
    body = request.get_json(silent=True) or {}
    name = body.get("name", "")
    if not name:
        return jsonify({"error": "name required"}), 400

    def generate() -> Generator[bytes, None, None]:
        with httpx.stream(
            "POST",
            cfg["ollama_url"] + "/api/pull",
            json={"name": name, "stream": True},
            timeout=None,
        ) as r:
            for chunk in r.iter_bytes():
                yield chunk

    return Response(stream_with_context(generate()), content_type="application/x-ndjson")


# ── Chat ──────────────────────────────────────────────────────────────────────

@app.post("/api/chat")
def chat():
    cfg = get_cfg()
    body = request.get_json(silent=True) or {}
    messages: list[dict] = body.get("messages", [])
    model: str = body.get("model") or cfg["ollama_model"]
    tone: str = body.get("tone") or cfg.get("tone", "professional")

    # Inject tone into system message if present
    messages = _inject_tone(messages, tone)

    # 1. Try Ollama — verify the model is actually installed first,
    #    auto-selecting the first available model when the configured one is missing.
    try:
        tags_r = httpx.get(cfg["ollama_url"] + "/api/tags", timeout=3.0)
        if tags_r.is_success:
            installed = [m["name"] for m in tags_r.json().get("models", [])]
            if installed:
                if model not in installed:
                    model = installed[0]   # fall back to first installed model
                r = httpx.post(
                    cfg["ollama_url"] + "/api/chat",
                    json={"model": model, "messages": messages, "stream": False},
                    timeout=120.0,
                )
                if r.is_success:
                    data = r.json()
                    return jsonify({"content": data["message"]["content"], "via": f"Ollama/{model}"})
    except Exception:
        pass

    # 2. Try Anthropic (key stays on backend)
    if cfg.get("anthropic_enabled") and cfg.get("anthropic_key"):
        budget = float(cfg.get("budget", 2.0))
        today_spend = get_today_spend()
        if today_spend < budget:
            result = _anthropic_chat(messages, cfg["anthropic_key"])
            if result:
                add_spend(0.001)
                return jsonify({"content": result, "via": "Claude Haiku"})

    return jsonify({"error": "All AI providers unavailable. Check Ollama or Settings."}), 503


def _inject_tone(messages: list[dict], tone: str) -> list[dict]:
    tone_hint = {
        "professional": "Be professional and precise.",
        "casual": "Be conversational and friendly.",
        "concise": "Be brief and to the point.",
        "detailed": "Be thorough and comprehensive.",
        "technical": "Use precise technical language.",
    }.get(tone, "")
    if not tone_hint:
        return messages
    result = list(messages)
    for i, m in enumerate(result):
        if m.get("role") == "system":
            result[i] = {**m, "content": m["content"] + f"\n\nTone: {tone_hint}"}
            return result
    return result


def _anthropic_chat(messages: list[dict], key: str) -> str | None:
    system_msgs = [m for m in messages if m["role"] == "system"]
    user_msgs   = [m for m in messages if m["role"] != "system"]
    system_text = "\n".join(m["content"] for m in system_msgs) or None
    payload: dict[str, Any] = {
        "model": "claude-haiku-4-5",
        "max_tokens": 1024,
        "messages": user_msgs,
    }
    if system_text:
        payload["system"] = system_text
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            json=payload,
            timeout=30.0,
        )
        if r.is_success:
            return r.json()["content"][0]["text"]
    except Exception:
        pass
    return None


# ── Pipelines ─────────────────────────────────────────────────────────────────

@app.get("/api/pipelines")
def get_pipelines():
    data = read_json(PIPELINES_FILE, None)
    if data is None:
        return jsonify({"pipelines": None})   # None = use frontend defaults
    return jsonify({"pipelines": data})


@app.put("/api/pipelines")
def save_pipelines():
    body = request.get_json(silent=True) or {}
    pipelines = body.get("pipelines")
    if pipelines is None:
        return jsonify({"error": "pipelines required"}), 400
    write_json(PIPELINES_FILE, pipelines)
    return jsonify({"ok": True})


@app.post("/api/pipelines")
def create_pipeline():
    pipeline = request.get_json(silent=True) or {}
    pipelines = read_json(PIPELINES_FILE, [])
    if not isinstance(pipelines, list):
        pipelines = []
    pipeline.setdefault("id", "p-" + uuid.uuid4().hex[:8])
    pipelines.append(pipeline)
    write_json(PIPELINES_FILE, pipelines)
    return jsonify({"pipeline": pipeline}), 201


@app.put("/api/pipelines/<pipeline_id>")
def update_pipeline(pipeline_id: str):
    patch = request.get_json(silent=True) or {}
    pipelines = read_json(PIPELINES_FILE, [])
    if not isinstance(pipelines, list):
        return jsonify({"error": "no pipelines on disk"}), 404
    updated = False
    for i, p in enumerate(pipelines):
        if p.get("id") == pipeline_id:
            pipelines[i] = {**p, **patch, "id": pipeline_id}
            updated = True
            break
    if not updated:
        return jsonify({"error": "not found"}), 404
    write_json(PIPELINES_FILE, pipelines)
    return jsonify({"ok": True})


@app.delete("/api/pipelines/<pipeline_id>")
def delete_pipeline(pipeline_id: str):
    pipelines = read_json(PIPELINES_FILE, [])
    if not isinstance(pipelines, list):
        return jsonify({"error": "not found"}), 404
    pipelines = [p for p in pipelines if p.get("id") != pipeline_id]
    write_json(PIPELINES_FILE, pipelines)
    return jsonify({"ok": True})


# ── Tools registry ────────────────────────────────────────────────────────────

@app.get("/api/tools")
def get_tools():
    # Merge persisted overrides (enabled/disabled, custom tools) onto defaults
    overrides = read_json(TOOLS_FILE, {})
    tools = []
    for t in DEFAULT_TOOLS:
        merged = {**t, **overrides.get(t["id"], {})}
        tools.append(merged)
    # Append any custom (generated) tools not in defaults
    for tool_id, tool_data in overrides.items():
        if not any(t["id"] == tool_id for t in DEFAULT_TOOLS):
            tools.append(tool_data)
    return jsonify({"tools": tools})


@app.put("/api/tools/<tool_id>")
def update_tool(tool_id: str):
    patch = request.get_json(silent=True) or {}
    overrides = read_json(TOOLS_FILE, {})
    overrides[tool_id] = {**overrides.get(tool_id, {}), **patch}
    write_json(TOOLS_FILE, overrides)
    return jsonify({"ok": True})


@app.post("/api/tools")
def create_tool():
    """Register a new custom tool (used by the self-modification engine in CP4)."""
    tool = request.get_json(silent=True) or {}
    tool.setdefault("id", "tool-" + uuid.uuid4().hex[:8])
    tool.setdefault("status", "active")
    tool.setdefault("enabled", True)
    overrides = read_json(TOOLS_FILE, {})
    overrides[tool["id"]] = tool
    write_json(TOOLS_FILE, overrides)
    return jsonify({"tool": tool}), 201


# ── App Modifications (scaffold for CP4) ─────────────────────────────────────

def _load_mods() -> list:
    return read_json(MODS_FILE, [])


def _save_mods(mods: list) -> None:
    write_json(MODS_FILE, mods)


@app.get("/api/app/modifications")
def list_modifications():
    mods = _load_mods()
    return jsonify({"modifications": mods})


@app.post("/api/app/modify")
def request_modification():
    """
    CP4: records the request, then immediately kicks off the generation
    pipeline in a background thread.
    """
    body = request.get_json(silent=True) or {}
    prompt = body.get("prompt", "")
    if not prompt:
        return jsonify({"error": "prompt required"}), 400

    mod = {
        "id": "mod-" + uuid.uuid4().hex[:8],
        "prompt": prompt,
        "status": "pending",
        "change_type": None,
        "created_at": datetime.now(timezone.utc).isoformat() + "Z",
        "updated_at": datetime.now(timezone.utc).isoformat() + "Z",
        "frontend_file": None,
        "backend_file": None,
        "error": None,
    }
    mods = _load_mods()
    mods.insert(0, mod)
    _save_mods(mods)

    # Start the generation pipeline asynchronously
    self_modifier.run_modification_async(
        mod_id=mod["id"],
        prompt=prompt,
        load_mods=_load_mods,
        save_mods=_save_mods,
        get_cfg=get_cfg,
        on_backend_ready=_on_backend_generated,
    )

    return jsonify({"modification": mod}), 201


@app.post("/api/app/enhance-tool")
def enhance_tool():
    """
    Create a modification that enhances an existing built-in tool.
    Body: { tool_name, tool_desc, enhancement }
    """
    body = request.get_json(silent=True) or {}
    tool_name = body.get("tool_name", "")
    tool_desc = body.get("tool_desc", "")
    enhancement = body.get("enhancement", "")
    if not enhancement:
        return jsonify({"error": "enhancement required"}), 400

    prompt = f"Enhance {tool_name}: {enhancement}"
    mod = {
        "id": "mod-" + uuid.uuid4().hex[:8],
        "prompt": prompt,
        "status": "pending",
        "change_type": None,
        "created_at": datetime.now(timezone.utc).isoformat() + "Z",
        "updated_at": datetime.now(timezone.utc).isoformat() + "Z",
        "frontend_file": None,
        "backend_file": None,
        "error": None,
    }
    mods = _load_mods()
    mods.insert(0, mod)
    _save_mods(mods)

    self_modifier.run_enhancement_async(
        mod_id=mod["id"],
        tool_name=tool_name,
        tool_desc=tool_desc,
        enhancement_request=enhancement,
        load_mods=_load_mods,
        save_mods=_save_mods,
        get_cfg=get_cfg,
    )
    return jsonify({"modification": mod}), 201


@app.get("/api/app/modifications/<mod_id>")
def get_modification(mod_id: str):
    mods = _load_mods()
    mod = next((m for m in mods if m["id"] == mod_id), None)
    if not mod:
        return jsonify({"error": "not found"}), 404
    return jsonify({"modification": mod})


@app.put("/api/app/modifications/<mod_id>")
def update_modification(mod_id: str):
    patch = request.get_json(silent=True) or {}
    mods = _load_mods()
    for i, m in enumerate(mods):
        if m["id"] == mod_id:
            mods[i] = {**m, **patch, "id": mod_id, "updated_at": datetime.now(timezone.utc).isoformat() + "Z"}
            _save_mods(mods)
            return jsonify({"modification": mods[i]})
    return jsonify({"error": "not found"}), 404


@app.delete("/api/app/modifications/<mod_id>")
def delete_modification(mod_id: str):
    mods = _load_mods()
    # Also clean up generated files
    for m in mods:
        if m["id"] == mod_id:
            self_modifier.delete_generated_files(m.get("frontend_file"), m.get("backend_file"))
            break
    mods = [m for m in mods if m["id"] != mod_id]
    _save_mods(mods)
    return jsonify({"ok": True})


@app.get("/api/app/modifications/<mod_id>/source")
def get_modification_source(mod_id: str):
    """Return the generated source code for a modification."""
    mods = _load_mods()
    mod = next((m for m in mods if m["id"] == mod_id), None)
    if not mod:
        return jsonify({"error": "not found"}), 404
    frontend_src = None
    backend_src = None
    if mod.get("frontend_file"):
        frontend_src = self_modifier.get_frontend_source(mod["frontend_file"])
    if mod.get("backend_file"):
        backend_src = self_modifier.get_backend_source(mod["backend_file"])
    return jsonify({
        "frontend": frontend_src,
        "backend": backend_src,
    })


@app.post("/api/app/modifications/undo")
def undo_modification():
    """Mark the most recent applied modification as undone (CP4 will revert files)."""
    mods = _load_mods()
    for m in mods:
        if m.get("status") == "done":
            m["status"] = "undone"
            m["updated_at"] = datetime.now(timezone.utc).isoformat() + "Z"
            _save_mods(mods)
            return jsonify({"modification": m})
    return jsonify({"error": "nothing to undo"}), 404


# ── Modification status stream (SSE) ─────────────────────────────────────────

@app.get("/api/app/modifications/<mod_id>/stream")
def stream_modification_status(mod_id: str):
    """
    Server-Sent Events endpoint — streams modification status changes in real
    time so the frontend doesn't need to poll.  Closes automatically when the
    mod reaches a terminal state (done / failed) or after 3 minutes.
    """
    _TERMINAL = {"done", "failed", "undone"}

    def generate() -> Generator[str, None, None]:
        last_status: str | None = None
        for _ in range(180):           # 180 × 1 s = 3 min max
            mods = _load_mods()
            mod  = next((m for m in mods if m["id"] == mod_id), None)
            if mod is None:
                yield f"data: {json.dumps({'error': 'not found'})}\n\n"
                return
            if mod["status"] != last_status:
                last_status = mod["status"]
                yield f"data: {json.dumps(mod)}\n\n"
            if mod["status"] in _TERMINAL:
                return
            time.sleep(1)
        yield f"data: {json.dumps({'id': mod_id, 'status': 'failed', 'error': 'stream timeout'})}\n\n"

    resp = Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
    )
    resp.headers["Cache-Control"]         = "no-cache"
    resp.headers["X-Accel-Buffering"]     = "no"
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


# ── Pipeline runner (SSE streaming) ───────────────────────────────────────────
@app.post('/api/pipelines/<pipeline_id>/run')
def run_pipeline(pipeline_id: str):
    """Run a pipeline and stream log events as Server-Sent Events (SSE).
    Clients should GET this endpoint with POST to start a run, then read text/event-stream.
    """
    cfg = get_cfg()
    pipelines = read_json(PIPELINES_FILE, None)
    if not pipelines:
        return jsonify({'error': 'no pipelines configured'}), 404
    pipeline = next((p for p in pipelines if p.get('id') == pipeline_id), None)
    if not pipeline:
        return jsonify({'error': 'pipeline not found'}), 404

    def gen():
        def send(obj: dict):
            yield f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"

        # start
        yield from send({'type': 'start', 'pipelineId': pipeline_id, 'name': pipeline.get('name')})

        last_output = None
        for step in pipeline.get('steps', []):
            sid = step.get('id')
            stype = step.get('typeId')
            sname = step.get('typeId')
            # announce step
            yield from send({'type': 'step_start', 'stepId': sid, 'typeId': stype})
            try:
                # simple LLM handling
                if stype in ('llm', 'legal-llm'):
                    prompt = (step.get('config', {}) or {}).get('prompt') or 'Please process the input.'
                    # Build messages: system + user with last_output or empty
                    system = {'role': 'system', 'content': 'You are Universe AI pipeline LLM step.'}
                    user_text = (last_output or '') + '\n\n' + prompt
                    payload = {'messages': [system, {'role': 'user', 'content': user_text}], 'model': step.get('config', {}).get('model')}
                    # call local /api/chat endpoint to reuse routing
                    try:
                        r = httpx.post(f"http://127.0.0.1:{cfg.get('port',8765)}/api/chat", json=payload, timeout=120.0)
                        if r.is_success:
                            data = r.json()
                            text = data.get('content') if isinstance(data, dict) else str(data)
                            last_output = text
                            yield from send({'type': 'log', 'msg': text[:1000]})
                        else:
                            yield from send({'type': 'error', 'msg': f'LLM error {r.status_code}'})
                            break
                    except Exception as e:
                        yield from send({'type': 'error', 'msg': str(e)})
                        break
                else:
                    # Real connector implementations for non-LLM steps
                    if stype == 'web-fetch':
                        urls = (step.get('config', {}) or {}).get('urls', '')
                        texts = []
                        for url in str(urls).split('\n'):
                            url = url.strip()
                            if not url: continue
                            try:
                                r = httpx.get(url, timeout=15.0)
                                if r.is_success:
                                    texts.append(r.text[:20000])
                                    yield from send({'type': 'log', 'msg': f'Fetched {url} ({len(r.text)} chars)'})
                                else:
                                    yield from send({'type': 'log', 'msg': f'Fetch {url} failed: {r.status_code}'})
                            except Exception as e:
                                yield from send({'type': 'log', 'msg': f'Fetch {url} error: {e}'})
                        last_output = '\n\n'.join(texts)

                    elif stype == 'save-file':
                        cfg = step.get('config', {}) or {}
                        out_dir = os.path.expanduser(cfg.get('path', str(DATA_DIR)))
                        os.makedirs(out_dir, exist_ok=True)
                        filename_pattern = cfg.get('filename', '{{date}}_output.txt')
                        filename = filename_pattern.replace('{{date}}', datetime.now().strftime('%Y-%m-%d')).replace('{{pipeline_name}}', pipeline.get('name','pipeline'))
                        out_path = Path(out_dir) / filename
                        try:
                            with open(out_path, 'w', encoding='utf-8') as fh:
                                fh.write(str(last_output or ''))
                            yield from send({'type': 'log', 'msg': f'Wrote file: {out_path}'})
                            last_output = f'file://{out_path}'
                        except Exception as e:
                            yield from send({'type': 'error', 'msg': f'Write failed: {e}'})
                            break

                    elif stype == 'send-email':
                        cfg = step.get('config', {}) or {}
                        to = cfg.get('to', 'unknown')
                        subject = cfg.get('subject', f"{pipeline.get('name')} — {datetime.now().date()}")
                        out = read_json(OUTBOX_FILE, [])
                        out.append({'to': to, 'subject': subject, 'body': str(last_output or ''), 'sent_at': datetime.now(timezone.utc).isoformat()})
                        write_json(OUTBOX_FILE, out)
                        yield from send({'type': 'log', 'msg': f'Queued email to {to} (saved to outbox)'})
                        last_output = f'email://{to}/{subject}'

                    elif stype == 'csv-parser':
                        # Expect last_output to be CSV text; parse to JSON
                        try:
                            csv_text = str(last_output or '')
                            reader = csv.DictReader(csv_text.splitlines())
                            rows = [r for r in reader]
                            last_output = json.dumps(rows, ensure_ascii=False)
                            yield from send({'type': 'log', 'msg': f'Parsed CSV ({len(rows)} rows)'})
                        except Exception as e:
                            yield from send({'type': 'error', 'msg': f'CSV parse error: {e}'})
                            break

                    elif stype == 'translator':
                        cfg = step.get('config', {}) or {}
                        model = cfg.get('model') or 'Helsinki-NLP/opus-mt-en-es'
                        payload = {'model': model, 'input': {'inputs': str(last_output or '')}}
                        try:
                            r = httpx.post(f"http://127.0.0.1:{cfg.get('port',8765)}/api/hf/infer", json=payload, timeout=120.0)
                            if r.is_success:
                                last_output = r.json()
                                yield from send({'type': 'log', 'msg': 'Translation completed'})
                            else:
                                yield from send({'type': 'error', 'msg': f'Translate error {r.status_code}'})
                                break
                        except Exception as e:
                            yield from send({'type': 'error', 'msg': str(e)})
                            break

                    else:
                        # fallback: no connector available
                        yield from send({'type': 'log', 'msg': f'No connector for {stype}, skipping (pass-through)'})
                        # pass-through leaves last_output unchanged

                # step done
                yield from send({'type': 'step_done', 'stepId': sid})
            except Exception as e:
                yield from send({'type': 'step_error', 'stepId': sid, 'msg': str(e)})
                break

        yield from send({'type': 'done', 'pipelineId': pipeline_id})

    resp = Response(stream_with_context(gen()), content_type='text/event-stream')
    resp.headers['Cache-Control'] = 'no-cache'
    resp.headers['X-Accel-Buffering'] = 'no'
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


# ── Dev / Polish Agent ────────────────────────────────────────────────────────

@app.get("/api/dev/health")
def dev_health():
    """Run an immediate health check against all known endpoints."""
    results = polish_agent.health_check()
    ok = sum(1 for r in results if r["ok"])
    return jsonify({"results": results, "ok": ok, "total": len(results)})


@app.post("/api/dev/polish")
def dev_start_polish():
    """Start (or restart) the polish agent cycle."""
    body = request.get_json(silent=True) or {}
    continuous = bool(body.get("continuous", False))
    cooldown   = int(body.get("cooldown_seconds", 120))

    def _queue_improvement(prompt: str) -> None:
        """Create a mod record and kick off the generation pipeline."""
        mod = {
            "id":            "mod-" + uuid.uuid4().hex[:8],
            "prompt":        prompt,
            "status":        "pending",
            "change_type":   None,
            "created_at":    datetime.now(timezone.utc).isoformat() + "Z",
            "updated_at":    datetime.now(timezone.utc).isoformat() + "Z",
            "frontend_file": None,
            "backend_file":  None,
            "error":         None,
        }
        mods = _load_mods()
        mods.insert(0, mod)
        _save_mods(mods)
        self_modifier.run_modification_async(
            mod_id=mod["id"],
            prompt=prompt,
            load_mods=_load_mods,
            save_mods=_save_mods,
            get_cfg=get_cfg,
            on_backend_ready=_on_backend_generated,
        )

    started = polish_agent.run_cycle_async(
        queue_improvement=_queue_improvement,
        get_cfg=get_cfg,
        continuous=continuous,
        cooldown_seconds=cooldown,
    )
    if not started:
        return jsonify({"error": "A polish cycle is already running"}), 409
    return jsonify({"ok": True, "continuous": continuous})


@app.post("/api/dev/polish/stop")
def dev_stop_polish():
    """Request the currently running cycle to stop after its current step."""
    polish_agent.request_stop()
    return jsonify({"ok": True})


@app.get("/api/dev/polish/status")
def dev_polish_status():
    """Return the current polish agent state + log."""
    return jsonify(polish_agent.get_state())


# ── Spend ─────────────────────────────────────────────────────────────────────

@app.get("/api/spend")
def get_spend():
    return jsonify({"today": get_today_spend(), "date": date.today().isoformat()})


# ── Hugging Face proxy (model browsing + inference) ───────────────────────────

@app.get('/api/hf/models')
def hf_list_models():
    """Return a lightweight search result from Hugging Face model hub using the HF token if available."""
    cfg = get_cfg()
    token = cfg.get('hf_token')
    q = request.args.get('q', '')
    try:
        headers = {'Authorization': f'Bearer {token}'} if token else {}
        params = {'search': q, 'limit': 20}
        r = httpx.get('https://huggingface.co/api/models', params=params, headers=headers, timeout=15.0)
        r.raise_for_status()
        items = r.json()
        results = []
        for it in items:
            results.append({
                'id': it.get('modelId') or it.get('id'),
                'tags': it.get('pipeline_tag'),
                'likes': it.get('likes', 0),
                'downloads': it.get('downloads', 0),
                'private': it.get('private', False),
            })
        return jsonify({'models': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 502


@app.post('/api/hf/infer')
def hf_infer():
    """Proxy inference to Hugging Face Inference API. Body: { model: string, input: any }
    Respects hf_token in config. Returns JSON from HF or error."""
    cfg = get_cfg()
    token = cfg.get('hf_token')
    body = request.get_json(silent=True) or {}
    model = body.get('model')
    if not model:
        return jsonify({'error': 'model required'}), 400
    payload = body.get('input')
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    try:
        r = httpx.post(f'https://api-inference.huggingface.co/models/{model}', json=payload, headers=headers, timeout=120.0)
        if r.status_code >= 400:
            return jsonify({'error': f'HF {r.status_code}'}), r.status_code
        # attempt to return JSON or text
        try:
            return jsonify(r.json())
        except Exception:
            return Response(r.content, content_type=r.headers.get('content-type', 'application/octet-stream'))
    except Exception as e:
        return jsonify({'error': str(e)}), 502


@app.post('/api/hf/pull-to-ollama')
def hf_pull_to_ollama():
    """Trigger Ollama to pull the Hugging Face model by name so it can be used locally.
    Body: { name: 'mistralai/Mistral-7B-Instruct-v0.3' }
    Streams Ollama pull output.
    """
    cfg = get_cfg()
    body = request.get_json(silent=True) or {}
    name = body.get('name')
    if not name:
        return jsonify({'error': 'name required'}), 400

    def generate():
        try:
            with httpx.stream('POST', cfg['ollama_url'] + '/api/pull', json={'name': name, 'stream': True}, timeout=None) as r:
                for chunk in r.iter_bytes():
                    yield chunk
        except Exception as e:
            yield json.dumps({'error': str(e)})

    return Response(stream_with_context(generate()), content_type='application/x-ndjson')


# ── Voice recordings storage & endpoints ──────────────────────────────────────
RECORDINGS_DIR = DATA_DIR / 'recordings'
RECORDINGS_DIR.mkdir(exist_ok=True)
RECORDINGS_META = DATA_DIR / 'recordings.json'
if not RECORDINGS_META.exists():
    write_json(RECORDINGS_META, [])


def _load_recordings():
    return read_json(RECORDINGS_META, [])


def _save_recordings(items):
    write_json(RECORDINGS_META, items)


@app.get('/api/voice/recordings')
def list_recordings():
    items = _load_recordings()
    return jsonify({'recordings': items})


@app.post('/api/voice/upload')
def upload_recording():
    # Accept multipart form-data file or raw binary body with filename in ?fn= or JSON name
    try:
        if 'file' in request.files:
            f = request.files['file']
            data = f.read()
            filename = f.filename or ('rec-' + uuid.uuid4().hex[:8] + '.wav')
        else:
            # raw body
            data = request.get_data() or b''
            filename = request.args.get('fn') or ('rec-' + uuid.uuid4().hex[:8] + '.wav')
        # ensure extension
        if not filename.lower().endswith(('.wav', '.mp3', '.m4a', '.flac', '.ogg')):
            filename = filename + '.wav'
        out_path = RECORDINGS_DIR / filename
        with open(out_path, 'wb') as fh:
            fh.write(data)
        meta = _load_recordings()
        item = {
            'id': 'r-' + uuid.uuid4().hex[:8],
            'filename': filename,
            'path': str(out_path),
            'created_at': datetime.now(timezone.utc).isoformat(),
            'duration': None,
            'transcript': None,
        }
        meta.insert(0, item)
        _save_recordings(meta)
        return jsonify({'ok': True, 'recording': item}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.get('/api/voice/file/<rec_id>')
def get_recording_file(rec_id: str):
    recs = _load_recordings()
    rec = next((r for r in recs if r.get('id') == rec_id), None)
    if not rec:
        return jsonify({'error': 'not found'}), 404
    p = Path(rec.get('path'))
    if not p.exists():
        return jsonify({'error': 'file missing'}), 404
    return send_file(p, as_attachment=False)


@app.delete('/api/voice/<rec_id>')
def delete_recording(rec_id: str):
    recs = _load_recordings()
    rec = next((r for r in recs if r.get('id') == rec_id), None)
    if not rec:
        return jsonify({'error': 'not found'}), 404
    p = Path(rec.get('path'))
    try:
        if p.exists():
            p.unlink()
    except Exception:
        pass
    recs = [r for r in recs if r.get('id') != rec_id]
    _save_recordings(recs)
    return jsonify({'ok': True})


# ── Streaming transcription (SSE) ────────────────────────────────────────────
@app.post('/api/voice/transcribe_stream')
def transcribe_stream():
    """Stream a transcription for an existing recording as SSE. Body: { recordingId: str, model?: str }
    This will call Hugging Face Inference API with the audio bytes and stream sentence-level partials.
    """
    cfg = get_cfg()
    body = request.get_json(silent=True) or {}
    rec_id = body.get('recordingId')
    model = body.get('model') or body.get('modelName') or body.get('model') or 'openai/whisper-large-v2'
    if not rec_id:
        return jsonify({'error': 'recordingId required'}), 400

    recs = _load_recordings()
    rec = next((r for r in recs if r.get('id') == rec_id), None)
    if not rec:
        return jsonify({'error': 'not found'}), 404
    p = Path(rec.get('path'))
    if not p.exists():
        return jsonify({'error': 'file missing'}), 404

    token = cfg.get('hf_token')

    def generate():
        # announce start
        yield f"data: {json.dumps({'type': 'start', 'recordingId': rec_id})}\n\n"
        try:
            audio_bytes = p.read_bytes()
            headers = {'Authorization': f'Bearer {token}'} if token else {}
            # attempt to call HF speech-to-text model with raw bytes
            try:
                r = httpx.post(f'https://api-inference.huggingface.co/models/{model}', content=audio_bytes, headers=headers, timeout=120.0)
                if r.status_code >= 400:
                    yield f"data: {json.dumps({'type': 'error', 'msg': f'HF {r.status_code}'})}\n\n"
                    return
                # try JSON or text
                try:
                    resp_json = r.json()
                    # Many STT models return {text: '...'} or plain string
                    text = resp_json.get('text') if isinstance(resp_json, dict) and 'text' in resp_json else (resp_json if isinstance(resp_json, str) else json.dumps(resp_json))
                except Exception:
                    text = r.text
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'msg': str(e)})}\n\n"
                return

            # basic sentence split to stream partials
            if not text:
                text = ''
            # normalize whitespace
            import re
            text = re.sub(r'\s+', ' ', str(text)).strip()
            # split on common sentence delimiters
            parts = []
            if '.' in text:
                parts = [p.strip() for p in text.split('.') if p.strip()]
            else:
                # fallback split by comma/line
                parts = [p.strip() for p in text.replace('\n', ' ').split(',') if p.strip()]

            collected = []
            for i, part in enumerate(parts):
                # send partial
                collected.append(part)
                try:
                    yield f"data: {json.dumps({'type': 'partial', 'text': ' '.join(collected), 'segmentIndex': i})}\n\n"
                except GeneratorExit:
                    return
                time.sleep(0.4)

            # final
            yield f"data: {json.dumps({'type': 'done', 'recordingId': rec_id, 'transcript': ' '.join(collected)})}\n\n"
            # persist transcript into metadata
            try:
                rec['transcript'] = ' '.join(collected)
                recs2 = _load_recordings()
                # update the record in saved meta
                for j, it in enumerate(recs2):
                    if it.get('id') == rec_id:
                        recs2[j] = rec
                        break
                _save_recordings(recs2)
            except Exception:
                pass
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'msg': str(e)})}\n\n"

    resp = Response(stream_with_context(generate()), content_type='text/event-stream')
    resp.headers['Cache-Control'] = 'no-cache'
    resp.headers['X-Accel-Buffering'] = 'no'
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


# ── Debug: list all registered routes ─────────────────────────────────────────

@app.get('/api/routes')
def list_routes():
    """List all registered Flask routes."""
    try:
        rules = [ { 'rule': str(r.rule), 'endpoint': r.endpoint, 'methods': list(r.methods) } for r in app.url_map.iter_rules() ]
        return jsonify({'routes': rules})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    cfg = get_cfg()
    port = int(cfg.get("port", 8765))
    print(f"[universe-ai sidecar] Starting on http://127.0.0.1:{port}")
    print(f"[universe-ai sidecar] Data dir: {DATA_DIR}")
    _load_all_generated_blueprints()
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
