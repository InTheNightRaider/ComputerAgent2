# Universe AI

A local-first AI desktop app with chat, pipelines, automations, tools, and agents — powered by Ollama and Anthropic Claude.

---

## Installing Whisper (Voice Transcription)

Whisper transcription runs through the **Hugging Face Inference API**. Setup takes about 2 minutes.

### Step 1 — Get a free Hugging Face token

1. Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Click **New token**
3. Name it anything (e.g. `universe-ai`), set role to **Read**
4. Copy the token (starts with `hf_...`)

### Step 2 — Add the token in the app

1. Open the app → click **Tools** → **Voice Recorder**
2. In the right panel, click the **Models** tab
3. Paste your token in the **Hugging Face Token** field
4. Click **Save Token**

### Step 3 — Choose a Whisper model

In the same **Models** tab, pick a model based on your needs:

| Model | Speed | Accuracy | Best for |
|-------|-------|----------|----------|
| Whisper Tiny | Fastest | Lower | Quick notes, short clips |
| Whisper Base | Fast | Decent | Casual use |
| Whisper Small | Moderate | Good | Most recordings |
| Whisper Medium | Slower | High | Meetings, interviews |
| Whisper Large v2 | Slow | Very high | Important transcriptions |
| Whisper Large v3 | Slowest | Best | Maximum accuracy |

### Step 4 — Transcribe

1. Record audio or select a past recording from the left panel
2. Click **Transcribe**
3. The transcript streams in live
4. Use the **AI Chat** tab to generate summaries, action items, meeting notes, contracts, or anything else from the transcript

---

## Troubleshooting Transcription

**HF 410 error** — The model endpoint is unavailable on the free tier. Switch to a different Whisper model in the Models tab (Whisper Small or Medium work reliably on the free tier).

**No audio after recording** — Make sure your browser has microphone permission. In the Tauri app, allow microphone access when prompted on first launch.

**Token not saving** — Restart the sidecar. From the app directory run `npm run dev` to restart everything cleanly.

---

## Running the App (Development)

```bash
cd App
npm install
npm run dev
```

Requires:
- Node.js 18+
- Python 3.11–3.13 (for the sidecar)
- Rust + Cargo (for Tauri builds)
- [Ollama](https://ollama.ai) running locally for local AI models

---

## Building an Installer

```bash
cd App
npx @tauri-apps/cli@2 build
```

Installer will be at:
```
App/src-tauri/target/release/bundle/nsis/Universe AI_x.x.x_x64-setup.exe
```

---

## Auto-Updates

The app checks for updates automatically on launch. To release a new version:

1. Bump the version in `App/src-tauri/tauri.conf.json`
2. Commit and tag:
```bash
git add -A
git commit -m "v0.x.x - description"
git tag v0.x.x
git push origin main --tags
```

GitHub Actions builds and publishes the release automatically. Installed copies update on next restart.
