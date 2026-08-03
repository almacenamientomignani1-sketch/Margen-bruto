// La librería pdfjs-dist se carga de forma diferida (ver cargarPdfjs más abajo)
// para no engordar el bundle principal — solo se descarga cuando hace falta.

let _pdfjsLib = null;
async function cargarPdfjs() {
  if (_pdfjsLib) return _pdfjsLib;
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
  _pdfjsLib = pdfjsLib;
  return pdfjsLib;
}

// ---------------------------------------------------------------------------
// Extracción de texto: se toma cada ítem de texto del PDF con su posición
// (x, y), se ordena en orden de lectura (de arriba hacia abajo, izquierda a
// derecha) y se concatena todo en un único string. No se intenta reconstruir
// "renglones" — algunas plantillas de factura ubican el final de una
// descripción partida en dos líneas exactamente a la misma altura que el
// arranque del ítem siguiente, lo que rompe cualquier agrupado por Y.
// En cambio, el parseo de ítems (más abajo) ancla cada producto por el
// patrón numérico que lo cierra (cantidad/unidad/precio/IVA), sin importar
// en qué línea visual haya caído cada pedazo de texto.
// ---------------------------------------------------------------------------
async function extraerTextoPDF(file) {
  const pdfjsLib = await cargarPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let texto = "";

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], y: i.transform[5], str: i.str }));

    items.sort((a, b) => b.y - a.y || a.x - b.x);
    texto += items.map((i) => i.str).join(" ") + " ";
  }
  return texto.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Parser genérico de ítems: busca, sobre el texto completo, el patrón
// "descripción + cantidad + unidad + precio + subtotal + iva% + subtotal c/iva"
// repetido las veces que aparezca. La descripción se captura de forma no
// codiciosa y acotada (3 a 90 caracteres) — eso hace que, aunque el texto
// tenga ruido antes (encabezados, datos del cliente, etc.), el motor de
// regex termine tomando solo el fragmento inmediatamente anterior al bloque
// numérico de cada ítem, sin arrastrar texto de ítems anteriores.
// ---------------------------------------------------------------------------
const PATRON_ITEM_GLOBAL =
  /([^\n]{3,90}?)\s+(\d+(?:[.,]\d+)?)\s+(Unidades|Litros?|Kilogramos|Kg|Bolsas|Lts?|Metros|Rollos)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*%\s+(\d+(?:[.,]\d+)?)/g;

function parsearTablaGenerica(texto) {
  const items = [];
  for (const m of texto.matchAll(PATRON_ITEM_GLOBAL)) {
    items.push({
      producto: m[1].trim().replace(/\s{2,}/g, " "),
      cantidad: parseFloat(m[2].replace(",", ".")),
      unidad: m[3],
      precio_unitario_neto: parseFloat(m[4].replace(",", ".")),
      subtotal_neto: parseFloat(m[5].replace(",", ".")),
      iva_pct: parseFloat(m[6].replace(",", ".")),
      subtotal_con_iva: parseFloat(m[7].replace(",", ".")),
    });
  }
  return items;
}

function extraerFecha(texto) {
  const m = texto.match(/Fecha:\s*(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function extraerTotal(texto) {
  const m = texto.match(/Total:\s*U?\$?S?\s*\$?\s*([\d.,]+)/i);
  return m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) || parseFloat(m[1]) : null;
}

// ---------------------------------------------------------------------------
// Registro de parsers por proveedor. Cada uno sabe detectar su propia
// factura (por nombre/CUIT) y tiene su propia lógica si la tabla genérica
// no le sirve. Para sumar un proveedor nuevo: agregar un objeto acá.
// ---------------------------------------------------------------------------
export const PARSERS = [
  {
    id: "agroempresa_maquinas",
    nombre: "Agroempresa Máquinas Agrícolas",
    detectar: (texto) => /AGROEMPRESA MAQUINAS AGRICOLAS/i.test(texto),
    parsear: (texto) => ({
      proveedor: "Agroempresa Máquinas Agrícolas",
      fecha: extraerFecha(texto),
      moneda: /DOLARES/i.test(texto) ? "USD" : "ARS",
      total: extraerTotal(texto),
      items: parsearTablaGenerica(texto),
    }),
  },
];

export function parsearFactura(texto) {
  const parser = PARSERS.find((p) => p.detectar(texto));
  if (parser) {
    return { ...parser.parsear(texto), proveedorDetectado: parser.nombre, generico: false };
  }
  // Sin proveedor conocido: probamos igual la tabla genérica y avisamos que es un intento best-effort.
  return {
    proveedor: "",
    fecha: extraerFecha(texto),
    moneda: /DOLARES|U\$S|USD/i.test(texto) ? "USD" : "ARS",
    total: extraerTotal(texto),
    items: parsearTablaGenerica(texto),
    proveedorDetectado: null,
    generico: true,
  };
}

export async function extraerFactura(file) {
  const texto = await extraerTextoPDF(file);
  const resultado = parsearFactura(texto);
  return { ...resultado, textoDebug: texto };
}
