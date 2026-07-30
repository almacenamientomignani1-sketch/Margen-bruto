import { useState, useEffect, useCallback } from "react";
import { AlertCircle, Plus, X, ChevronDown, ChevronRight, ClipboardCheck } from "lucide-react";
import { T, SectionHeader } from "./theme.jsx";

const SECCIONES = ["Labores", "Insumos", "Servicios", "Alquileres", "Gastos de estructura", "Gastos comerciales"];
const UNIDADES_COMPRA = ["Litros", "Kg", "Unidades", "Horas", "Otro"];

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

function fmtMoneda(v) {
  if (v == null) return "—";
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function importeCompra(c) {
  return (Number(c.cantidad) || 0) * (Number(c.precio_unitario) || 0);
}

export default function Ejecucion() {
  const [campos, setCampos] = useState([]);
  const [campoId, setCampoId] = useState(null);
  const [nuevoCampo, setNuevoCampo] = useState("");

  const [presupuestos, setPresupuestos] = useState([]);
  const [presupuestoId, setPresupuestoId] = useState(null);
  const [nuevaCampania, setNuevaCampania] = useState("25-26");

  const [categorias, setCategorias] = useState([]);
  const [compras, setCompras] = useState([]);
  const [abiertas, setAbiertas] = useState(new Set());
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dolar, setDolar] = useState(null);

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

  const cargarTodo = useCallback(() => {
    if (!presupuestoId) {
      setCategorias([]);
      setCompras([]);
      return;
    }
    setLoading(true);
    Promise.all([
      apiGet(`/api/ejecucion-categorias?presupuesto_id=${presupuestoId}`),
      apiGet(`/api/ejecucion-compras?presupuesto_id=${presupuestoId}`),
    ])
      .then(([cat, com]) => {
        setCategorias(cat.categorias || []);
        setCompras(com.compras || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [presupuestoId]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

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

  const actualizarHectareas = async (hectareas) => {
    setCampos((prev) => prev.map((c) => (c.id === campoId ? { ...c, hectareas } : c)));
    try {
      await apiSend(`/api/campos/${campoId}`, "PUT", { hectareas });
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
      const c = await apiSend("/api/ejecucion-categorias", "POST", {
        presupuesto_id: presupuestoId,
        seccion,
        nombre: "Nueva categoría",
        orden: categorias.filter((x) => x.seccion === seccion).length,
      });
      setAbiertas((prev) => new Set(prev).add(c.id));
      cargarTodo();
    } catch (e) {
      setError(e.message);
    }
  };

  const renombrarCategoria = async (id, nombre) => {
    setCategorias((prev) => prev.map((c) => (c.id === id ? { ...c, nombre } : c)));
    try {
      await apiSend(`/api/ejecucion-categorias/${id}`, "PUT", { nombre });
    } catch (e) {
      setError(e.message);
    }
  };

  const borrarCategoria = async (id) => {
    try {
      await apiSend(`/api/ejecucion-categorias/${id}`, "DELETE");
      cargarTodo();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleAbierta = (id) => {
    setAbiertas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const agregarCompra = async (categoriaId) => {
    try {
      await apiSend("/api/ejecucion-compras", "POST", {
        categoria_id: categoriaId,
        nombre: "Nueva compra",
        unidad: "Unidades",
        cantidad: 0,
        precio_unitario: 0,
        moneda: "ARS",
        fecha: new Date().toISOString().slice(0, 10),
      });
      cargarTodo();
    } catch (e) {
      setError(e.message);
    }
  };

  const actualizarCompra = async (id, campo, valor) => {
    setCompras((prev) => prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
    try {
      await apiSend(`/api/ejecucion-compras/${id}`, "PUT", { [campo]: valor });
    } catch (e) {
      setError(e.message);
    }
  };

  const borrarCompra = async (id) => {
    try {
      await apiSend(`/api/ejecucion-compras/${id}`, "DELETE");
      cargarTodo();
    } catch (e) {
      setError(e.message);
    }
  };

  // --- cálculos ---
  const comprasDeCategoria = (categoriaId) => compras.filter((c) => c.categoria_id === categoriaId);

  const totalCategoriaUSD = (categoriaId) =>
    comprasDeCategoria(categoriaId).reduce((acc, c) => {
      const nativo = importeCompra(c);
      const usd = c.moneda === "USD" ? nativo : dolar ? nativo / dolar.venta : 0;
      return acc + usd;
    }, 0);
  const totalCategoriaARS = (categoriaId) =>
    comprasDeCategoria(categoriaId).reduce((acc, c) => {
      const nativo = importeCompra(c);
      const ars = c.moneda === "ARS" ? nativo : dolar ? nativo * dolar.venta : 0;
      return acc + ars;
    }, 0);

  const categoriasDeSeccion = (seccion) => categorias.filter((c) => c.seccion === seccion);

  const totalSeccion = (seccion) => {
    const cats = categoriasDeSeccion(seccion);
    return cats.reduce(
      (acc, cat) => ({
        usd: acc.usd + totalCategoriaUSD(cat.id),
        ars: acc.ars + totalCategoriaARS(cat.id),
      }),
      { usd: 0, ars: 0 }
    );
  };

  const totalGeneral = SECCIONES.reduce(
    (acc, s) => {
      const t = totalSeccion(s);
      return { usd: acc.usd + t.usd, ars: acc.ars + t.ars };
    },
    { usd: 0, ars: 0 }
  );

  const campoSeleccionado = campos.find((c) => c.id === campoId);
  const hectareas = campoSeleccionado?.hectareas || null;
  const usdPorHa = hectareas ? totalGeneral.usd / hectareas : null;
  const arsPorHa = hectareas ? totalGeneral.ars / hectareas : null;

  return (
    <div style={{ padding: "20px 24px 60px" }}>
      <SectionHeader
        icon={<ClipboardCheck size={20} color={T.gold} />}
        title="Ejecución de presupuesto"
        note="gasto real, por categoría y compra"
      />

      {/* Selector de campo / campaña */}
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
            <div style={{ fontFamily: T.bodyFont, fontSize: 11, color: T.textDim, marginBottom: 4 }}>Hectáreas del campo</div>
            <input
              type="number"
              style={{ ...inputStyle, width: 100 }}
              placeholder="ej. 1500"
              value={campoSeleccionado?.hectareas ?? ""}
              onChange={(e) => actualizarHectareas(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>
        )}

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
          {/* Total general */}
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
            <ClipboardCheck size={22} color={T.gold} />
            <div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Gasto real total
              </div>
              <div style={{ fontFamily: T.displayFont, fontSize: 24, fontWeight: 700, color: T.gold }}>
                USD {fmtMoneda(totalGeneral.usd)}
              </div>
            </div>
            <div style={{ width: 1, height: 34, background: T.panelLine }} />
            <div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Equivalente
              </div>
              <div style={{ fontFamily: T.displayFont, fontSize: 18, color: T.text }}>$ {fmtMoneda(totalGeneral.ars)}</div>
            </div>
            <div style={{ width: 1, height: 34, background: T.panelLine }} />
            <div>
              <div style={{ fontFamily: T.bodyFont, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Costo por hectárea
              </div>
              {hectareas ? (
                <div style={{ fontFamily: T.displayFont, fontSize: 18, color: T.gold }}>
                  USD {fmtMoneda(usdPorHa)}/ha <span style={{ fontSize: 12, color: T.textDim }}>· $ {fmtMoneda(arsPorHa)}/ha</span>
                </div>
              ) : (
                <div style={{ fontFamily: T.bodyFont, fontSize: 11.5, color: T.textDim }}>cargá las hectáreas del campo →</div>
              )}
            </div>
            {dolar && (
              <div style={{ marginLeft: "auto", fontFamily: T.bodyFont, fontSize: 10.5, color: T.textDim }}>
                dólar mayorista venta usado para convertir: ${fmtMoneda(dolar.venta)}
              </div>
            )}
          </div>

          {SECCIONES.map((seccion) => {
            const cats = categoriasDeSeccion(seccion);
            const t = totalSeccion(seccion);
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
                    USD {fmtMoneda(t.usd)} <span style={{ color: T.textDim, fontWeight: 400 }}>· $ {fmtMoneda(t.ars)}</span>
                    {hectareas && (
                      <span style={{ color: T.textDim, fontWeight: 400 }}> · USD {fmtMoneda(t.usd / hectareas)}/ha</span>
                    )}
                  </span>
                </div>

                {cats.length === 0 && (
                  <p style={{ fontFamily: T.bodyFont, fontSize: 12, color: T.textDim, marginBottom: 10 }}>
                    Sin categorías cargadas.
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cats.map((cat) => {
                    const abierta = abiertas.has(cat.id);
                    const items = comprasDeCategoria(cat.id);
                    return (
                      <div
                        key={cat.id}
                        style={{
                          background: T.panel,
                          border: `1px solid ${T.panelLine}`,
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                          <button
                            onClick={() => toggleAbierta(cat.id)}
                            style={{ background: "transparent", border: "none", color: T.textDim, cursor: "pointer", display: "flex" }}
                          >
                            {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          <input
                            style={{ ...inputStyle, flex: 1, minWidth: 140 }}
                            value={cat.nombre}
                            onChange={(e) => renombrarCategoria(cat.id, e.target.value)}
                          />
                          <span style={{ fontFamily: T.bodyFont, fontSize: 10.5, color: T.textDim }}>
                            {items.length} compra{items.length !== 1 ? "s" : ""}
                          </span>
                          <span style={{ fontFamily: T.monoFont, fontSize: 13, fontWeight: 700, color: T.gold, minWidth: 100, textAlign: "right" }}>
                            USD {fmtMoneda(totalCategoriaUSD(cat.id))}
                          </span>
                          <button
                            onClick={() => borrarCategoria(cat.id)}
                            style={{ background: "transparent", border: "none", color: T.textDim, cursor: "pointer" }}
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {abierta && (
                          <div style={{ borderTop: `1px solid ${T.panelLine}`, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                            {items.map((c) => (
                              <div
                                key={c.id}
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  alignItems: "flex-end",
                                  flexWrap: "wrap",
                                  background: T.bg,
                                  border: `1px solid ${T.panelLine}`,
                                  borderRadius: 4,
                                  padding: "8px 10px",
                                }}
                              >
                                <div style={{ flex: "1 1 140px", minWidth: 120 }}>
                                  <div style={{ fontFamily: T.bodyFont, fontSize: 9, color: T.textDim, marginBottom: 2 }}>Detalle</div>
                                  <input
                                    style={{ ...inputStyle, width: "100%" }}
                                    value={c.nombre}
                                    onChange={(e) => actualizarCompra(c.id, "nombre", e.target.value)}
                                  />
                                </div>
                                <div style={{ minWidth: 90 }}>
                                  <div style={{ fontFamily: T.bodyFont, fontSize: 9, color: T.textDim, marginBottom: 2 }}>Unidad</div>
                                  <select
                                    style={inputStyle}
                                    value={c.unidad || "Unidades"}
                                    onChange={(e) => actualizarCompra(c.id, "unidad", e.target.value)}
                                  >
                                    {UNIDADES_COMPRA.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div style={{ minWidth: 75 }}>
                                  <div style={{ fontFamily: T.bodyFont, fontSize: 9, color: T.textDim, marginBottom: 2 }}>Cantidad</div>
                                  <input
                                    type="number"
                                    style={{ ...inputStyle, width: 70 }}
                                    value={c.cantidad ?? 0}
                                    onChange={(e) => actualizarCompra(c.id, "cantidad", Number(e.target.value))}
                                  />
                                </div>
                                <div style={{ minWidth: 105 }}>
                                  <div style={{ fontFamily: T.bodyFont, fontSize: 9, color: T.textDim, marginBottom: 2 }}>Precio unitario</div>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <input
                                      type="number"
                                      style={{ ...inputStyle, width: 75 }}
                                      value={c.precio_unitario ?? 0}
                                      onChange={(e) => actualizarCompra(c.id, "precio_unitario", Number(e.target.value))}
                                    />
                                    <select
                                      style={{ ...inputStyle, width: 66 }}
                                      value={c.moneda}
                                      onChange={(e) => actualizarCompra(c.id, "moneda", e.target.value)}
                                    >
                                      <option value="ARS">ARS</option>
                                      <option value="USD">USD</option>
                                    </select>
                                  </div>
                                </div>
                                <div style={{ minWidth: 120 }}>
                                  <div style={{ fontFamily: T.bodyFont, fontSize: 9, color: T.textDim, marginBottom: 2 }}>Proveedor</div>
                                  <input
                                    style={{ ...inputStyle, width: "100%" }}
                                    value={c.proveedor || ""}
                                    onChange={(e) => actualizarCompra(c.id, "proveedor", e.target.value)}
                                  />
                                </div>
                                <div style={{ minWidth: 130 }}>
                                  <div style={{ fontFamily: T.bodyFont, fontSize: 9, color: T.textDim, marginBottom: 2 }}>Fecha</div>
                                  <input
                                    type="date"
                                    style={{ ...inputStyle, width: "100%" }}
                                    value={c.fecha || ""}
                                    onChange={(e) => actualizarCompra(c.id, "fecha", e.target.value)}
                                  />
                                </div>
                                <div style={{ flex: "1 1 140px", minWidth: 120 }}>
                                  <div style={{ fontFamily: T.bodyFont, fontSize: 9, color: T.textDim, marginBottom: 2 }}>Nota</div>
                                  <input
                                    style={{ ...inputStyle, width: "100%" }}
                                    value={c.nota || ""}
                                    onChange={(e) => actualizarCompra(c.id, "nota", e.target.value)}
                                  />
                                </div>
                                <div style={{ minWidth: 100, textAlign: "right" }}>
                                  <div style={{ fontFamily: T.bodyFont, fontSize: 9, color: T.textDim, marginBottom: 2 }}>Importe</div>
                                  <div style={{ fontFamily: T.monoFont, fontSize: 13, fontWeight: 700, color: T.gold }}>
                                    {c.moneda === "USD" ? "USD " : "$ "}
                                    {fmtMoneda(importeCompra(c))}
                                  </div>
                                </div>
                                <button
                                  onClick={() => borrarCompra(c.id)}
                                  style={{ background: "transparent", border: "none", color: T.textDim, cursor: "pointer", padding: "8px 2px" }}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                            <button style={{ ...btnGhost, alignSelf: "flex-start" }} onClick={() => agregarCompra(cat.id)}>
                              <Plus size={12} style={{ marginRight: 4 }} /> Agregar compra
                            </button>
                          </div>
                        )}
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
