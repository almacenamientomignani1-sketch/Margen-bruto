import { json, REMARKETS_BASE } from "../../_utils.js";

// POST /api/remarkets/login  { username, password } -> { token }
export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const { username, password } = body || {};
  if (!username || !password) {
    return json({ error: "Faltan usuario o contraseña" }, 400);
  }

  try {
    const upstream = await fetch(`${REMARKETS_BASE}/auth/getToken`, {
      method: "POST",
      headers: {
        "X-Username": username,
        "X-Password": password,
      },
    });

    const token = upstream.headers.get("X-Auth-Token");

    if (!upstream.ok || !token) {
      return json({ error: "Usuario o contraseña incorrectos" }, 401);
    }

    return json({ token });
  } catch (e) {
    return json({ error: "No se pudo contactar a reMarkets" }, 502);
  }
}
