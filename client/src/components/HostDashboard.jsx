import EngagementBadge from "./EngagementBadge.jsx";

const BAR_COLORS = {
  attentive: "#4FB6A6",
  partial: "#E8A33D",
  distracted: "#C0654F",
  away: "#6B7075",
  "no-face": "#6B7075",
};

export default function HostDashboard({ participants }) {
  const entries = Object.values(participants).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <aside className="telemetry-panel flex h-full w-72 shrink-0 flex-col border-l border-hairline bg-panel">
      <div className="border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-live" />
          <h2 className="font-display text-sm font-semibold tracking-wide">
            Engagement telemetry
          </h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Proxy signals only - face position &amp; eye state, not true attention.
        </p>
      </div>

      <div className="flex-1 divide-y divide-hairline overflow-y-auto">
        {entries.length === 0 && (
          <p className="px-4 py-6 text-xs text-muted">
            Waiting for participants to report signal…
          </p>
        )}
        {entries.map((p) => (
          <div key={p.identity} className="px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-body text-sm">{p.name}</span>
              <EngagementBadge label={p.label} score={p.score} />
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-hairline">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${p.score ?? 0}%`,
                  backgroundColor: BAR_COLORS[p.label] || BAR_COLORS["no-face"],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
