import { useState } from "react";
import { useNavigate } from "react-router-dom";

function randomRoomCode() {
  return Math.random().toString(36).slice(2, 8);
}

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [asHost, setAsHost] = useState(true);

  function start(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const roomCode = room.trim() || randomRoomCode();
    const params = new URLSearchParams({
      name: name.trim(),
      host: asHost ? "1" : "0",
    });
    navigate(`/meeting/${roomCode}?${params.toString()}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-live" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted">
              signal check
            </span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-parchment">
            MeetSense
          </h1>
          <p className="mt-2 text-sm text-muted">
            Real-time meeting telemetry and AI summaries.
          </p>
        </div>

        <form onSubmit={start} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-muted">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              className="w-full rounded-md border border-hairline bg-panel px-3 py-2.5 text-sm text-parchment outline-none focus:border-engaged"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-muted">
              Room code <span className="text-muted/60">(leave blank to create one)</span>
            </label>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. team-standup"
              className="w-full rounded-md border border-hairline bg-panel px-3 py-2.5 text-sm text-parchment outline-none focus:border-engaged"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={asHost}
              onChange={(e) => setAsHost(e.target.checked)}
              className="h-4 w-4 rounded border-hairline bg-panel accent-engaged"
            />
            Join as host (see live dashboard + summary)
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-parchment py-2.5 text-sm font-medium text-base transition hover:opacity-90"
          >
            Enter meeting
          </button>
        </form>
      </div>
    </div>
  );
}
