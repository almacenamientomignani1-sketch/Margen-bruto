# Pizarra de Rueda — Panel Agro

Dashboard de dólares y futuros/opciones agropecuarios en vivo, con conexión a **reMarkets (Primary API,
entorno de pruebas de A3)**. Pensado como base del sistema de márgenes proyectado vs. real por
campo/lote/grano.

## Estructura

```
src/App.jsx                          → el panel (React)
functions/api/remarkets/login.js     → Cloudflare Pages Function: pide el token a reMarkets
functions/api/remarkets/instruments.js → lista instrumentos disponibles
functions/api/remarkets/marketdata.js  → precio en vivo de un símbolo
```

Las funciones en `/functions` corren en el **borde de Cloudflare**, no en el navegador. Por eso no hay
problema de CORS: el navegador le habla a tu propio dominio, y tu dominio le habla a Primary de servidor
a servidor.

Las credenciales de reMarkets **no se guardan en ningún lado**: las tipeás en el panel, viajan directo
al endpoint de login, y el token queda solo en la memoria de la pestaña del navegador.

## Desarrollo local

```bash
npm install
npm run build
npx wrangler pages dev dist
```

(`wrangler pages dev` sirve el build y las Functions juntos, simulando el entorno de Cloudflare. Si solo
corrés `npm run dev`, vas a tener el frontend pero no las rutas `/api/remarkets/*`.)

## Deploy en Cloudflare Pages

1. Subí este proyecto a un repo de GitHub.
2. En el dashboard de Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Elegí el repo.
4. Configuración de build:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Deploy. Cloudflare va a levantar automáticamente las Functions de `/functions` sin configuración
   adicional — no hace falta `wrangler.toml` para Pages.
6. Cada push a la rama principal vuelve a deployar solo.

## Base de datos — historial de cotizaciones (Cloudflare D1)

Cada precio que pasa por el panel (dólares y símbolos de reMarkets) se guarda automáticamente en una
base D1, y hay un buscador ("Historial de cotizaciones") para consultarlo después por símbolo y rango
de fechas.

**Configuración (una sola vez):**

1. En el dashboard de Cloudflare → **Workers & Pages → D1** → **Create database**. Ponele un nombre, ej.
   `panel-agro-db`.
2. Entrá a la base recién creada → pestaña **Console** → pegá el contenido de `schema.sql` (de este
   repo) → **Execute**. Esto crea la tabla `cotizaciones_historial`.
3. Volvé a tu proyecto de Pages → **Settings → Bindings** → **Add binding** → tipo **D1 database**.
   - **Variable name**: `DB` (tiene que ser exactamente así, en mayúsculas — el código ya lo espera)
   - **D1 database**: elegís `panel-agro-db`
4. Guardá y hacé un **Retry deployment** (o un push nuevo) para que el binding quede activo.

A partir de ahí, cada vez que el panel esté abierto va a ir guardando solo. Podés buscar por símbolo
(ej. `blue`, `SOJ.ROS`), por tipo (dólar/grano), y por rango de fechas.

**Importante — sobre cuándo se guarda:** el guardado ocurre mientras la pestaña del panel está abierta
en algún navegador (el tuyo). Si querés que se siga guardando aunque no tengas la página abierta, el
paso siguiente es un Worker separado con un **Cron Trigger** que llame a la API en un intervalo fijo —
te ayudo a armarlo cuando quieras.

## Opcional: restringir el acceso a vos mismo

Como el sitio va a quedar público en `tu-proyecto.pages.dev`, cualquiera que entre a la URL puede usar
el formulario de login (con **sus propias** credenciales de reMarkets — el proxy no las guarda ni las
comparte). Si preferís que la página entera solo la puedas ver vos:

- Cloudflare **Zero Trust → Access → Applications**: agregá una regla que pida tu email antes de mostrar
  el sitio. Es gratis para uso personal y se configura en minutos desde el mismo dashboard.

## Próximos pasos naturales

- Sumar una base de datos (Cloudflare **D1**, SQL, gratis en el plan free) para guardar campos, lotes,
  presupuestos y ventas reales — el motor de márgenes proyectado vs. real que hablamos.
- Cuando tengas credenciales productivas de A3 (no reMarkets), el único cambio es apuntar
  `REMARKETS_BASE` en `functions/_utils.js` al dominio de producción.
