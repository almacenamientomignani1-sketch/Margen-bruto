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

const UNIDADES = {
  ton: { label: "USD/ton", corto: "ton", factor: 1, decimales: 2 },
  qq: { label: "USD/qq", corto: "qq", factor: 1 / 10, decimales: 2 },
  kg: { label: "USD/kg", corto: "kg", factor: 1 / 1000, decimales: 4 },
};

// Convierte un precio canónico (siempre guardado en USD/ton) a la unidad elegida para mostrar.
function convertirPrecio(usdPorTon, unidad) {
  if (usdPorTon == null) return null;
  return usdPorTon * (UNIDADES[unidad]?.factor ?? 1);
}
// Convierte un valor que el usuario tipeó en la unidad elegida, de vuelta a USD/ton para guardar.
function aTonelada(valorEnUnidad, unidad) {
  if (valorEnUnidad == null || valorEnUnidad === "") return null;
  const factor = UNIDADES[unidad]?.factor ?? 1;
  return Number(valorEnUnidad) / factor;
}
function fmtPrecio(usdPorTon, unidad) {
  const v = convertirPrecio(usdPorTon, unidad);
  if (v == null) return "—";
  const dec = UNIDADES[unidad]?.decimales ?? 2;
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
}

function efectivo(modo, autoVal, manualVal) {
  return modo === "manual" ? manualVal ?? null : autoVal ?? null;
}

