import { useState, useEffect, useCallback } from "react";
import { AlertCircle, Plus, X, Wheat, Lock, Unlock } from "lucide-react";
import { T, fmtARS, SectionHeader } from "./theme.jsx";
import { useRemarkets, resolvePrice } from "./RemarketsContext.jsx";

const CULTIVOS_PRESET = [
  "Soja 1°",
  "Maíz 1°",
  "Sorgo",
  "Trigo",
  "Soja 2°",
  "Trigo/Soja 2°",
  "Maíz 2°",
  "Trigo/Maíz 2°",
];

const inputStyle = {
  background: T.bg,
  border: `1px solid ${T.panelLine}`,
  borderRadius: 4,
  padding: "7px 9px",
  color: T.text,
  fontFamily: T.monoFont,
  fontSize: 12.5,
  outline: "none",
};

const btnGhost = {
  background: "transparent",
  border: `1px solid ${T.panelLine}`,
  color: T.text,
  borderRadius: 4,
  padding: "7px 12px",
  fontFamily: T.bodyFont,
  fontSize: 12,
  cursor: "pointer",
};

const btnGold = {
  background: T.gold,
  border: "none",
  color: T.bg,
  borderRadius: 4,
  padding: "8px 14px",
  fontFamily: T.displayFont,
  fontWeight: 600,
  fontSize: 12,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  cursor: "pointer",
};

async function apiGet(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error de red");
  return data;
}
async function apiSend(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error de red");
  return data;
}

