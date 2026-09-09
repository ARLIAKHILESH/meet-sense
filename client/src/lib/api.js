const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export async function fetchToken({ room, identity, isHost }) {
  const res = await fetch(`${API_BASE}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room, identity, isHost }),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  return res.json(); // { token, url }
}

export async function summarizeTranscript(transcript) {
  const res = await fetch(`${API_BASE}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Summarize request failed: ${res.status}`);
  }
  return res.json();
}

export const WS_BASE = API_BASE.replace(/^http/, "ws");
