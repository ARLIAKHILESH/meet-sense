# MeetSense

AI-powered real-time meeting analysis and summarization. A working prototype:
live video calling, a client-side "engagement telemetry" dashboard for the
host, live speech-to-text, and an AI-generated post-meeting summary (key
points, decisions, action items).

## Architecture

```
meetsense/
  server/     Express API + WebSocket relay
  client/     React (Vite) frontend
```

| Feature | How it works | Service used |
|---|---|---|
| Video/audio calling | WebRTC via LiveKit | LiveKit Cloud (free tier) |
| Engagement estimate | Face landmarks (position, eye state) read from your own camera, entirely in-browser | MediaPipe Tasks Vision (client-side, no API key) |
| Speech-to-text | Browser-native speech recognition | Web Speech API (built into Chrome, no API key) |
| AI summary | Transcript sent to an LLM, returns structured JSON | Anthropic API (Claude) |
| Live dashboard updates | Engagement scores + transcript lines relayed between browsers | Your own WebSocket server |

Nothing about this requires you to train a model — every "AI" piece is either
a pretrained model running in the browser (MediaPipe) or an API call to an
LLM (Anthropic). That's normal and expected for a project like this; the
work is in the integration, the UX, and the data pipeline, not in building
new ML models from scratch.

## 1. Get your API keys

**LiveKit** (free): create a project at https://cloud.livekit.io — copy the
`URL`, `API Key`, and `API Secret` from your project settings.

**Anthropic**: create a key at https://console.anthropic.com

## 2. Configure environment variables

```bash
cd server
cp .env.example .env
# edit .env and paste in your LiveKit + Anthropic credentials

cd ../client
cp .env.example .env
# defaults are fine for local dev
```

## 3. Install and run

Two terminals:

```bash
# Terminal 1 - backend
cd server
npm install
npm run dev
# -> MeetSense server listening on http://localhost:8787

# Terminal 2 - frontend
cd client
npm install
npm run dev
# -> http://localhost:5173
```

Open `http://localhost:5173` in **two different browser tabs/windows** (or
two devices) to simulate a real meeting with 2+ participants. Join one tab
as host, the other as a regular participant.

Use Chrome or another Chromium-based browser — Web Speech API (used for
transcription) isn't reliably supported elsewhere yet.

## 4. Try it

1. Enter a name in both tabs, use the same room code, check "Join as host"
   in only one tab.
2. Allow camera/mic access in both tabs.
3. Talk for a bit — you'll see the transcript line counter increase in the
   header, and the host tab will show live engagement bars in the right rail.
4. Click **End meeting & summarize** in the host tab. It sends the
   accumulated transcript to Claude and takes you to a summary page with key
   points, decisions, action items, and open questions.

## Design decisions worth explaining to a reviewer

- **The CV never leaves the browser.** Each participant's face-tracking runs
  locally on their own device; only a numeric score (0–100) and a label
  ("attentive" / "partial" / "distracted" / "away") is sent over the
  network. No raw video is uploaded anywhere for analysis. This is both a
  privacy choice and a practical one — it avoids needing a video-processing
  server.
- **Transcription is per-participant, not centralized.** Each browser
  transcribes its own speaker's audio and broadcasts finalized lines. This
  keeps the system simple and free, at the cost of losing perfect speaker
  diarization if two people talk in overlapping windows. See below for how
  to upgrade this.
- **The engagement score is a proxy, explicitly.** It combines face
  presence, head yaw (are they facing the camera), and eye openness into a
  single number via simple, tunable rules — not a trained classifier. This
  is intentional: it's explainable, debuggable, and honest about what it
  measures. It does **not** detect attention, interest, or comprehension as
  cognitive states. Say this plainly in your report; it's a real limitation
  of any camera-based "attention" system, not just this one.

## Swapping in production-grade STT

The Web Speech API keeps this project free and dependency-light, but it's
browser-only and has no true multi-speaker diarization. To upgrade:

1. Instead of `useTranscript`'s browser recognition, capture each
   participant's LiveKit audio track server-side (LiveKit supports
   recording/egress, or you can forward audio frames over a data channel).
2. Stream that audio to a provider with real diarization — AssemblyAI's
   real-time endpoint or OpenAI's `gpt-4o-transcribe` / Whisper are good
   options.
3. Replace the client-side `transcript-line` WebSocket messages with
   server-emitted ones from that pipeline instead.

This is meaningfully more infrastructure (you'd need an audio egress
pipeline), so it's left out of this MVP — but the summarization step
downstream doesn't change at all, since it just consumes whatever transcript
text it's given.

## Known limitations (put these in your report, don't hide them)

- Engagement scoring is heuristic and camera-angle sensitive; it will
  misfire (e.g., someone looking down at notes reads as "distracted").
- Web Speech API requires Chrome/Chromium and an internet connection (it
  calls Google's speech service under the hood).
- No authentication/authorization — anyone with the room code can join.
  Fine for a class demo, not for production.
- No persistence — transcripts and summaries live only in
  `sessionStorage`/memory and vanish on refresh past the summary page. Add a
  database if you want meeting history.
- Ethics: a host-visible "engagement score" per participant is a real
  workplace-surveillance pattern. If you extend this beyond a class project,
  add participant consent, visibility of your own score to yourself, and a
  clear data-retention policy.

## Stack

- **Backend**: Node.js, Express, `ws` (WebSocket), `livekit-server-sdk`,
  `@anthropic-ai/sdk`
- **Frontend**: React 18, Vite, Tailwind CSS, `livekit-client`,
  `@mediapipe/tasks-vision`, `react-router-dom`
