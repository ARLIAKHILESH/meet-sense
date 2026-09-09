import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Room, RoomEvent, Track } from "livekit-client";
import { fetchToken, summarizeTranscript } from "../lib/api.js";
import { connectEngagementSocket } from "../lib/websocket.js";
import { useEngagementTracking } from "../hooks/useEngagementTracking.js";
import { useTranscript } from "../hooks/useTranscript.js";
import HostDashboard from "../components/HostDashboard.jsx";
import EngagementBadge from "../components/EngagementBadge.jsx";

const domSafe = (s) => s.replace(/[^a-zA-Z0-9_-]/g, "_");

export default function Meeting() {
  const { room: roomCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const name = searchParams.get("name") || "Guest";
  const isHost = searchParams.get("host") === "1";
  const identity = useRef(`${name}-${Math.random().toString(36).slice(2, 8)}`).current;

  const roomRef = useRef(null);
  const gridRef = useRef(null);
  const localVideoRef = useRef(null);
  const hiddenLocalVideoRef = useRef(null);
  const wsRef = useRef(null);
  const transcriptRef = useRef([]);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [ending, setEnding] = useState(false);
  const [participants, setParticipants] = useState({});
  const [transcriptLines, setTranscriptLines] = useState(0);

  const attachRemoteVideo = useCallback((track, participant) => {
    if (!gridRef.current) return;
    const id = `tile-${domSafe(participant.identity)}`;
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement("div");
      container.id = id;
      container.className =
        "relative overflow-hidden rounded-lg border border-hairline bg-panel aspect-video";

      const label = document.createElement("div");
      label.className =
        "absolute bottom-2 left-2 rounded bg-base/70 px-2 py-0.5 text-xs font-mono text-parchment";
      label.textContent = participant.name || participant.identity.split("-")[0];
      label.dataset.role = "label";

      container.appendChild(label);
      gridRef.current.appendChild(container);
    }
    const videoEl = track.attach();
    videoEl.className = "h-full w-full object-cover";
    container.insertBefore(videoEl, container.querySelector('[data-role="label"]'));
  }, []);

  // --- connect to LiveKit room ---
  useEffect(() => {
    let mounted = true;
    let room;

    async function join() {
      try {
        const { token, url } = await fetchToken({ room: roomCode, identity, isHost, name });
        if (!url) {
          throw new Error(
            "Server didn't return a LiveKit URL - set LIVEKIT_URL in server/.env"
          );
        }

        room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind === Track.Kind.Video) attachRemoteVideo(track, participant);
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          document.getElementById(`tile-${domSafe(participant.identity)}`)?.remove();
        });

        await room.connect(url, token);
        room.localParticipant.name = name;
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);

        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.track) {
          camPub.track.attach(localVideoRef.current);
          camPub.track.attach(hiddenLocalVideoRef.current);
        }

        if (mounted) setConnected(true);
      } catch (e) {
        console.error(e);
        if (mounted) setError(e.message);
      }
    }

    join();

    return () => {
      mounted = false;
      room?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // --- engagement relay socket ---
  useEffect(() => {
    const ws = connectEngagementSocket(roomCode);
    wsRef.current = ws;

    const unsubscribe = ws.onMessage((msg) => {
      if (msg.type === "engagement") {
        setParticipants((prev) => ({
          ...prev,
          [msg.identity]: {
            identity: msg.identity,
            name: msg.name,
            score: msg.score,
            label: msg.label,
          },
        }));
      }
      if (msg.type === "transcript-line") {
        transcriptRef.current.push({
          speaker: msg.name,
          text: msg.text,
          ts: msg.ts,
        });
        setTranscriptLines(transcriptRef.current.length);
      }
    });

    return () => {
      unsubscribe();
      ws.close();
    };
  }, [roomCode]);

  // --- local engagement tracking (runs entirely client-side) ---
  const handleScore = useCallback(
    ({ score, label }) => {
      setParticipants((prev) => ({
        ...prev,
        [identity]: { identity, name, score, label },
      }));
      wsRef.current?.send({ type: "engagement", room: roomCode, identity, name, score, label });
    },
    [identity, name, roomCode]
  );

  useEngagementTracking({
    videoRef: hiddenLocalVideoRef,
    enabled: connected,
    onScore: handleScore,
  });

  // --- local speech-to-text ---
  const handleLine = useCallback(
    ({ speaker, text, ts }) => {
      transcriptRef.current.push({ speaker, text, ts });
      setTranscriptLines(transcriptRef.current.length);
      wsRef.current?.send({ type: "transcript-line", room: roomCode, identity, name, text, ts });
    },
    [identity, name, roomCode]
  );

  const { supported: sttSupported } = useTranscript({
    enabled: connected,
    speakerName: name,
    onLine: handleLine,
  });

  async function toggleMic() {
    const next = !micOn;
    await roomRef.current?.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }

  async function toggleCam() {
    const next = !camOn;
    await roomRef.current?.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  }

  async function endMeeting() {
    setEnding(true);
    try {
      const lines = [...transcriptRef.current].sort((a, b) => a.ts - b.ts);
      const transcriptText = lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");

      let summary = null;
      let summaryError = null;
      if (transcriptText.trim().length > 10) {
        try {
          summary = await summarizeTranscript(transcriptText);
        } catch (e) {
          summaryError = e.message;
        }
      }

      sessionStorage.setItem(
        `meetsense-summary-${roomCode}`,
        JSON.stringify({ summary, summaryError, transcriptText })
      );

      roomRef.current?.disconnect();
      navigate(`/summary/${roomCode}`);
    } finally {
      setEnding(false);
    }
  }

  const selfScore = participants[identity];

  return (
    <div className="flex h-screen flex-col bg-base">
      <header className="flex items-center justify-between border-b border-hairline px-5 py-3">
        <div className="flex items-center gap-3">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-live" : "bg-hairline"}`} />
          <span className="font-display text-sm font-semibold">MeetSense</span>
          <span className="font-mono text-xs text-muted">/{roomCode}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted">
          {!sttSupported && (
            <span className="text-low">Speech-to-text needs a Chromium browser</span>
          )}
          <span className="font-mono">{transcriptLines} lines captured</span>
          {selfScore && <EngagementBadge label={selfScore.label} score={selfScore.score} />}
        </div>
      </header>

      {error && (
        <div className="border-b border-low/40 bg-low/10 px-5 py-2 text-sm text-low">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-5">
          <div ref={gridRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative aspect-video overflow-hidden rounded-lg border border-hairline bg-panel">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-2 left-2 rounded bg-base/70 px-2 py-0.5 font-mono text-xs text-parchment">
                {name} (you)
              </div>
            </div>
          </div>
          {/* hidden element feeding MediaPipe - never rendered visibly */}
          <video ref={hiddenLocalVideoRef} autoPlay muted playsInline className="hidden" />
        </main>

        {isHost && <HostDashboard participants={participants} />}
      </div>

      <footer className="flex items-center justify-center gap-3 border-t border-hairline px-5 py-4">
        <button
          onClick={toggleMic}
          className={`rounded-md border border-hairline px-4 py-2 text-sm ${
            micOn ? "bg-panel text-parchment" : "bg-low/20 text-low"
          }`}
        >
          {micOn ? "Mute" : "Unmute"}
        </button>
        <button
          onClick={toggleCam}
          className={`rounded-md border border-hairline px-4 py-2 text-sm ${
            camOn ? "bg-panel text-parchment" : "bg-low/20 text-low"
          }`}
        >
          {camOn ? "Stop video" : "Start video"}
        </button>
        {isHost && (
          <button
            onClick={endMeeting}
            disabled={ending}
            className="rounded-md bg-parchment px-4 py-2 text-sm font-medium text-base disabled:opacity-50"
          >
            {ending ? "Generating summary…" : "End meeting & summarize"}
          </button>
        )}
      </footer>
    </div>
  );
}
