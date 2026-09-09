const LABEL_STYLES = {
  attentive: { color: "#4FB6A6", text: "attentive" },
  partial: { color: "#E8A33D", text: "partial" },
  distracted: { color: "#C0654F", text: "distracted" },
  away: { color: "#6B7075", text: "away" },
  "no-face": { color: "#6B7075", text: "reading…" },
};

export default function EngagementBadge({ label, score }) {
  const style = LABEL_STYLES[label] || LABEL_STYLES["no-face"];
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span
        className="status-dot h-2 w-2 rounded-full"
        style={{ backgroundColor: style.color }}
      />
      <span className="text-muted">{style.text}</span>
      {typeof score === "number" && (
        <span className="text-parchment/60">{score}</span>
      )}
    </div>
  );
}
