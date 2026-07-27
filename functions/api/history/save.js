import { json } from "../../_utils.js";

// POST /api/history/save
// body: { tipo, simbolo, etiqueta, precio, compra, venta }
export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return json({ error: "Base de datos no configurada (falta el binding DB)" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const { tipo, simbolo, etiqueta, precio, compra, venta } = body || {};
  if (!tipo || !simbolo) {
    return json({ error: "Faltan tipo o simbolo" }, 400);
  }

  const fechaHora = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO cotizaciones_historial (tipo, simbolo, etiqueta, precio, compra, venta, fecha_hora)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(tipo, simbolo, etiqueta ?? null, precio ?? null, compra ?? null, venta ?? null, fechaHora)
      .run();

    return json({ ok: true, fecha_hora: fechaHora });
  } catch (e) {
    return json({ error: "No se pudo guardar en la base: " + e.message }, 500);
  }
}
