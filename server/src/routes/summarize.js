import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

let anthropic = null;
function getClient() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY in server/.env");
    }
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

const SYSTEM_PROMPT = `You are MeetSense's meeting analyst. You are given a raw, possibly messy
speech-to-text transcript of a meeting, with lines roughly in the form "Speaker: text".
Extract a clean, factual summary. Do not invent information that isn't in the transcript.
If a section has nothing to report, return an empty array for it.

Respond with ONLY valid JSON, no markdown fences, no preamble, matching this exact shape:
{
  "title": "short 5-8 word meeting title",
  "overview": "2-3 sentence plain-language summary of what the meeting was about",
  "keyPoints": ["point 1", "point 2", ...],
  "decisions": ["decision 1", ...],
  "actionItems": [{ "task": "string", "owner": "string or null if unclear", "dueDate": "string or null" }],
  "openQuestions": ["unresolved question 1", ...]
}`;

/**
 * POST /api/summarize
 * body: { transcript: string }
 */
router.post("/summarize", async (req, res) => {
  const { transcript } = req.body || {};

  if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
    return res.status(400).json({ error: "A non-trivial transcript string is required" });
  }

  try {
    const client = getClient();

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Transcript:\n\n${transcript.slice(0, 60000)}`,
        },
      ],
    });

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "");

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(502).json({
        error: "Model did not return valid JSON",
        raw: cleaned,
      });
    }

    res.json(parsed);
  } catch (err) {
    console.error("summarize error:", err);
    res.status(500).json({ error: err.message || "Summarization failed" });
  }
});

export default router;
