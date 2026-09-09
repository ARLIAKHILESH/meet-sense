import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function Summary() {
  const { room } = useParams();
  const [data, setData] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    const raw = sessionStorage.getItem(`meetsense-summary-${room}`);
    setData(raw ? JSON.parse(raw) : null);
  }, [room]);

  if (data === undefined) return null;

  if (!data) {
    return (
      <Centered>
        <p className="text-muted">No summary found for room "{room}".</p>
        <Link to="/" className="mt-4 inline-block text-engaged underline">
          Back to home
        </Link>
      </Centered>
    );
  }

  const { summary, summaryError, transcriptText } = data;

  return (
    <div className="min-h-screen bg-base px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-engaged" />
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            meeting closed
          </span>
        </div>

        {summaryError && (
          <div className="mb-6 rounded-md border border-low/40 bg-low/10 p-4 text-sm text-low">
            Couldn't generate an AI summary: {summaryError}
            <br />
            Check ANTHROPIC_API_KEY in server/.env.
          </div>
        )}

        {!summary && !summaryError && (
          <div className="mb-6 rounded-md border border-hairline bg-panel p-4 text-sm text-muted">
            No speech was captured during this meeting, so there's nothing to summarize yet.
          </div>
        )}

        {summary && (
          <>
            <h1 className="font-display text-2xl font-semibold text-parchment">
              {summary.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">{summary.overview}</p>

            <Section title="Key points" items={summary.keyPoints} />
            <Section title="Decisions" items={summary.decisions} />

            {summary.actionItems?.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-parchment">
                  Action items
                </h2>
                <div className="divide-y divide-hairline rounded-lg border border-hairline">
                  {summary.actionItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span>{item.task}</span>
                      <span className="font-mono text-xs text-muted">
                        {item.owner || "unassigned"}
                        {item.dueDate ? ` · ${item.dueDate}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Section title="Open questions" items={summary.openQuestions} />
          </>
        )}

        <details className="mt-10">
          <summary className="cursor-pointer text-xs text-muted">
            View raw transcript
          </summary>
          <pre className="mt-3 whitespace-pre-wrap rounded-md border border-hairline bg-panel p-4 font-mono text-xs text-muted">
            {transcriptText || "(empty)"}
          </pre>
        </details>

        <Link to="/" className="mt-10 inline-block text-sm text-engaged underline">
          Start another meeting
        </Link>
      </div>
    </div>
  );
}

function Section({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-8">
      <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-parchment">
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-parchment/90">
            <span className="text-muted">–</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-6 text-center">
      <div>{children}</div>
    </div>
  );
}
