"""
Universe AI — Dev Polish Agent

Autonomously tests API endpoints, reviews component source with an LLM,
and queues improvement modifications via the self-modification system.

Usage (from main.py):
    import polish_agent
    polish_agent.run_cycle_async(queue_improvement, get_cfg)
"""

import json
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import httpx

# ── Paths ─────────────────────────────────────────────────────────────────────
_HERE = Path(__file__).parent
FRONTEND_TABS = _HERE.parent / "frontend" / "src" / "tabs"

# ── Components to review ──────────────────────────────────────────────────────
COMPONENTS = [
    {"id": "Chat",          "file": "Chat.tsx"},
    {"id": "Tools",         "file": "Tools.tsx"},
    {"id": "Pipelines",     "file": "Pipelines.tsx"},
    {"id": "Automations",   "file": "Automations.tsx"},
    {"id": "Agents",        "file": "Agents.tsx"},
    {"id": "Modifications", "file": "Modifications.tsx"},
    {"id": "Settings",      "file": "Settings.tsx"},
]

# ── Endpoints to health-check ─────────────────────────────────────────────────
ENDPOINTS = [
    {"method": "GET",  "path": "/health",                "name": "Health"},
    {"method": "GET",  "path": "/api/settings",          "name": "Settings"},
    {"method": "GET",  "path": "/api/ollama/models",     "name": "Ollama Models"},
    {"method": "GET",  "path": "/api/app/modifications", "name": "Modifications"},
    {"method": "GET",  "path": "/api/pipelines",         "name": "Pipelines"},
    {"method": "GET",  "path": "/api/tools",             "name": "Tools"},
]

# ── Shared cycle state ─────────────────────────────────────────────────────────
_state: dict = {
    "running":              False,
    "continuous":           False,
    "cycle_count":          0,
    "started_at":           None,
    "phase":                None,   # starting | health_check | reviewing | queuing | cooling | done
    "current_component":    None,
    "health_results":       [],
    "review_results":       [],
    "improvements_queued":  0,
    "improvements_total":   0,
    "log":                  [],
    "stop_requested":       False,
}
_lock = threading.Lock()


# ── Public API ─────────────────────────────────────────────────────────────────

def get_state() -> dict:
    with _lock:
        return dict(_state)


def request_stop():
    with _lock:
        _state["stop_requested"] = True


def run_cycle_async(
    queue_improvement: Callable[[str], None],
    get_cfg: Callable,
    continuous: bool = False,
    cooldown_seconds: int = 120,
) -> bool:
    """
    Start a polish cycle in a background thread.
    Returns False if a cycle is already running.
    """
    with _lock:
        if _state["running"]:
            return False
        _state.update({
            "running":             True,
            "continuous":          continuous,
            "started_at":          _now(),
            "phase":               "starting",
            "current_component":   None,
            "health_results":      [],
            "review_results":      [],
            "improvements_queued": 0,
            "stop_requested":      False,
            "log":                 [],
        })

    threading.Thread(
        target=_cycle_loop,
        args=(queue_improvement, get_cfg, continuous, cooldown_seconds),
        daemon=True,
        name="polish-agent",
    ).start()
    return True


# ── Health check ──────────────────────────────────────────────────────────────

def health_check(base_url: str = "http://localhost:8765") -> list[dict]:
    results = []
    for ep in ENDPOINTS:
        try:
            fn = httpx.get if ep["method"] == "GET" else httpx.post
            r = fn(f"{base_url}{ep['path']}", timeout=5.0)
            results.append({
                "name":   ep["name"],
                "path":   ep["path"],
                "method": ep["method"],
                "ok":     r.is_success,
                "status": r.status_code,
                "error":  None,
            })
        except Exception as exc:
            results.append({
                "name":   ep["name"],
                "path":   ep["path"],
                "method": ep["method"],
                "ok":     False,
                "status": None,
                "error":  str(exc)[:80],
            })
    return results


# ── Component review ──────────────────────────────────────────────────────────

_REVIEW_SYSTEM = """\
You are a senior React/TypeScript code reviewer for a local desktop AI app.
Review the component code and identify up to 3 concrete, fixable issues.

Focus ONLY on:
1. Actual bugs: uncaught exceptions, missing null checks, broken state transitions
2. UX gaps: missing loading states, unhelpful error messages, broken empty states
3. Incomplete features: TODO comments, stub handlers, hardcoded values that should be dynamic

Return ONLY a valid JSON array, no markdown, no explanation:
[{"severity":"high|medium|low","issue":"one sentence","fix":"one sentence instruction for an LLM to fix it"}]

If the code has no significant issues, return exactly: []
"""


