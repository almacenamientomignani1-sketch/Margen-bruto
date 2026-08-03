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
// Extracción de texto crudo, reconstruyendo líneas por posición (Y) para
// que las columnas de una tabla queden en el mismo renglón de texto.
// ---------------------------------------------------------------------------
async function extraerLineasPDF(file) {
  const pdfjsLib = await cargarPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lineas = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], y: i.transform[5], str: i.str }));

    items.sort((a, b) => b.y - a.y || a.x - b.x);

    let actual = null;
    const filas = [];
    for (const it of items) {
      if (!actual || Math.abs(actual.y - it.y) > 1.2) {
        actual = { y: it.y, items: [] };
        filas.push(actual);
      }
      actual.items.push(it);
    }
    for (const fila of filas) {
      const linea = fila.items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (linea) lineas.push(linea);
    }
  }
  return lineas;
}


// ---------------------------------------------------------------------------
// Parser genérico de tabla de ítems: busca líneas que terminen con el patrón
// cantidad / unidad / precio / subtotal / iva% / subtotal con iva
// ---------------------------------------------------------------------------
const PATRON_ITEM =
  /^(.+?)\s+([\d]+(?:[.,]\d+)?)\s+(Unidades|Litros?|Kilogramos|Kg|Bolsas|Lts?|Metros|Rollos)\s+([\d]+(?:[.,]\d+)?)\s+([\d]+(?:[.,]\d+)?)\s+([\d]+(?:[.,]\d+)?)\s*%\s+([\d]+(?:[.,]\d+)?)$/i;

function parsearTablaGenerica(lineas) {
  const items = [];
  let arrastre = "";
  for (const linea of lineas) {
    const m = linea.match(PATRON_ITEM);
    if (m) {
      const producto = `${arrastre} ${m[1]}`.trim();
      items.push({
        producto,
        cantidad: parseFloat(m[2].replace(",", ".")),
        unidad: m[3],
        precio_unitario_neto: parseFloat(m[4].replace(",", ".")),
        subtotal_neto: parseFloat(m[5].replace(",", ".")),
        iva_pct: parseFloat(m[6].replace(",", ".")),
        subtotal_con_iva: parseFloat(m[7].replace(",", ".")),
      });
      arrastre = "";
    } else if (
      linea.length < 45 &&
      !/factura|cuit|fecha|total|iva|neto|cond\.|moneda|pedido|domicilio|lugar de pago/i.test(linea)
    ) {
      // posible primera mitad de una descripción partida en dos líneas
      arrastre = linea;
    } else {
      arrastre = "";
    }
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
    parsear: (texto, lineas) => ({
      proveedor: "Agroempresa Máquinas Agrícolas",
      fecha: extraerFecha(texto),
      moneda: /DOLARES/i.test(texto) ? "USD" : "ARS",
      total: extraerTotal(texto),
      items: parsearTablaGenerica(lineas),
    }),
  },
];

export function parsearFactura(texto, lineas) {
  const parser = PARSERS.find((p) => p.detectar(texto));
  if (parser) {
    return { ...parser.parsear(texto, lineas), proveedorDetectado: parser.nombre, generico: false };
  }
  // Sin proveedor conocido: probamos igual la tabla genérica y avisamos que es un intento best-effort.
  return {
    proveedor: "",
    fecha: extraerFecha(texto),
    moneda: /DOLARES|U\$S|USD/i.test(texto) ? "USD" : "ARS",
    total: extraerTotal(texto),
    items: parsearTablaGenerica(lineas),
    proveedorDetectado: null,
    generico: true,
  };
}

export async function extraerFactura(file) {
  const lineas = await extraerLineasPDF(file);
  const texto = lineas.join("\n");
  return parsearFactura(texto, lineas);
}