// ---------------------------------------------------------------------------
// Selector de símbolo (futuro/dispo) con buscador, muestra congelado + vivo
// ---------------------------------------------------------------------------
function SymbolPicker({ label, symbol, congelado, live, disabled, onPick }) {
  const { instruments, loadingInstruments, loadInstruments, token } = useRemarkets();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const results = term.trim()
    ? instruments.filter((i) => i.symbol.toUpperCase().includes(term.trim().toUpperCase())).slice(0, 30)
    : [];

  const delta = live != null && congelado != null ? live - congelado : null;

  return (
    <div style={{ position: "relative", minWidth: 200 }}>
      {label && (
        <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginBottom: 3 }}>{label}</div>
      )}
      {disabled ? (
        <div style={{ ...inputStyle, color: T.textDim, cursor: "default" }}>
          {symbol || "—"} <span style={{ color: T.textDim }}>(= soja de referencia)</span>
        </div>
      ) : (
        <>
          <button
            onClick={() => {
              setOpen((o) => !o);
              if (instruments.length === 0 && token) loadInstruments();
            }}
            style={{
              ...inputStyle,
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{symbol || "elegir símbolo…"}</span>
          </button>
          {open && (
            <div
              style={{
                position: "absolute",
                zIndex: 20,
                top: "100%",
                left: 0,
                right: 0,
                background: T.panel,
                border: `1px solid ${T.panelLine}`,
                borderRadius: 4,
                padding: 8,
                marginTop: 4,
                maxHeight: 260,
                overflowY: "auto",
              }}
            >
              <input
                autoFocus
                placeholder={loadingInstruments ? "Cargando instrumentos…" : "Buscar (ej. SOJ, TRI, MAY27)"}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                style={{ ...inputStyle, width: "100%", marginBottom: 6 }}
              />
              {results.map((i) => (
                <div
                  key={i.symbol}
                  onClick={() => {
                    onPick(i.symbol);
                    setOpen(false);
                    setTerm("");
                  }}
                  style={{
                    padding: "5px 6px",
                    fontFamily: T.monoFont,
                    fontSize: 12,
                    color: T.text,
                    cursor: "pointer",
                    borderRadius: 3,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.panelLine)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {i.symbol}
                </div>
              ))}
              {term.trim() && results.length === 0 && (
                <div style={{ color: T.textDim, fontFamily: T.bodyFont, fontSize: 11, padding: 6 }}>
                  Sin coincidencias
                </div>
              )}
              <button onClick={() => setOpen(false)} style={{ ...btnGhost, width: "100%", marginTop: 6 }}>
                Cerrar
              </button>
            </div>
          )}
        </>
      )}
      <div style={{ fontFamily: T.monoFont, fontSize: 11, marginTop: 4, display: "flex", gap: 8 }}>
        <span style={{ color: T.gold }}>congelado: {congelado != null ? fmtARS(congelado) : "—"}</span>
        {live != null && (
          <span style={{ color: delta > 0 ? T.green : delta < 0 ? T.rust : T.textDim }}>
            vivo: {fmtARS(live)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal del módulo de Presupuesto
// ---------------------------------------------------------------------------
export default function Presupuesto() {
  const { token, username, setUsername, password, setPassword, connecting, connError, connect, fetchQuote } =
    useRemarkets();

  const [campos, setCampos] = useState([]);
  const [campoId, setCampoId] = useState(null);
  const [nuevoCampo, setNuevoCampo] = useState("");

  const [presupuestos, setPresupuestos] = useState([]);
  const [presupuestoId, setPresupuestoId] = useState(null);
  const [nuevaCampania, setNuevaCampania] = useState("25-26");

  const [detalle, setDetalle] = useState(null); // { presupuesto, partidas }
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [liveQuotes, setLiveQuotes] = useState({}); // symbol -> precio USD/ton
  const [dolarMayoristaCompra, setDolarMayoristaCompra] = useState(null);
  const [sojaDispoPesos, setSojaDispoPesos] = useState(null);

  const [nuevoCultivo, setNuevoCultivo] = useState(CULTIVOS_PRESET[0]);

  // --- carga inicial de campos ---
  useEffect(() => {
    apiGet("/api/campos")
      .then((d) => setCampos(d.campos || []))
      .catch((e) => setError(e.message));
  }, []);

  // --- presupuestos del campo elegido ---
  useEffect(() => {
    if (!campoId) {
      setPresupuestos([]);
      setPresupuestoId(null);
      return;
    }
    apiGet(`/api/presupuestos?campo_id=${campoId}`)
      .then((d) => {
        setPresupuestos(d.presupuestos || []);
        setPresupuestoId(d.presupuestos?.[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, [campoId]);

  // --- detalle del presupuesto elegido ---
  const cargarDetalle = useCallback(() => {
    if (!presupuestoId) {
      setDetalle(null);
      return;
    }
    setLoading(true);
    apiGet(`/api/presupuestos/${presupuestoId}`)
      .then((d) => setDetalle(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [presupuestoId]);

  useEffect(() => {
    cargarDetalle();
  }, [cargarDetalle]);

  // --- dólar mayorista (para convertir soja dispo de pesos a USD) ---
  useEffect(() => {
    const load = () => {
      fetch("https://dolarapi.com/v1/dolares/mayorista")
        .then((r) => r.json())
        .then((d) => setDolarMayoristaCompra(d.compra))
        .catch(() => {});
    };
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  // --- soja dispo (en vivo, pesos) + precios vivos de todos los símbolos en uso ---
  useEffect(() => {
    if (!token) return;
    const refrescar = async () => {
      const dispo = await fetchQuote("SOJ.ROS.P/DISPO");
      const { precio } = resolvePrice(dispo);
      setSojaDispoPesos(precio);

      const symbols = new Set();
      if (detalle?.presupuesto?.soja_ref_symbol) symbols.add(detalle.presupuesto.soja_ref_symbol);
      (detalle?.partidas || []).forEach((p) => {
        if (p.precio_symbol) symbols.add(p.precio_symbol);
      });

      const next = {};
      for (const s of symbols) {
        const md = await fetchQuote(s);
        next[s] = resolvePrice(md).precio;
      }
      setLiveQuotes(next);
    };
    refrescar();
    const i = setInterval(refrescar, 30000);
    return () => clearInterval(i);
  }, [token, fetchQuote, detalle?.presupuesto?.soja_ref_symbol, detalle?.partidas]);

  // --- acciones ---
  const crearCampo = async () => {
    if (!nuevoCampo.trim()) return;
    try {
      const c = await apiSend("/api/campos", "POST", { nombre: nuevoCampo.trim() });
      setCampos((prev) => [...prev, c].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setCampoId(c.id);
      setNuevoCampo("");
    } catch (e) {
      setError(e.message);
    }
  };

  const crearPresupuesto = async () => {
    if (!campoId || !nuevaCampania.trim()) return;
    try {
      const p = await apiSend("/api/presupuestos", "POST", {
        campo_id: campoId,
        campania: nuevaCampania.trim(),
        arrendamiento_qq_ha: 10,
      });
      setPresupuestos((prev) => [p, ...prev]);
      setPresupuestoId(p.id);
    } catch (e) {
      setError(e.message);
    }
  };

  const actualizarArrendamiento = async (valor) => {
    setDetalle((d) => ({ ...d, presupuesto: { ...d.presupuesto, arrendamiento_qq_ha: valor } }));
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}`, "PUT", { arrendamiento_qq_ha: valor });
    } catch (e) {
      setError(e.message);
    }
  };

  const elegirSojaRef = async (symbol) => {
    const md = await fetchQuote(symbol);
    const { precio } = resolvePrice(md);
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}`, "PUT", { soja_ref_symbol: symbol, soja_ref_precio: precio });
      cargarDetalle();
    } catch (e) {
      setError(e.message);
    }
  };

  const elegirPrecioPartida = async (partidaId, symbol) => {
    const md = await fetchQuote(symbol);
    const { precio } = resolvePrice(md);
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}/partidas/${partidaId}`, "PUT", {
        precio_symbol: symbol,
        precio_congelado: precio,
      });
      cargarDetalle();
    } catch (e) {
      setError(e.message);
    }
  };

  const actualizarPartidaCampo = async (partidaId, campo, valor) => {
    setDetalle((d) => ({
      ...d,
      partidas: d.partidas.map((p) => (p.id === partidaId ? { ...p, [campo]: valor } : p)),
    }));
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}/partidas/${partidaId}`, "PUT", { [campo]: valor });
    } catch (e) {
      setError(e.message);
    }
  };

  const agregarPartida = async () => {
    if (!nuevoCultivo) return;
    const esSoja = nuevoCultivo.toLowerCase().includes("soja");
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}/partidas`, "POST", {
        cultivo: nuevoCultivo,
        es_soja: esSoja,
        orden: (detalle?.partidas?.length || 0) + 1,
        superficie_ha: 0,
        rendimiento_qq_ha: 0,
      });
      cargarDetalle();
    } catch (e) {
      setError(e.message);
    }
  };

  const borrarPartida = async (partidaId) => {
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}/partidas/${partidaId}`, "DELETE");
      cargarDetalle();
    } catch (e) {
      setError(e.message);
    }
  };

  // --- cálculos derivados ---
  const sojaRefPrecio = detalle?.presupuesto?.soja_ref_precio ?? null;
  const sojaDispoUsd =
    sojaDispoPesos != null && dolarMayoristaCompra ? sojaDispoPesos / dolarMayoristaCompra : null;
  const valorRentaUsdTon =
    sojaRefPrecio != null && sojaDispoUsd != null ? (sojaRefPrecio + sojaDispoUsd) / 2 : null;
  const arrendamientoQqHa = detalle?.presupuesto?.arrendamiento_qq_ha ?? 10;
  const valorRentaUsdHa = valorRentaUsdTon != null ? valorRentaUsdTon * (arrendamientoQqHa / 10) : null;

  const partidaTrigo = detalle?.partidas?.find((p) => p.cultivo.trim().toLowerCase() === "trigo");
  const precioTrigo = partidaTrigo?.precio_congelado ?? null;
  const qqTrigoEquivalente =
    valorRentaUsdHa != null && precioTrigo ? (valorRentaUsdHa / precioTrigo) * 10 : null;

  const partidasConCalculos = (detalle?.partidas || []).map((p) => {
    const precioFinal = p.es_soja ? sojaRefPrecio : p.precio_congelado;
    const toneladas =
      p.superficie_ha != null && p.rendimiento_qq_ha != null ? (p.superficie_ha * p.rendimiento_qq_ha) / 10 : null;
    return { ...p, precioFinal, toneladas };
  });

  const totalHa = partidasConCalculos.reduce((acc, p) => acc + (Number(p.superficie_ha) || 0), 0);
  const totalTon = partidasConCalculos.reduce((acc, p) => acc + (p.toneladas || 0), 0);

  const cultivosDisponibles = CULTIVOS_PRESET.filter(
    (c) => !(detalle?.partidas || []).some((p) => p.cultivo === c)
  );

  return (
    <div style={{ padding: "20px 24px 60px" }}>
      <SectionHeader icon={<Wheat size={20} color={T.gold} />} title="Presupuesto agrícola" note="proyectado" />

      {!token && (
        <div
          style={{
            background: T.panel,
            border: `1px solid ${T.panelLine}`,
            borderRadius: 4,
            padding: "16px 18px",
            marginBottom: 20,
            maxWidth: 460,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: T.textDim, fontFamily: T.bodyFont, fontSize: 12, marginBottom: 10 }}>
            <Lock size={13} /> Conectate a reMarkets para poder elegir precios de futuros acá también.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input style={inputStyle} placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input
              style={inputStyle}
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button style={btnGold} onClick={connect} disabled={connecting}>
              <Unlock size={12} style={{ marginRight: 4 }} />
              {connecting ? "Conectando…" : "Conectar"}
            </button>
          </div>
          {connError && <div style={{ color: T.rust, fontSize: 11.5, marginTop: 8, fontFamily: T.bodyFont }}>{connError}</div>}
        </div>
      )}

      {/* Selector de campo */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: T.bodyFont, fontSize: 11, color: T.textDim, marginBottom: 4 }}>Campo</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select style={inputStyle} value={campoId ?? ""} onChange={(e) => setCampoId(Number(e.target.value) || null)}>
              <option value="">Elegir…</option>
              {campos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <input style={inputStyle} placeholder="Nuevo campo" value={nuevoCampo} onChange={(e) => setNuevoCampo(e.target.value)} />
            <button style={btnGhost} onClick={crearCampo}>
              <Plus size={12} />
            </button>
          </div>
        </div>

        {campoId && (
          <div>
            <div style={{ fontFamily: T.bodyFont, fontSize: 11, color: T.textDim, marginBottom: 4 }}>Campaña</div>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                style={inputStyle}
                value={presupuestoId ?? ""}
                onChange={(e) => setPresupuestoId(Number(e.target.value) || null)}
              >
                <option value="">Elegir…</option>
                {presupuestos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.campania}
                  </option>
                ))}
              </select>
              <input style={inputStyle} placeholder="ej. 26-27" value={nuevaCampania} onChange={(e) => setNuevaCampania(e.target.value)} />
              <button style={btnGhost} onClick={crearPresupuesto}>
                <Plus size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: T.rust, display: "flex", gap: 8, alignItems: "center", fontFamily: T.bodyFont, fontSize: 12.5, marginBottom: 16 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading && <p style={{ color: T.textDim, fontFamily: T.bodyFont, fontSize: 13 }}>Cargando…</p>}

      {detalle && (
        <>
          {/* Encabezado: arrendamiento + soja de referencia + soja dispo + valor renta */}
          <div
            style={{
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              background: T.panel,
              border: `1px solid ${T.panelLine}`,
              borderRadius: 4,
              padding: "16px 18px",
              marginBottom: 24,
            }}
          >
            <div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginBottom: 3 }}>
                Arrendamiento (qq/ha, sobre total sembrado)
              </div>
              <input
                type="number"
                style={{ ...inputStyle, width: 90 }}
                value={arrendamientoQqHa}
                onChange={(e) => actualizarArrendamiento(Number(e.target.value))}
              />
            </div>

            <SymbolPicker
              label="Soja de referencia (May 26)"
              symbol={detalle.presupuesto.soja_ref_symbol}
              congelado={sojaRefPrecio}
              live={detalle.presupuesto.soja_ref_symbol ? liveQuotes[detalle.presupuesto.soja_ref_symbol] : null}
              onPick={elegirSojaRef}
            />

            <div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginBottom: 3 }}>
                Soja dispo Rosario (USD/ton)
              </div>
              <div style={{ ...inputStyle, cursor: "default" }}>{sojaDispoUsd != null ? fmtARS(sojaDispoUsd) : "—"}</div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginTop: 3 }}>
                {sojaDispoPesos != null ? `$${fmtARS(sojaDispoPesos)} / mayorista compra $${fmtARS(dolarMayoristaCompra)}` : "sin datos"}
              </div>
            </div>

            <div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginBottom: 3 }}>
                Valor renta (USD/ha)
              </div>
              <div style={{ ...inputStyle, cursor: "default", color: T.gold, fontWeight: 700 }}>
                {valorRentaUsdHa != null ? fmtARS(valorRentaUsdHa) : "—"}
              </div>
            </div>

            <div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginBottom: 3 }}>
                Equivalente en trigo (qq)
              </div>
              <div style={{ ...inputStyle, cursor: "default", color: T.gold, fontWeight: 700 }}>
                {qqTrigoEquivalente != null ? qqTrigoEquivalente.toFixed(1) : "— (elegí precio de Trigo)"}
              </div>
            </div>
          </div>

          {/* Tabla de partidas */}
          <div style={{ overflowX: "auto", border: `1px solid ${T.panelLine}`, borderRadius: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.monoFont, fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: T.panel, textAlign: "left" }}>
                  {["Cultivo", "Superficie (ha)", "Precio final de venta (USD/ton)", "Rendimiento (qq/ha)", "Toneladas", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 10px",
                        color: T.textDim,
                        fontFamily: T.bodyFont,
                        fontSize: 10.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                        borderBottom: `1px solid ${T.panelLine}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partidasConCalculos.map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${T.panelLine}` }}>
                    <td style={{ padding: "8px 10px", color: T.text }}>{p.cultivo}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <input
                        type="number"
                        style={{ ...inputStyle, width: 80 }}
                        value={p.superficie_ha ?? 0}
                        onChange={(e) => actualizarPartidaCampo(p.id, "superficie_ha", Number(e.target.value))}
                      />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <SymbolPicker
                        symbol={p.es_soja ? detalle.presupuesto.soja_ref_symbol : p.precio_symbol}
                        congelado={p.precioFinal}
                        live={p.precio_symbol ? liveQuotes[p.precio_symbol] : null}
                        disabled={!!p.es_soja}
                        onPick={(symbol) => elegirPrecioPartida(p.id, symbol)}
                      />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input
                        type="number"
                        style={{ ...inputStyle, width: 80 }}
                        value={p.rendimiento_qq_ha ?? 0}
                        onChange={(e) => actualizarPartidaCampo(p.id, "rendimiento_qq_ha", Number(e.target.value))}
                      />
                    </td>
                    <td style={{ padding: "8px 10px", color: T.gold }}>
                      {p.toneladas != null ? p.toneladas.toFixed(1) : "—"}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <button onClick={() => borrarPartida(p.id)} style={{ background: "transparent", border: "none", color: T.textDim, cursor: "pointer" }}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: "8px 10px", color: T.text, fontWeight: 700 }}>Totales</td>
                  <td style={{ padding: "8px 10px", color: T.gold, fontWeight: 700 }}>{totalHa.toFixed(1)}</td>
                  <td />
                  <td />
                  <td style={{ padding: "8px 10px", color: T.gold, fontWeight: 700 }}>{totalTon.toFixed(1)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Agregar cultivo */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            <select style={inputStyle} value={nuevoCultivo} onChange={(e) => setNuevoCultivo(e.target.value)}>
              {cultivosDisponibles.length > 0 ? (
                cultivosDisponibles.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              ) : (
                <option value="">Todos los cultivos preestablecidos ya están cargados</option>
              )}
            </select>
            <button style={btnGhost} onClick={agregarPartida} disabled={cultivosDisponibles.length === 0}>
              <Plus size={12} style={{ marginRight: 4 }} /> Agregar cultivo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
