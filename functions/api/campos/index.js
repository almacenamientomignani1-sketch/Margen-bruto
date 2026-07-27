import { json } from "../../_utils.js";

// GET /api/campos -> { campos: [{id, nombre}] }
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  try {
    const { results } = await env.DB.prepare("SELECT id, nombre FROM campos ORDER BY nombre").all();
    return json({ campos: results });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// POST /api/campos  { nombre } -> { id, nombre }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Falta el binding DB" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  const nombre = (body?.nombre || "").trim();
  if (!nombre) return json({ error: "Falta el nombre del campo" }, 400);

  try {
    const res = await env.DB.prepare("INSERT INTO campos (nombre) VALUES (?)").bind(nombre).run();
    return json({ id: res.meta.last_row_id, nombre });
  } catch (e) {
    return json({ error: "No se pudo crear (¿nombre repetido?): " + e.message }, 500);
  }
}