// ---------------------------------------------------------------------------
// Toggle chico Automático / Manual
// ---------------------------------------------------------------------------
function ModoToggle({ modo, onChange }) {
  const btn = (activo) => ({
    background: activo ? T.gold : "transparent",
    color: activo ? T.bg : T.textDim,
    border: `1px solid ${activo ? T.gold : T.panelLine}`,
    borderRadius: 3,
    padding: "2px 8px",
    fontFamily: T.bodyFont,
    fontSize: 9.5,
    letterSpacing: "0.3px",
    textTransform: "uppercase",
    cursor: "pointer",
  });
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
      <button style={btn(modo !== "manual")} onClick={() => onChange("auto")}>
        Automático
      </button>
      <button style={btn(modo === "manual")} onClick={() => onChange("manual")}>
        Manual
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selector de símbolo (futuro/dispo) con buscador, muestra congelado + vivo
// ---------------------------------------------------------------------------
function SymbolPicker({ label, symbol, congelado, live, disabled, onPick, modo, onModoChange, manualValor, onManualChange, unidad = "ton" }) {
  const { instruments, loadingInstruments, loadInstruments, token } = useRemarkets();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [manualTexto, setManualTexto] = useState("");

  useEffect(() => {
    setManualTexto(manualValor != null ? convertirPrecio(manualValor, unidad).toFixed(UNIDADES[unidad].decimales) : "");
  }, [manualValor, unidad]);

  const results = term.trim()
    ? instruments.filter((i) => i.symbol.toUpperCase().includes(term.trim().toUpperCase())).slice(0, 30)
    : [];

  const delta = live != null && congelado != null ? live - congelado : null;
  const esManual = modo === "manual";

  return (
    <div style={{ position: "relative", minWidth: 200 }}>
      {label && (
        <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginBottom: 3 }}>{label}</div>
      )}

      {!disabled && onModoChange && <ModoToggle modo={modo} onChange={onModoChange} />}

      {disabled ? (
        <div
          style={{
            ...inputStyle,
            cursor: "default",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 2,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: T.gold }}>{fmtPrecio(congelado, unidad)}</span>
          {symbol && <span style={{ fontSize: 10, color: T.textDim }}>{symbol}</span>}
        </div>
      ) : esManual ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            step="any"
            style={{ ...inputStyle, width: 110, fontSize: 15, fontWeight: 700, color: T.gold }}
            value={manualTexto}
            onChange={(e) => setManualTexto(e.target.value)}
            onBlur={() => onManualChange(aTonelada(manualTexto, unidad))}
            placeholder={`en ${UNIDADES[unidad].corto}`}
          />
          <span style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim }}>{UNIDADES[unidad].corto}</span>
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
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 2,
            }}
          >
            {congelado != null ? (
              <>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.gold }}>{fmtPrecio(congelado, unidad)}</span>
                <span style={{ fontSize: 10, color: T.textDim }}>{symbol}</span>
              </>
            ) : (
              <span style={{ color: T.textDim }}>elegir símbolo…</span>
            )}
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
      {!esManual && live != null && (
        <div style={{ fontFamily: T.monoFont, fontSize: 11, marginTop: 4 }}>
          <span style={{ color: delta > 0 ? T.green : delta < 0 ? T.rust : T.textDim }}>
            vivo: {fmtPrecio(live, unidad)}
          </span>
        </div>
      )}
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
  const [unidad, setUnidad] = useState("ton");

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

  useEffect(() => {
    if (detalle?.presupuesto?.unidad) setUnidad(detalle.presupuesto.unidad);
  }, [detalle?.presupuesto?.id]);

  const cambiarUnidad = async (u) => {
    setUnidad(u);
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}`, "PUT", { unidad: u });
    } catch (e) {
      setError(e.message);
    }
  };

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

  const cambiarSojaRefModo = async (modo) => {
    setDetalle((d) => ({ ...d, presupuesto: { ...d.presupuesto, soja_ref_modo: modo } }));
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}`, "PUT", { soja_ref_modo: modo });
    } catch (e) {
      setError(e.message);
    }
  };

  const actualizarSojaRefManual = async (valorTon) => {
    setDetalle((d) => ({ ...d, presupuesto: { ...d.presupuesto, soja_ref_manual: valorTon } }));
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}`, "PUT", { soja_ref_manual: valorTon });
    } catch (e) {
      setError(e.message);
    }
  };

  const cambiarSojaDispoModo = async (modo) => {
    setDetalle((d) => ({ ...d, presupuesto: { ...d.presupuesto, soja_dispo_modo: modo } }));
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}`, "PUT", { soja_dispo_modo: modo });
    } catch (e) {
      setError(e.message);
    }
  };

  const actualizarSojaDispoManual = async (valorTon) => {
    setDetalle((d) => ({ ...d, presupuesto: { ...d.presupuesto, soja_dispo_manual: valorTon } }));
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}`, "PUT", { soja_dispo_manual: valorTon });
    } catch (e) {
      setError(e.message);
    }
  };

  const cambiarPrecioModoPartida = async (partidaId, modo) => {
    setDetalle((d) => ({
      ...d,
      partidas: d.partidas.map((p) => (p.id === partidaId ? { ...p, precio_modo: modo } : p)),
    }));
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}/partidas/${partidaId}`, "PUT", { precio_modo: modo });
    } catch (e) {
      setError(e.message);
    }
  };

  const actualizarPrecioManualPartida = async (partidaId, valorTon) => {
    setDetalle((d) => ({
      ...d,
      partidas: d.partidas.map((p) => (p.id === partidaId ? { ...p, precio_manual: valorTon } : p)),
    }));
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}/partidas/${partidaId}`, "PUT", { precio_manual: valorTon });
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
  const sojaRefModo = detalle?.presupuesto?.soja_ref_modo || "auto";
  const sojaRefPrecio = efectivo(sojaRefModo, detalle?.presupuesto?.soja_ref_precio, detalle?.presupuesto?.soja_ref_manual);

  const sojaDispoModo = detalle?.presupuesto?.soja_dispo_modo || "auto";
  const sojaDispoAuto =
    sojaDispoPesos != null && dolarMayoristaCompra ? sojaDispoPesos / dolarMayoristaCompra : null;
  const sojaDispoUsd = efectivo(sojaDispoModo, sojaDispoAuto, detalle?.presupuesto?.soja_dispo_manual);

  const valorRentaUsdTon =
    sojaRefPrecio != null && sojaDispoUsd != null ? (sojaRefPrecio + sojaDispoUsd) / 2 : null;
  const arrendamientoQqHa = detalle?.presupuesto?.arrendamiento_qq_ha ?? 10;
  const valorRentaUsdHa = valorRentaUsdTon != null ? valorRentaUsdTon * (arrendamientoQqHa / 10) : null;

  const partidasConCalculos = (detalle?.partidas || []).map((p) => {
    const precioFinal = p.es_soja ? sojaRefPrecio : efectivo(p.precio_modo, p.precio_congelado, p.precio_manual);
    const toneladas =
      p.superficie_ha != null && p.rendimiento_qq_ha != null ? (p.superficie_ha * p.rendimiento_qq_ha) / 10 : null;
    return { ...p, precioFinal, toneladas };
  });

  const buscarPartida = (nombreExacto) =>
    partidasConCalculos.find((p) => p.cultivo.trim().toLowerCase() === nombreExacto.toLowerCase());

  const equivalentes = [
    { grano: "Trigo", precio: buscarPartida("Trigo")?.precioFinal ?? null },
    { grano: "Maíz", precio: buscarPartida("Maíz 1°")?.precioFinal ?? null },
    { grano: "Sorgo", precio: buscarPartida("Sorgo")?.precioFinal ?? null },
  ].map((e) => ({
    ...e,
    qq: valorRentaUsdHa != null && e.precio ? (valorRentaUsdHa / e.precio) * 10 : null,
  }));

  const totalHa = partidasConCalculos.reduce((acc, p) => acc + (Number(p.superficie_ha) || 0), 0);
  const totalTon = partidasConCalculos.reduce((acc, p) => acc + (p.toneladas || 0), 0);

  const cultivosDisponibles = CULTIVOS_PRESET.filter(
    (c) => !(detalle?.partidas || []).some((p) => p.cultivo === c)
  );

  useEffect(() => {
    if (cultivosDisponibles.length > 0 && !cultivosDisponibles.includes(nuevoCultivo)) {
      setNuevoCultivo(cultivosDisponibles[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cultivosDisponibles.join(",")]);

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
          {/* Selector de unidad de medida */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontFamily: T.bodyFont, fontSize: 11, color: T.textDim }}>Ver precios en:</span>
            {Object.entries(UNIDADES).map(([key, u]) => (
              <button
                key={key}
                onClick={() => cambiarUnidad(key)}
                style={{
                  background: unidad === key ? T.gold : "transparent",
                  color: unidad === key ? T.bg : T.textDim,
                  border: `1px solid ${unidad === key ? T.gold : T.panelLine}`,
                  borderRadius: 4,
                  padding: "4px 10px",
                  fontFamily: T.bodyFont,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {u.label}
              </button>
            ))}
          </div>

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
              label="Soja de referencia"
              symbol={detalle.presupuesto.soja_ref_symbol}
              congelado={detalle.presupuesto.soja_ref_precio}
              live={detalle.presupuesto.soja_ref_symbol ? liveQuotes[detalle.presupuesto.soja_ref_symbol] : null}
              onPick={elegirSojaRef}
              modo={sojaRefModo}
              onModoChange={cambiarSojaRefModo}
              manualValor={detalle.presupuesto.soja_ref_manual}
              onManualChange={actualizarSojaRefManual}
              unidad={unidad}
            />

            <div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginBottom: 3 }}>
                Soja dispo Rosario
              </div>
              <ModoToggle modo={sojaDispoModo} onChange={cambiarSojaDispoModo} />
              {sojaDispoModo === "manual" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number"
                    step="any"
                    style={{ ...inputStyle, width: 110, fontSize: 15, fontWeight: 700, color: T.gold }}
                    value={
                      detalle.presupuesto.soja_dispo_manual != null
                        ? convertirPrecio(detalle.presupuesto.soja_dispo_manual, unidad)
                        : ""
                    }
                    onChange={(e) => actualizarSojaDispoManual(aTonelada(e.target.value, unidad))}
                    placeholder={`en ${UNIDADES[unidad].corto}`}
                  />
                  <span style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim }}>{UNIDADES[unidad].corto}</span>
                </div>
              ) : (
                <>
                  <div style={{ ...inputStyle, cursor: "default", fontSize: 16, fontWeight: 700, color: T.gold }}>
                    {fmtPrecio(sojaDispoAuto, unidad)}
                  </div>
                  <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginTop: 3 }}>
                    {sojaDispoPesos != null
                      ? `$${fmtARS(sojaDispoPesos)} / mayorista compra $${fmtARS(dolarMayoristaCompra)}`
                      : "sin datos"}
                  </div>
                </>
              )}
            </div>

            <div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginBottom: 3 }}>
                Valor renta ({UNIDADES[unidad].label}/ha)
              </div>
              <div style={{ ...inputStyle, cursor: "default", color: T.gold, fontWeight: 700 }}>
                {fmtPrecio(valorRentaUsdHa, unidad)}
              </div>
            </div>

            {equivalentes.map((e) => (
              <div key={e.grano}>
                <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, marginBottom: 3 }}>
                  Equivalente en {e.grano.toLowerCase()} (qq)
                </div>
                <div style={{ ...inputStyle, cursor: "default", color: T.gold, fontWeight: 700 }}>
                  {e.qq != null ? e.qq.toFixed(1) : `— (elegí precio de ${e.grano})`}
                </div>
              </div>
            ))}
          </div>

          {/* Tabla de partidas — cultivos en columnas, como la planilla original */}
          <div style={{ overflowX: "auto", border: `1px solid ${T.panelLine}`, borderRadius: 4 }}>
            <table style={{ borderCollapse: "collapse", fontFamily: T.monoFont, fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: T.panel, textAlign: "left" }}>
                  <th
                    style={{
                      padding: "8px 10px",
                      color: T.textDim,
                      fontFamily: T.bodyFont,
                      fontSize: 10.5,
                      textTransform: "uppercase",
                      letterSpacing: "0.4px",
                      borderBottom: `1px solid ${T.panelLine}`,
                      position: "sticky",
                      left: 0,
                      background: T.panel,
                      minWidth: 190,
                    }}
                  />
                  {partidasConCalculos.map((p) => (
                    <th
                      key={p.id}
                      style={{
                        padding: "8px 10px",
                        color: T.text,
                        fontFamily: T.displayFont,
                        fontSize: 13,
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        borderBottom: `1px solid ${T.panelLine}`,
                        minWidth: 190,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        {p.cultivo}
                        <button
                          onClick={() => borrarPartida(p.id)}
                          style={{ background: "transparent", border: "none", color: T.textDim, cursor: "pointer" }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th
                    style={{
                      padding: "8px 10px",
                      color: T.gold,
                      fontFamily: T.displayFont,
                      fontSize: 13,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      borderBottom: `1px solid ${T.panelLine}`,
                      minWidth: 130,
                    }}
                  >
                    Totales
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Superficie */}
                <tr style={{ borderBottom: `1px solid ${T.panelLine}` }}>
                  <td
                    style={{
                      padding: "10px",
                      color: T.textDim,
                      fontFamily: T.bodyFont,
                      fontSize: 11.5,
                      position: "sticky",
                      left: 0,
                      background: T.bg,
                    }}
                  >
                    Superficie (ha)
                  </td>
                  {partidasConCalculos.map((p) => (
                    <td key={p.id} style={{ padding: "8px 10px" }}>
                      <input
                        type="number"
                        style={{ ...inputStyle, width: 100 }}
                        value={p.superficie_ha ?? 0}
                        onChange={(e) => actualizarPartidaCampo(p.id, "superficie_ha", Number(e.target.value))}
                      />
                    </td>
                  ))}
                  <td style={{ padding: "8px 10px", color: T.gold, fontWeight: 700 }}>{totalHa.toFixed(1)}</td>
                </tr>

                {/* Precio final de venta */}
                <tr style={{ borderBottom: `1px solid ${T.panelLine}` }}>
                  <td
                    style={{
                      padding: "10px",
                      color: T.textDim,
                      fontFamily: T.bodyFont,
                      fontSize: 11.5,
                      position: "sticky",
                      left: 0,
                      background: T.bg,
                    }}
                  >
                    Precio final de venta
                    <br />({UNIDADES[unidad].label})
                  </td>
                  {partidasConCalculos.map((p) => (
                    <td key={p.id} style={{ padding: "8px 10px" }}>
                      <SymbolPicker
                        symbol={p.es_soja ? detalle.presupuesto.soja_ref_symbol : p.precio_symbol}
                        congelado={p.es_soja ? p.precioFinal : p.precio_congelado}
                        live={
                          p.es_soja
                            ? liveQuotes[detalle.presupuesto.soja_ref_symbol]
                            : p.precio_symbol
                            ? liveQuotes[p.precio_symbol]
                            : null
                        }
                        disabled={!!p.es_soja}
                        onPick={(symbol) => elegirPrecioPartida(p.id, symbol)}
                        modo={p.precio_modo}
                        onModoChange={(m) => cambiarPrecioModoPartida(p.id, m)}
                        manualValor={p.precio_manual}
                        onManualChange={(v) => actualizarPrecioManualPartida(p.id, v)}
                        unidad={unidad}
                      />
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Rendimiento */}
                <tr style={{ borderBottom: `1px solid ${T.panelLine}` }}>
                  <td
                    style={{
                      padding: "10px",
                      color: T.textDim,
                      fontFamily: T.bodyFont,
                      fontSize: 11.5,
                      position: "sticky",
                      left: 0,
                      background: T.bg,
                    }}
                  >
                    Rendimiento (qq/ha)
                  </td>
                  {partidasConCalculos.map((p) => (
                    <td key={p.id} style={{ padding: "8px 10px" }}>
                      <input
                        type="number"
                        style={{ ...inputStyle, width: 100 }}
                        value={p.rendimiento_qq_ha ?? 0}
                        onChange={(e) => actualizarPartidaCampo(p.id, "rendimiento_qq_ha", Number(e.target.value))}
                      />
                    </td>
                  ))}
                  <td />
                </tr>

                {/* Toneladas */}
                <tr>
                  <td
                    style={{
                      padding: "10px",
                      color: T.textDim,
                      fontFamily: T.bodyFont,
                      fontSize: 11.5,
                      position: "sticky",
                      left: 0,
                      background: T.bg,
                    }}
                  >
                    Toneladas
                  </td>
                  {partidasConCalculos.map((p) => (
                    <td key={p.id} style={{ padding: "8px 10px", color: T.gold }}>
                      {p.toneladas != null ? p.toneladas.toFixed(1) : "—"}
                    </td>
                  ))}
                  <td style={{ padding: "8px 10px", color: T.gold, fontWeight: 700 }}>{totalTon.toFixed(1)}</td>
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
