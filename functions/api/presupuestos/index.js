import { json } from "../../_utils.js";

// GET /api/presupuestos?campo_id=1 -> { presupuestos: [...] }
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  const url = new URL(request.url);
  const campoId = url.searchParams.get("campo_id");

  try {
    const stmt = campoId
      ? env.DB.prepare(
          `SELECT id, campo_id, campania, arrendamiento_qq_ha, soja_ref_symbol, soja_ref_precio, soja_ref_fecha, creado
           FROM presupuestos WHERE campo_id = ? ORDER BY campania DESC`
        ).bind(campoId)
      : env.DB.prepare(
          `SELECT id, campo_id, campania, arrendamiento_qq_ha, soja_ref_symbol, soja_ref_precio, soja_ref_fecha, creado
           FROM presupuestos ORDER BY creado DESC`
        );
    const { results } = await stmt.all();
    return json({ presupuestos: results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// POST /api/presupuestos  { campo_id, campania, arrendamiento_qq_ha } -> presupuesto creado
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  const { campo_id, campania, arrendamiento_qq_ha } = body || {};
  if (!campo_id || !campania) return json({ error: "Faltan campo_id o campania" }, 400);

  const creado = new Date().toISOString();
  try {
    const res = await env.DB.prepare(
      `INSERT INTO presupuestos (campo_id, campania, arrendamiento_qq_ha, creado) VALUES (?, ?, ?, ?)`
    )
      .bind(campo_id, campania, arrendamiento_qq_ha ?? 10, creado)
      .run();
    return json({ id: res.meta.last_row_id, campo_id, campania, arrendamiento_qq_ha: arrendamiento_qq_ha ?? 10, creado });
  } catch (e) {
    return json({ error: "No se pudo crear (¿campaña repetida para ese campo?): " + e.message }, 500);
  }
}
