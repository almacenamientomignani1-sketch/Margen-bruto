import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wheat,
  DollarSign,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Radio,
  Lock,
  Unlock,
  Plus,
  X,
  Server,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Paleta / tokens de diseño — "Pizarra de rueda" (grain-exchange chalkboard)
// ---------------------------------------------------------------------------
const T = {
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

const FONT_IMPORT_ID = "panel-agro-fonts";

function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_IMPORT_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_IMPORT_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);
}

// ---------------------------------------------------------------------------
// Dígito estilo "split-flap"
// ---------------------------------------------------------------------------
function FlapValue({ value, size = 28, color }) {
  const [display, setDisplay] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value !== prevRef.current) {
      setFlipping(true);
      const t = setTimeout(() => {
        setDisplay(value);
        setFlipping(false);
        prevRef.current = value;
      }, 220);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span
      style={{
        fontFamily: T.monoFont,
        fontSize: size,
        fontWeight: 700,
        color: color || T.text,
        display: "inline-block",
        transition: "opacity 220ms ease, transform 220ms ease",
        opacity: flipping ? 0.25 : 1,
        transform: flipping ? "translateY(-3px)" : "translateY(0)",
        letterSpacing: "0.5px",
      }}
    >
      {display}
    </span>
  );
}

const fmtARS = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// ---------------------------------------------------------------------------
// Historial — guarda cada cotización que pasa por el panel (Cloudflare D1)
// ---------------------------------------------------------------------------
function saveHistory({ tipo, simbolo, etiqueta, precio, compra, venta }) {
  if (precio == null && compra == null && venta == null) return; // nada útil para guardar
  fetch("/api/history/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo, simbolo, etiqueta, precio, compra, venta }),
  }).catch(() => {
    /* silencioso: si falla el guardado no queremos romper el panel en vivo */
  });
}

function TrendIcon({ delta }) {
  if (delta == null || Math.abs(delta) < 0.0001) return <Minus size={14} color={T.textDim} />;
  if (delta > 0) return <TrendingUp size={14} color={T.green} />;
  return <TrendingDown size={14} color={T.rust} />;
}

