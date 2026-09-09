import { useEffect, useRef, useState } from "react";

/**
 * Captures speech-to-text for the LOCAL participant using the browser's
 * native Web Speech API (SpeechRecognition). This is free and needs no
 * API key, which is why it's the default here - but it only reliably
 * ships in Chromium-based browsers today.
 *
 * For a production system, or for real speaker diarization across all
 * participants, swap this for a server-side streaming STT provider
 * (e.g. AssemblyAI or OpenAI Whisper) that ingests each participant's
 * LiveKit audio track - see README "Swapping in production-grade STT".
 *
 * Each finalized line is reported as { speaker, text, ts } via onLine,
 * so the caller can assemble a running, speaker-labeled transcript.
 */
export function useTranscript({ enabled, speakerName, onLine }) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    if (!enabled) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            onLine?.({ speaker: speakerName, text, ts: Date.now() });
          }
        }
      }
    };

    recognition.onend = () => {
      // Browsers auto-stop after a period of silence; restart while enabled.
      if (enabled) {
        try {
          recognition.start();
        } catch {
          /* already started */
        }
      }
    };

    recognition.onerror = (e) => {
      console.warn("SpeechRecognition error:", e.error);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch (e) {
      console.warn("Could not start recognition:", e);
    }

    return () => {
      setListening(false);
      recognition.onend = null;
      recognition.stop();
    };
  }, [enabled, speakerName, onLine]);

  return { supported, listening };
}
