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