function QuoteCard({ label, sublabel, buy, sell, accent, loading, error, prevSell }) {
  const delta = prevSell != null && sell != null ? sell - prevSell : null;
  return (
    <div
      style={{
        background: T.panel,
        border: `1px solid ${T.panelLine}`,
        borderRadius: 4,
        padding: "16px 18px",
        minWidth: 200,
        flex: "1 1 200px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accent }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: T.displayFont, fontSize: 13, letterSpacing: "1.5px", color: T.textDim, textTransform: "uppercase" }}>
          {label}
        </span>
        <TrendIcon delta={delta} />
      </div>
      {sublabel && (
        <div style={{ fontFamily: T.bodyFont, fontSize: 11, color: T.textDim, marginTop: 2 }}>{sublabel}</div>
      )}

      {error ? (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, color: T.rust, fontFamily: T.bodyFont, fontSize: 12 }}>
          <AlertCircle size={14} /> sin datos
        </div>
      ) : loading ? (
        <div style={{ marginTop: 12, fontFamily: T.monoFont, color: T.textDim, fontSize: 20 }}>· · ·</div>
      ) : (
        <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 10 }}>
          <FlapValue value={fmtARS(sell)} size={24} color={accent} />
          {buy != null && (
            <span style={{ fontFamily: T.monoFont, fontSize: 12, color: T.textDim }}>
              compra {fmtARS(buy)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, note }) {
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

// ---------------------------------------------------------------------------
// Sección reMarkets (Primary API) — login + instrumentos + market data
// ---------------------------------------------------------------------------
const GRAIN_KEYWORDS = ["SOJ", "MAI", "TRI", "GIR", "SOR", "CEB"];
const GRAIN_LABELS = { SOJ: "Soja", MAI: "Maíz", TRI: "Trigo", GIR: "Girasol", SOR: "Sorgo", CEB: "Cebada" };

function RemarketsPanel() {
  // Vacío = mismo dominio (funciona solo con la Cloudflare Pages Function ya incluida).
  // Para desarrollo local con `wrangler pages dev`, dejalo vacío también: sirve todo junto.
  const [proxyUrl, setProxyUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState(null);

  const [instruments, setInstruments] = useState([]);
  const [loadingInstruments, setLoadingInstruments] = useState(false);
  const [instrumentsError, setInstrumentsError] = useState(null);
  const [instrumentFilter, setInstrumentFilter] = useState("");
  const [onlyFutures, setOnlyFutures] = useState(false);

  const [watchlist, setWatchlist] = useState([]);
  const [marketData, setMarketData] = useState({});
  const [prevMarketData, setPrevMarketData] = useState({});

  const connect = async () => {
    setConnecting(true);
    setConnError(null);
    try {
      const res = await fetch(`${proxyUrl}/api/remarkets/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error(`El proxy respondió ${res.status}`);
      const data = await res.json();
      if (!data.token) throw new Error("El proxy no devolvió token");
      setToken(data.token);
    } catch (e) {
      setConnError(
        e.message.includes("Failed to fetch")
          ? "No se pudo contactar al proxy local. ¿Está corriendo en " + proxyUrl + "?"
          : e.message
      );
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setToken(null);
    setInstruments([]);
    setWatchlist([]);
    setMarketData({});
  };

  const loadInstruments = async () => {
    if (!token) return;
    setLoadingInstruments(true);
    setInstrumentsError(null);
    try {
      const res = await fetch(
        `${proxyUrl}/api/remarkets/instruments?token=${encodeURIComponent(token)}&segment=DDA`
      );
      if (!res.ok) throw new Error(`El proxy respondió ${res.status}`);
      const data = await res.json();
      const list = (data.instruments || []).filter((i) =>
        GRAIN_KEYWORDS.some((k) => i.symbol && i.symbol.toUpperCase().startsWith(k))
      );
      setInstruments(list);
    } catch (e) {
      setInstrumentsError(e.message);
    } finally {
      setLoadingInstruments(false);
    }
  };

  const addToWatchlist = (symbol) => {
    setWatchlist((w) => (w.includes(symbol) ? w : [...w, symbol]));
  };
  const removeFromWatchlist = (symbol) => {
    setWatchlist((w) => w.filter((s) => s !== symbol));
    setMarketData((m) => {
      const next = { ...m };
      delete next[symbol];
      return next;
    });
  };

  const refreshMarketData = useCallback(async () => {
    if (!token || watchlist.length === 0) return;
    const next = {};
    for (const symbol of watchlist) {
      try {
        const res = await fetch(
          `${proxyUrl}/api/remarkets/marketdata?token=${encodeURIComponent(
            token
          )}&symbol=${encodeURIComponent(symbol)}&entries=BI,OF,LA,SE,CL`
        );
        if (!res.ok) throw new Error("bad response");
        const data = await res.json();
        next[symbol] = data.marketData || null;
      } catch (e) {
        next[symbol] = null;
      }
    }
    setPrevMarketData((prev) => {
      const p = {};
      watchlist.forEach((s) => {
        p[s] = marketData[s]?.LA?.price ?? prev[s];
      });
      return p;
    });
    setMarketData(next);
    Object.entries(next).forEach(([symbol, md]) => {
      if (!md) return;
      const priceLA = md?.LA?.price ?? null;
      const priceCL = md?.CL?.price ?? null;
      const priceSE = md?.SE?.price ?? null;
      const precio = priceLA ?? priceCL ?? priceSE ?? null;
      const etiqueta = priceLA != null ? "último operado hoy" : priceCL != null ? "cierre anterior" : priceSE != null ? "ajuste" : null;
      saveHistory({
        tipo: "grano",
        simbolo: symbol,
        etiqueta,
        precio,
        compra: md?.BI?.[0]?.price ?? null,
        venta: md?.OF?.[0]?.price ?? null,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, watchlist, proxyUrl]);

  useEffect(() => {
    if (!token || watchlist.length === 0) return;
    refreshMarketData();
    const interval = setInterval(refreshMarketData, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, watchlist.join(","), proxyUrl]);

  const inputStyle = {
    background: T.bg,
    border: `1px solid ${T.panelLine}`,
    borderRadius: 4,
    padding: "8px 10px",
    color: T.text,
    fontFamily: T.monoFont,
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  return (
    <div>
      <SectionHeader
        icon={<Server size={18} color={T.gold} />}
        title="reMarkets — futuros y opciones agropecuarios"
        note="fuente: Primary API (entorno de pruebas de A3)"
      />

      {!token ? (
        <div
          style={{
            background: T.panel,
            border: `1px solid ${T.panelLine}`,
            borderRadius: 4,
            padding: "20px 22px",
            maxWidth: 480,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: T.textDim, fontFamily: T.bodyFont, fontSize: 12 }}>
            <Lock size={14} />
            Ingresá tus credenciales de reMarkets. No se guardan en ningún lado — sólo viven en esta
            pestaña mientras la tenés abierta.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontFamily: T.bodyFont, fontSize: 11, color: T.textDim }}>
                Proxy (dejalo vacío para usar este mismo dominio)
              </label>
              <input style={inputStyle} placeholder="vacío = mismo dominio" value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} />
            </div>
            <div>
              <label style={{ fontFamily: T.bodyFont, fontSize: 11, color: T.textDim }}>Usuario</label>
              <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <label style={{ fontFamily: T.bodyFont, fontSize: 11, color: T.textDim }}>Contraseña</label>
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button
              onClick={connect}
              disabled={connecting || !username || !password}
              style={{
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: T.gold,
                color: T.bg,
                border: "none",
                borderRadius: 4,
                padding: "10px 14px",
                fontFamily: T.displayFont,
                fontSize: 13,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                cursor: connecting ? "wait" : "pointer",
                opacity: connecting || !username || !password ? 0.6 : 1,
              }}
            >
              <Unlock size={14} /> {connecting ? "Conectando..." : "Conectar"}
            </button>
          </div>

          {connError && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "rgba(181,83,60,0.12)",
                border: `1px solid ${T.rust}`,
                borderRadius: 4,
                color: T.rust,
                fontFamily: T.bodyFont,
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {connError} — si estás en localhost sin <code>wrangler pages dev</code> corriendo, las
              rutas <code>/api/remarkets/*</code> no existen todavía; una vez deployado en Cloudflare
              Pages esto funciona solo, porque el proxy vive en el mismo dominio.
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: T.green,
                fontFamily: T.bodyFont,
                fontSize: 12,
              }}
            >
              <Radio size={13} /> conectado a reMarkets
            </span>
            <button
              onClick={loadInstruments}
              disabled={loadingInstruments}
              style={{
                background: "transparent",
                border: `1px solid ${T.panelLine}`,
                color: T.text,
                borderRadius: 4,
                padding: "6px 12px",
                fontFamily: T.bodyFont,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {loadingInstruments ? "Cargando..." : "Cargar instrumentos agropecuarios"}
            </button>
            <button
              onClick={disconnect}
              style={{
                background: "transparent",
                border: `1px solid ${T.panelLine}`,
                color: T.textDim,
                borderRadius: 4,
                padding: "6px 12px",
                fontFamily: T.bodyFont,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Desconectar
            </button>
          </div>

          {instrumentsError && (
            <div style={{ color: T.rust, fontFamily: T.bodyFont, fontSize: 12, marginBottom: 12 }}>
              {instrumentsError}
            </div>
          )}

          {instruments.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Buscar símbolo (ej. SOJ, MAI, TRI, NOV26)"
                  value={instrumentFilter}
                  onChange={(e) => setInstrumentFilter(e.target.value)}
                  style={{
                    background: T.bg,
                    border: `1px solid ${T.panelLine}`,
                    borderRadius: 4,
                    padding: "8px 10px",
                    color: T.text,
                    fontFamily: T.monoFont,
                    fontSize: 12,
                    minWidth: 240,
                    flex: "1 1 240px",
                  }}
                />
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: T.bodyFont,
                    fontSize: 12,
                    color: T.textDim,
                    cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={onlyFutures} onChange={(e) => setOnlyFutures(e.target.checked)} />
                  Solo futuros (ocultar opciones)
                </label>
              </div>

              {(() => {
                const term = instrumentFilter.trim().toUpperCase();
                const filtered = instruments.filter((i) => {
                  if (term && !i.symbol.toUpperCase().includes(term)) return false;
                  if (onlyFutures && /\s(C|P)$/.test(i.symbol)) return false;
                  return true;
                });
                return (
                  <>
                    <div style={{ fontFamily: T.bodyFont, fontSize: 11, color: T.textDim, marginBottom: 8 }}>
                      {filtered.length} de {instruments.length} instrumentos — tocá uno para agregarlo al panel en vivo
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                      {filtered.map((i) => (
                        <button
                          key={i.symbol}
                          onClick={() => addToWatchlist(i.symbol)}
                          disabled={watchlist.includes(i.symbol)}
                          style={{
                            background: watchlist.includes(i.symbol) ? T.panelLine : T.panel,
                            border: `1px solid ${T.panelLine}`,
                            color: watchlist.includes(i.symbol) ? T.textDim : T.text,
                            borderRadius: 4,
                            padding: "6px 10px",
                            fontFamily: T.monoFont,
                            fontSize: 12,
                            cursor: watchlist.includes(i.symbol) ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {!watchlist.includes(i.symbol) && <Plus size={11} />}
                          {i.symbol}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {watchlist.length === 0 ? (
            <div
              style={{
                background: T.panel,
                border: `1px dashed ${T.panelLine}`,
                borderRadius: 4,
                padding: "18px 20px",
                color: T.textDim,
                fontFamily: T.bodyFont,
                fontSize: 13,
              }}
            >
              Cargá los instrumentos y elegí las posiciones de soja, maíz o trigo que querés seguir en vivo.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {watchlist.map((symbol) => {
                const md = marketData[symbol];
                const priceLA = md?.LA?.price ?? null;
                const priceCL = md?.CL?.price ?? null;
                const priceSE = md?.SE?.price ?? null;
                const last = priceLA ?? priceCL ?? priceSE ?? null;
                const priceLabel =
                  priceLA != null
                    ? "último operado hoy"
                    : priceCL != null
                    ? "cierre anterior"
                    : priceSE != null
                    ? "ajuste"
                    : "sin operaciones";
                const bid = md?.BI?.[0]?.price ?? null;
                const offer = md?.OF?.[0]?.price ?? null;
                const prefix = symbol.slice(0, 3).toUpperCase();
                const accent =
                  prefix === "SOJ" ? T.green : prefix === "MAI" ? T.gold : prefix === "TRI" ? "#C97B4A" : T.blue;
                return (
                  <div
                    key={symbol}
                    style={{
                      background: T.panel,
                      border: `1px solid ${T.panelLine}`,
                      borderRadius: 4,
                      padding: "14px 16px",
                      minWidth: 200,
                      flex: "1 1 200px",
                      position: "relative",
                    }}
                  >
                    <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accent }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: T.displayFont, fontSize: 14, color: T.text, letterSpacing: "0.5px" }}>
                        {symbol}
                      </span>
                      <button
                        onClick={() => removeFromWatchlist(symbol)}
                        style={{ background: "transparent", border: "none", color: T.textDim, cursor: "pointer", padding: 2 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <FlapValue value={last != null ? fmtARS(last) : "—"} size={22} color={accent} />
                      <span style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginLeft: 6 }}>
                        USD/ton ({priceLabel})
                      </span>
                    </div>
                    <div style={{ marginTop: 6, display: "flex", gap: 12, fontFamily: T.monoFont, fontSize: 11, color: T.textDim }}>
                      <span>compra {bid != null ? fmtARS(bid) : "—"}</span>
                      <span>venta {offer != null ? fmtARS(offer) : "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Historial — buscador de cotizaciones guardadas
// ---------------------------------------------------------------------------
function HistorialPanel() {
  const [simbolo, setSimbolo] = useState("");
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const buscar = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (simbolo) params.set("simbolo", simbolo);
      if (tipo) params.set("tipo", tipo);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      params.set("limit", "300");

      const res = await fetch(`/api/history/query?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error consultando el historial");
      setResults(data.results || []);
      setSearched(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: T.bg,
    border: `1px solid ${T.panelLine}`,
    borderRadius: 4,
    padding: "8px 10px",
    color: T.text,
    fontFamily: T.monoFont,
    fontSize: 12,
  };

  const fmtFecha = (iso) => {
    try {
      return new Date(iso).toLocaleString("es-AR");
    } catch {
      return iso;
    }
  };

  return (
    <div>
      <SectionHeader
        icon={<Radio size={18} color={T.blue} />}
        title="Historial de cotizaciones"
        note="cada precio que pasa por el panel queda guardado acá"
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <div>
          <label style={{ display: "block", fontFamily: T.bodyFont, fontSize: 11, color: T.textDim, marginBottom: 4 }}>
            Símbolo
          </label>
          <input
            style={inputStyle}
            placeholder="ej. blue, SOJ.ROS"
            value={simbolo}
            onChange={(e) => setSimbolo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
          />
        </div>
        <div>
          <label style={{ display: "block", fontFamily: T.bodyFont, fontSize: 11, color: T.textDim, marginBottom: 4 }}>
            Tipo
          </label>
          <select style={inputStyle} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="dolar">Dólar</option>
            <option value="grano">Grano</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontFamily: T.bodyFont, fontSize: 11, color: T.textDim, marginBottom: 4 }}>
            Desde
          </label>
          <input type="date" style={inputStyle} value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", fontFamily: T.bodyFont, fontSize: 11, color: T.textDim, marginBottom: 4 }}>
            Hasta
          </label>
          <input type="date" style={inputStyle} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <button
          onClick={buscar}
          disabled={loading}
          style={{
            background: T.gold,
            border: "none",
            borderRadius: 4,
            padding: "9px 18px",
            color: T.bg,
            fontFamily: T.displayFont,
            fontWeight: 600,
            fontSize: 12.5,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {error && (
        <div style={{ color: T.rust, fontFamily: T.bodyFont, fontSize: 12.5, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {searched && !error && results.length === 0 && (
        <p style={{ fontFamily: T.bodyFont, fontSize: 12.5, color: T.textDim }}>
          No se encontraron registros con esos filtros.
        </p>
      )}

      {results.length > 0 && (
        <div style={{ overflowX: "auto", border: `1px solid ${T.panelLine}`, borderRadius: 4 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.monoFont, fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.panel, textAlign: "left" }}>
                {["Fecha/hora", "Tipo", "Símbolo", "Precio", "Compra", "Venta", "Detalle"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 10px",
                      color: T.textDim,
                      fontFamily: T.bodyFont,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      borderBottom: `1px solid ${T.panelLine}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${T.panelLine}` }}>
                  <td style={{ padding: "7px 10px", color: T.textDim }}>{fmtFecha(r.fecha_hora)}</td>
                  <td style={{ padding: "7px 10px", color: T.textDim }}>{r.tipo}</td>
                  <td style={{ padding: "7px 10px", color: T.text }}>{r.simbolo}</td>
                  <td style={{ padding: "7px 10px", color: T.gold }}>{r.precio != null ? fmtARS(r.precio) : "—"}</td>
                  <td style={{ padding: "7px 10px", color: T.textDim }}>{r.compra != null ? fmtARS(r.compra) : "—"}</td>
                  <td style={{ padding: "7px 10px", color: T.textDim }}>{r.venta != null ? fmtARS(r.venta) : "—"}</td>
                  <td style={{ padding: "7px 10px", color: T.textDim }}>{r.etiqueta || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
const REFRESH_MS = 30000;

const GRANOS = [
  { symbol: "I.SOJA", label: "Soja", accent: T.green },
  { symbol: "I.MAIZ", label: "Maíz", accent: T.gold },
  { symbol: "I.TRIGO", label: "Trigo", accent: "#C97B4A" },
];

export default function PanelAgro() {
  useFonts();

  const [dolares, setDolares] = useState({});
  const [dolaresPrev, setDolaresPrev] = useState({});
  const [dolaresLoading, setDolaresLoading] = useState(true);
  const [dolaresError, setDolaresError] = useState(false);

  const [granos, setGranos] = useState({});
  const [granosPrev, setGranosPrev] = useState({});
  const [granosLoading, setGranosLoading] = useState(true);
  const [granosErrorAll, setGranosErrorAll] = useState(false);

  const [lastUpdate, setLastUpdate] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);

  const fetchDolares = useCallback(async () => {
    try {
      const res = await fetch("https://dolarapi.com/v1/dolares");
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      const map = {};
      data.forEach((d) => {
        map[d.casa] = d;
      });
      setDolaresPrev((prevMap) => {
        const next = {};
        Object.keys(map).forEach((k) => {
          next[k] = dolares[k]?.venta ?? prevMap[k];
        });
        return next;
      });
      setDolares(map);
      Object.entries(map).forEach(([casa, d]) => {
        saveHistory({ tipo: "dolar", simbolo: casa, compra: d.compra, venta: d.venta, precio: d.venta });
      });
      setDolaresError(false);
    } catch (e) {
      setDolaresError(true);
    } finally {
      setDolaresLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dolares]);

  const fetchGranos = useCallback(async () => {
    const results = {};
    let anyOk = false;
    for (const g of GRANOS) {
      try {
        const res = await fetch(`https://api.matbarofex.com.ar/v2/symbol/${g.symbol}`);
        if (!res.ok) throw new Error("bad response");
        const data = await res.json();
        results[g.symbol] = data;
        anyOk = true;
      } catch (e) {
        results[g.symbol] = null;
      }
    }
    setGranosPrev((prevMap) => {
      const next = {};
      GRANOS.forEach((g) => {
        next[g.symbol] = granos[g.symbol]?.indexValue ?? prevMap[g.symbol];
      });
      return next;
    });
    setGranos(results);
    setGranosErrorAll(!anyOk);
    setGranosLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granos]);

  const refreshAll = useCallback(() => {
    fetchDolares();
    fetchGranos();
    setLastUpdate(new Date());
    setCountdown(REFRESH_MS / 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const oficial = dolares.oficial;
  const blue = dolares.blue;
  const mayorista = dolares.mayorista;
  const mep = dolares.bolsa;
  const ccl = dolares.contadoconliqui;

  return (
    <div
      style={{
        background: T.bg,
        minHeight: "100%",
        padding: "28px 24px 40px",
        fontFamily: T.bodyFont,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Wheat size={26} color={T.gold} />
            <h1
              style={{
                fontFamily: T.displayFont,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "1px",
                color: T.text,
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              Pizarra de Rueda
            </h1>
          </div>
          <p style={{ fontFamily: T.bodyFont, fontSize: 13, color: T.textDim, margin: "4px 0 0 36px" }}>
            Dólares y futuros agropecuarios en vivo — panel base del sistema de márgenes
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.textDim, fontSize: 12, fontFamily: T.monoFont }}>
            <Radio size={13} color={T.green} style={{ animation: "pulse 2s infinite" }} />
            próxima act. en {countdown}s
          </div>
          <button
            onClick={refreshAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: `1px solid ${T.panelLine}`,
              color: T.text,
              borderRadius: 4,
              padding: "8px 14px",
              fontFamily: T.bodyFont,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>
      </div>

      {lastUpdate && (
        <div style={{ fontFamily: T.monoFont, fontSize: 11, color: T.textDim, marginTop: 8 }}>
          última lectura: {lastUpdate.toLocaleTimeString("es-AR")}
        </div>
      )}

      {/* DÓLARES */}
      <SectionHeader icon={<DollarSign size={18} color={T.blue} />} title="Dólares" note="fuente: dolarapi.com" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <QuoteCard label="Minorista (oficial)" buy={oficial?.compra} sell={oficial?.venta} prevSell={dolaresPrev.oficial} accent={T.blue} loading={dolaresLoading} error={dolaresError} />
        <QuoteCard label="Mayorista" buy={mayorista?.compra} sell={mayorista?.venta} prevSell={dolaresPrev.mayorista} accent={T.blue} loading={dolaresLoading} error={dolaresError} />
        <QuoteCard label="Blue" buy={blue?.compra} sell={blue?.venta} prevSell={dolaresPrev.blue} accent={T.gold} loading={dolaresLoading} error={dolaresError} />
        <QuoteCard label="MEP" buy={mep?.compra} sell={mep?.venta} prevSell={dolaresPrev.bolsa} accent={T.green} loading={dolaresLoading} error={dolaresError} />
        <QuoteCard label="CCL" buy={ccl?.compra} sell={ccl?.venta} prevSell={dolaresPrev.contadoconliqui} accent={T.rust} loading={dolaresLoading} error={dolaresError} />
      </div>

      {/* GRANOS - índices públicos */}
      <SectionHeader icon={<TrendingUp size={18} color={T.green} />} title="Futuros agropecuarios — índices continuos" note="fuente: A3 Mercados (ex Matba Rofex)" />
      {granosErrorAll && (
        <div style={{ background: T.panel, border: `1px solid ${T.rust}`, borderRadius: 4, padding: "12px 16px", marginBottom: 14, color: T.rust, fontFamily: T.bodyFont, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
          <AlertCircle size={16} />
          No se pudo conectar con la API pública de A3 desde este panel (puede requerir backend en vez de navegador).
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {GRANOS.map((g) => {
          const d = granos[g.symbol];
          return (
            <QuoteCard
              key={g.symbol}
              label={g.label}
              sublabel={d?.maturityDate ? `venc. ${d.maturityDate}` : "índice continuo (USD/ton)"}
              sell={d?.indexValue}
              prevSell={granosPrev[g.symbol]}
              accent={g.accent}
              loading={granosLoading}
              error={!granosLoading && !d}
            />
          );
        })}
      </div>

      {/* REMARKETS - futuros por posición y (a futuro) opciones */}
      <RemarketsPanel />

      <HistorialPanel />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