def review_component(name: str, code: str, get_cfg: Callable) -> list[dict]:
    cfg = get_cfg()
    messages = [
        {"role": "system", "content": _REVIEW_SYSTEM},
        {"role": "user",   "content": f"Review the {name} component:\n\n{code[:7000]}"},
    ]

    raw = _call_llm(messages, cfg, max_tokens=512)
    if not raw:
        return []

    try:
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", raw.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"\n?```\s*$", "", cleaned.strip(), flags=re.MULTILINE)
        result = json.loads(cleaned.strip())
        return result[:3] if isinstance(result, list) else []
    except Exception:
        return []


# ── Main cycle ────────────────────────────────────────────────────────────────

def _cycle_loop(
    queue_improvement: Callable,
    get_cfg: Callable,
    continuous: bool,
    cooldown_seconds: int,
):
    while True:
        _run_one_cycle(queue_improvement, get_cfg)

        with _lock:
            stop = _state["stop_requested"]
            if not continuous or stop:
                _state.update({"running": False, "phase": "done", "continuous": False})
                break

            # Cooling-down phase before next cycle
            _state["phase"] = "cooling"
            _log(f"Cooling down {cooldown_seconds}s before next cycle…")

        # Interruptible sleep
        for _ in range(cooldown_seconds):
            time.sleep(1)
            with _lock:
                if _state["stop_requested"]:
                    break

        with _lock:
            if _state["stop_requested"]:
                _state.update({"running": False, "phase": "done", "continuous": False})
                _log("Stopped by user request.")
                break

            _state["cycle_count"] = _state.get("cycle_count", 0) + 1
            _state.update({
                "started_at":        _now(),
                "phase":             "starting",
                "current_component": None,
                "health_results":    [],
                "review_results":    [],
                "improvements_queued": 0,
                "stop_requested":    False,
            })


def _run_one_cycle(queue_improvement: Callable, get_cfg: Callable):
    try:
        # ── 1. Health check ───────────────────────────────────────────────────
        _update({"phase": "health_check"})
        _log("Health check — testing all API endpoints…")
        results = health_check()
        ok = sum(1 for r in results if r["ok"])
        _update({"health_results": results})
        _log(f"Health: {ok}/{len(results)} endpoints OK" + (
            "" if ok == len(results) else
            " — issues: " + ", ".join(r["name"] for r in results if not r["ok"])
        ))

        _check_stop()

        # ── 2. Review each component ─────────────────────────────────────────
        _update({"phase": "reviewing"})
        all_reviews = []

        for comp in COMPONENTS:
            _check_stop()
            path = FRONTEND_TABS / comp["file"]
            if not path.exists():
                _log(f"Skip {comp['id']}: file not found")
                continue

            _update({"current_component": comp["id"]})
            _log(f"Reviewing {comp['id']}…")

            code = path.read_text(encoding="utf-8")
            issues = review_component(comp["id"], code, get_cfg)

            if issues:
                _log(f"  ✗ {comp['id']}: {len(issues)} issue(s) — {', '.join(i['severity'] for i in issues)}")
                all_reviews.append({"component": comp["id"], "issues": issues})
            else:
                _log(f"  ✓ {comp['id']}: looks good")

            time.sleep(1)

        _update({"review_results": all_reviews, "current_component": None})

        # ── 3. Queue improvements for high + medium severity ─────────────────
        _update({"phase": "queuing"})
        queued = 0
        for rev in all_reviews:
            for issue in rev["issues"]:
                _check_stop()
                if issue.get("severity") in ("high", "medium"):
                    prompt = (
                        f"Fix this issue in the {rev['component']} tab component: "
                        f"{issue['fix']} "
                        f"[Issue: {issue['issue']}]"
                    )
                    _log(f"Queuing: {prompt[:70]}…")
                    try:
                        queue_improvement(prompt)
                        queued += 1
                    except Exception as e:
                        _log(f"  ✗ Queue error: {e}")
                    time.sleep(0.5)

        total_before = _state.get("improvements_total", 0)
        _update({
            "improvements_queued": queued,
            "improvements_total":  total_before + queued,
        })
        _log(f"Cycle complete. {queued} improvement(s) queued.")

    except _StopCycle:
        _log("Cycle interrupted.")
    except Exception as exc:
        _log(f"Cycle error: {exc}")


# ── Helpers ───────────────────────────────────────────────────────────────────

class _StopCycle(Exception):
    pass


def _check_stop():
    with _lock:
        if _state["stop_requested"]:
            raise _StopCycle


def _log(msg: str):
    entry = {"time": _now(), "msg": msg}
    with _lock:
        _state["log"].append(entry)
        if len(_state["log"]) > 200:
            _state["log"] = _state["log"][-200:]


def _update(patch: dict):
    with _lock:
        _state.update(patch)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat() + "Z"


def _call_llm(messages: list[dict], cfg: dict, max_tokens: int = 512) -> str:
    model      = cfg.get("ollama_model", "mistral:7b-instruct")
    ollama_url = cfg.get("ollama_url", "http://localhost:11434")

    try:
        r = httpx.post(
            ollama_url + "/api/chat",
            json={"model": model, "messages": messages, "stream": False},
            timeout=120.0,
        )
        if r.is_success:
            return r.json()["message"]["content"].strip()
    except Exception:
        pass

    if cfg.get("anthropic_enabled") and cfg.get("anthropic_key"):
        sys_msgs  = [m for m in messages if m["role"] == "system"]
        user_msgs = [m for m in messages if m["role"] != "system"]
        try:
            r = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key":         cfg["anthropic_key"],
                    "anthropic-version": "2023-06-01",
                    "Content-Type":      "application/json",
                },
                json={
                    "model":      "claude-haiku-4-5-20251001",
                    "max_tokens": max_tokens,
                    "messages":   user_msgs,
                    **({"system": "\n".join(m["content"] for m in sys_msgs)} if sys_msgs else {}),
                },
                timeout=30.0,
            )
            if r.is_success:
                return r.json()["content"][0]["text"].strip()
        except Exception:
            pass

    return ""
