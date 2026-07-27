export const T = {
  bg: "#191712",
  panel: "#221F17",
  panelLine: "#332E22",
  text: "#EDE6D6",
  textDim: "#9C9484",
  gold: "#C9A036",
  blue: "#4E8B9A",
  green: "#8AA85C",
  rust: "#B5533C",
  displayFont: "'Oswald', sans-serif",
  monoFont: "'JetBrains Mono', monospace",
  bodyFont: "'Inter', sans-serif",
};

export const fmtARS = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function SectionHeader({ icon, title, note }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "34px 0 14px", flexWrap: "wrap" }}>
      {icon}
      <h2
        style={{
          fontFamily: T.displayFont,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "1px",
          color: T.text,
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        {title}
      </h2>
      <div style={{ flex: 1, height: 1, background: T.panelLine, minWidth: 20 }} />
      {note && <span style={{ fontFamily: T.bodyFont, fontSize: 11, color: T.textDim }}>{note}</span>}
    </div>
  );
}
