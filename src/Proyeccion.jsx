import { useState, useEffect, useCallback } from "react";
import { AlertCircle, Plus, X, ClipboardList } from "lucide-react";
import { T, fmtARS, SectionHeader } from "./theme.jsx";

const SECCIONES = ["Labores", "Insumos", "Servicios", "Alquileres", "Gastos de estructura", "Gastos comerciales"];

const UNIDADES_COSTO = {
  litro_ha: { label: "Litro/ha", fisica: true },
  kg_ha: { label: "Kg/ha", fisica: true },
  pesos_ha: { label: "$/ha", fisica: false },
  dolares_ha: { label: "USD/ha", fisica: false },
};

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

// Costo por hectárea (en la moneda nativa de la categoría), considerando dosis y pasadas.
function calcularSaldoHa(c) {
  const unidadInfo = UNIDADES_COSTO[c.unidad] || UNIDADES_COSTO.pesos_ha;
  const costoUnitario = unidadInfo.fisica ? (Number(c.dosis) || 0) * (Number(c.importe) || 0) : Number(c.importe) || 0;
  return costoUnitario * (Number(c.pasadas) || 1);
}

function fmtMoneda(v) {
  if (v == null) return "—";
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

export default function Proyeccion() {
  const [campos, setCampos] = useState([]);
  const [campoId, setCampoId] = useState(null);
  const [nuevoCampo, setNuevoCampo] = useState("");

  const [presupuestos, setPresupuestos] = useState([]);
  const [presupuestoId, setPresupuestoId] = useState(null);
  const [nuevaCampania, setNuevaCampania] = useState("25-26");

  const [costos, setCostos] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dolar, setDolar] = useState(null); // { compra, venta }

  useEffect(() => {
    apiGet("/api/campos")
      .then((d) => setCampos(d.campos || []))
      .catch((e) => setError(e.message));
  }, []);

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

  const cargarCostos = useCallback(() => {
    if (!presupuestoId) {
      setCostos([]);
      return;
    }
    setLoading(true);
    apiGet(`/api/presupuestos/${presupuestoId}/costos`)
      .then((d) => setCostos(d.costos || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [presupuestoId]);

  useEffect(() => {
    cargarCostos();
  }, [cargarCostos]);

  useEffect(() => {
    const load = () => {
      fetch("https://dolarapi.com/v1/dolares/mayorista")
        .then((r) => r.json())
        .then((d) => setDolar({ compra: d.compra, venta: d.venta }))
        .catch(() => {});
    };
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

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
      const p = await apiSend("/api/presupuestos", "POST", { campo_id: campoId, campania: nuevaCampania.trim() });
      setPresupuestos((prev) => [p, ...prev]);
      setPresupuestoId(p.id);
    } catch (e) {
      setError(e.message);
    }
  };

  const agregarCategoria = async (seccion) => {
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}/costos`, "POST", {
        seccion,
        nombre: "Nueva categoría",
        unidad: "pesos_ha",
        pasadas: 1,
        importe: 0,
        moneda: "ARS",
        orden: costos.filter((c) => c.seccion === seccion).length,
      });
      cargarCostos();
    } catch (e) {
      setError(e.message);
    }
  };

  const actualizarCategoria = async (id, campo, valor) => {
    setCostos((prev) => prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}/costos/${id}`, "PUT", { [campo]: valor });
    } catch (e) {
      setError(e.message);
    }
  };

  const borrarCategoria = async (id) => {
    try {
      await apiSend(`/api/presupuestos/${presupuestoId}/costos/${id}`, "DELETE");
      cargarCostos();
    } catch (e) {
      setError(e.message);
    }
  };

  // --- cálculos ---
  const conCalculos = costos.map((c) => {
    const saldoHaNativo = calcularSaldoHa(c);
    const saldoHaUsd = c.moneda === "USD" ? saldoHaNativo : dolar ? saldoHaNativo / dolar.venta : null;
    const saldoHaArs = c.moneda === "ARS" ? saldoHaNativo : dolar ? saldoHaNativo * dolar.venta : null;
    return { ...c, saldoHaNativo, saldoHaUsd, saldoHaArs };
  });

  const totalPorSeccion = (seccion) => {
    const items = conCalculos.filter((c) => c.seccion === seccion);
    const usd = items.reduce((acc, c) => acc + (c.saldoHaUsd || 0), 0);
    const ars = items.reduce((acc, c) => acc + (c.saldoHaArs || 0), 0);
    return { usd, ars };
  };

  const totalGeneral = SECCIONES.reduce(
    (acc, s) => {
      const t = totalPorSeccion(s);
      return { usd: acc.usd + t.usd, ars: acc.ars + t.ars };
    },
    { usd: 0, ars: 0 }
  );

  return (
    <div style={{ padding: "20px 24px 60px" }}>
      <SectionHeader
        icon={<ClipboardList size={20} color={T.gold} />}
        title="Proyección de presupuesto"
        note="costos por hectárea"
      />

      {/* Selector de campo / campaña — mismo presupuesto que Presupuesto Agrícola */}
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

      {presupuestoId && !loading && (
        <>
          {/* Total general — destacado arriba de todo */}
          <div
            style={{
              display: "flex",
              gap: 32,
              alignItems: "center",
              background: `linear-gradient(90deg, ${T.gold}22, transparent)`,
              border: `1px solid ${T.gold}`,
              borderRadius: 6,
              padding: "14px 20px",
              marginBottom: 22,
            }}
          >
            <ClipboardList size={22} color={T.gold} />
            <div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Costo total proyectado
              </div>
              <div style={{ fontFamily: T.displayFont, fontSize: 24, fontWeight: 700, color: T.gold }}>
                USD {fmtMoneda(totalGeneral.usd)} <span style={{ fontSize: 13, color: T.textDim }}>/ha</span>
              </div>
            </div>
            <div style={{ width: 1, height: 34, background: T.panelLine }} />
            <div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Equivalente
              </div>
              <div style={{ fontFamily: T.displayFont, fontSize: 18, color: T.text }}>
                $ {fmtMoneda(totalGeneral.ars)} <span style={{ fontSize: 12, color: T.textDim }}>/ha</span>
              </div>
            </div>
            {dolar && (
              <div style={{ marginLeft: "auto", fontFamily: T.bodyFont, fontSize: 10.5, color: T.textDim }}>
                dólar mayorista venta usado para convertir: ${fmtMoneda(dolar.venta)}
              </div>
            )}
          </div>

          {/* Una sección por bloque */}
          {SECCIONES.map((seccion) => {
            const items = conCalculos.filter((c) => c.seccion === seccion);
            const t = totalPorSeccion(seccion);
            return (
              <div key={seccion} style={{ marginBottom: 30 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                  <h3
                    style={{
                      fontFamily: T.displayFont,
                      fontSize: 16,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      color: T.text,
                      margin: 0,
                    }}
                  >
                    {seccion}
                  </h3>
                  <span style={{ fontFamily: T.monoFont, fontSize: 13, color: T.gold, fontWeight: 700 }}>
                    USD {fmtMoneda(t.usd)}/ha <span style={{ color: T.textDim, fontWeight: 400 }}>· $ {fmtMoneda(t.ars)}/ha</span>
                  </span>
                </div>

                {items.length === 0 && (
                  <p style={{ fontFamily: T.bodyFont, fontSize: 12, color: T.textDim, marginBottom: 10 }}>
                    Sin categorías cargadas.
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map((c) => {
                    const esFisica = UNIDADES_COSTO[c.unidad]?.fisica;
                    return (
                      <div
                        key={c.id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-end",
                          flexWrap: "wrap",
                          background: T.panel,
                          border: `1px solid ${T.panelLine}`,
                          borderRadius: 4,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ flex: "1 1 160px", minWidth: 140 }}>
                          <div style={{ fontFamily: T.bodyFont, fontSize: 9.5, color: T.textDim, marginBottom: 2 }}>Nombre</div>
                          <input
                            style={{ ...inputStyle, width: "100%" }}
                            value={c.nombre}
                            onChange={(e) => actualizarCategoria(c.id, "nombre", e.target.value)}
                          />
                        </div>

                        <div style={{ minWidth: 110 }}>
                          <div style={{ fontFamily: T.bodyFont, fontSize: 9.5, color: T.textDim, marginBottom: 2 }}>Unidad</div>
                          <select
                            style={inputStyle}
                            value={c.unidad}
                            onChange={(e) => actualizarCategoria(c.id, "unidad", e.target.value)}
                          >
                            {Object.entries(UNIDADES_COSTO).map(([key, u]) => (
                              <option key={key} value={key}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {esFisica && (
                          <div style={{ minWidth: 90 }}>
                            <div style={{ fontFamily: T.bodyFont, fontSize: 9.5, color: T.textDim, marginBottom: 2 }}>
                              Dosis ({UNIDADES_COSTO[c.unidad].label})
                            </div>
                            <input
                              type="number"
                              style={{ ...inputStyle, width: 80 }}
                              value={c.dosis ?? 0}
                              onChange={(e) => actualizarCategoria(c.id, "dosis", Number(e.target.value))}
                            />
                          </div>
                        )}

                        <div style={{ minWidth: 80 }}>
                          <div style={{ fontFamily: T.bodyFont, fontSize: 9.5, color: T.textDim, marginBottom: 2 }}>Pasadas/ha</div>
                          <input
                            type="number"
                            style={{ ...inputStyle, width: 70 }}
                            value={c.pasadas ?? 1}
                            onChange={(e) => actualizarCategoria(c.id, "pasadas", Number(e.target.value))}
                          />
                        </div>

                        <div style={{ minWidth: 110 }}>
                          <div style={{ fontFamily: T.bodyFont, fontSize: 9.5, color: T.textDim, marginBottom: 2 }}>
                            {esFisica ? `Precio/${UNIDADES_COSTO[c.unidad].label.split("/")[0]}` : "Importe/ha"}
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <input
                              type="number"
                              style={{ ...inputStyle, width: 80 }}
                              value={c.importe ?? 0}
                              onChange={(e) => actualizarCategoria(c.id, "importe", Number(e.target.value))}
                            />
                            <select
                              style={{ ...inputStyle, width: 68 }}
                              value={c.moneda}
                              onChange={(e) => actualizarCategoria(c.id, "moneda", e.target.value)}
                            >
                              <option value="ARS">ARS</option>
                              <option value="USD">USD</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ minWidth: 130, textAlign: "right" }}>
                          <div style={{ fontFamily: T.bodyFont, fontSize: 9.5, color: T.textDim, marginBottom: 2 }}>Saldo/ha</div>
                          <div style={{ fontFamily: T.monoFont, fontSize: 14, fontWeight: 700, color: T.gold }}>
                            {c.moneda === "USD" ? "USD " : "$ "}
                            {fmtMoneda(c.saldoHaNativo)}
                          </div>
                        </div>

                        <button
                          onClick={() => borrarCategoria(c.id)}
                          style={{ background: "transparent", border: "none", color: T.textDim, cursor: "pointer", padding: "8px 2px" }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button style={{ ...btnGhost, marginTop: 10 }} onClick={() => agregarCategoria(seccion)}>
                  <Plus size={12} style={{ marginRight: 4 }} /> Agregar categoría a {seccion}
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
