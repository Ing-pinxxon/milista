/**
 * Parser de la lista diaria de WhatsApp.
 *
 * Funcion pura: no toca React ni Prisma. Recibe el texto crudo y el catalogo,
 * y devuelve lo que se le va a proponer al usuario en la pantalla de revision.
 * Quien escribe en la base es la API route, nunca este archivo.
 */
import { limpiarNombre, normalizar } from './normalizar'
import { calcularVenta, parseNumero } from './precios'

export type UnidadProducto = 'KG' | 'LB' | 'UNIDAD' | 'PAQUETE' | 'BULTO'
export type UnidadDetectada = 'kg' | 'lb' | 'unidad'
export type Confianza = 'alias' | 'exacto' | 'contenido' | 'difuso' | 'ninguno'

export interface ProductoCatalogo {
  id: string
  nombre: string
  slug: string
  unidad: UnidadProducto | null
  margen: number
  aliases: string[]
  costoActual: number | null
  ventaActual: number | null
  disponible: boolean
}

export interface EstadoPrecio {
  costo: number | null
  venta: number | null
  disponible: boolean
}

export interface CambioPropuesto {
  /** La linea original, para mostrarla en la revision. */
  raw: string
  /** El texto del que se dedujo el producto ("tomate grueso"). */
  textoDetectado: string
  producto: ProductoCatalogo
  confianza: Confianza
  antes: EstadoPrecio
  despues: EstadoPrecio
  hayCambio: boolean
  /** true si el precio vino de "vender 3200" y no del margen. */
  ventaEsExplicita: boolean
  unidadDetectada: UnidadDetectada | null
  /** true si el costo se multiplico x2 por venir en libras. */
  convertidoDeLibra: boolean
}

export interface NoReconocido {
  raw: string
  textoDetectado: string
  valor: number | null
  unidadDetectada: UnidadDetectada | null
  disponible: boolean
}

export interface ResultadoParse {
  cambios: CambioPropuesto[]
  noReconocidos: NoReconocido[]
}

/** Por debajo de esto un numero es una cantidad ("2 bultos"), no un precio. */
const PRECIO_MINIMO = 100

/** Puntaje minimo para aceptar un emparejamiento difuso. */
const UMBRAL_DIFUSO = 0.5

const RE_AGOTADO = /❌|✗|🚫|⛔|\bno hay\b|\bagotad|\bno vino\b|\bno trajeron\b/i
const RE_MARCAS = /[✅✔❌✗🚫⛔]/g

/** Un numero cuenta como venta solo si "vender"/"venta" lo antecede de cerca. */
const RE_ES_VENTA = /\b(?:vender|venta|vendo|se vende)\b[^0-9]{0,15}$/

const RE_PRECIO =
  /(\d[\d.,]*)\s*(kilos?|kgs?|kg|klos?|k|libras?|lbs?|lb|c\s*\/?\s*u|unds?|unidad(?:es)?|paquetes?|bultos?)?/gi

interface TokenPrecio {
  indice: number
  largo: number
  valor: number | null
  unidad: string
}

interface Segmento {
  raw: string
  texto: string
  valor: number | null
  unidad: string
  esVenta: boolean
  disponible: boolean
}

function clasificarUnidad(u: string): UnidadDetectada | null {
  if (!u) return null
  if (/^(kilos?|kgs?|kg|klos?|k)$/.test(u)) return 'kg'
  if (/^(libras?|lbs?|lb)$/.test(u)) return 'lb'
  return 'unidad'
}

/**
 * Parte una linea en pares nombre+precio. Una sola linea puede traer varios
 * productos: "Tomate parejo 3000kg y grueso 4000kg" son dos.
 */
export function parsearLinea(linea: string): Segmento[] {
  const raw = linea.trim()
  if (!raw) return []

  const disponible = !RE_AGOTADO.test(raw)

  // Las fracciones ("1/2 roba") se quitan antes de buscar precios: si no, el 1 y
  // el 2 se leen como precios y parten la linea donde no toca.
  const t = raw.replace(RE_MARCAS, ' ').replace(/\b\d+\s*\/\s*\d+\b/g, ' ')

  const tokens: TokenPrecio[] = []
  RE_PRECIO.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RE_PRECIO.exec(t)) !== null) {
    if (m[0].trim() === '') {
      RE_PRECIO.lastIndex += 1
      continue
    }
    const valor = parseNumero(m[1])
    // Los numeros pequenos son cantidades, no precios. No parten la linea.
    if (valor == null || valor < PRECIO_MINIMO) continue
    tokens.push({ indice: m.index, largo: m[0].length, valor, unidad: (m[2] || '').toLowerCase() })
  }

  if (tokens.length === 0) {
    const texto = limpiarNombre(t)
    return texto ? [{ raw, texto, valor: null, unidad: '', esVenta: false, disponible }] : []
  }

  const segmentos: Segmento[] = []
  let cursor = 0
  let ultimoNombre = ''

  tokens.forEach((tok, k) => {
    const previo = t.slice(cursor, tok.indice)
    // "vender"/"venta" se evalua por token, no por linea: en
    // "Coliseros 2200kg vender 3200" solo el 3200 es venta.
    const esVenta = RE_ES_VENTA.test(normalizar(previo))

    let texto = limpiarNombre(previo)
    if (!texto && ultimoNombre) texto = ultimoNombre
    // "grueso" hereda la base "tomate" de "Tomate parejo".
    if (texto && k > 0 && ultimoNombre && texto.split(' ').length === 1) {
      const base = ultimoNombre.split(' ')[0]
      if (base && !texto.startsWith(base)) texto = base + ' ' + texto
    }
    if (texto) ultimoNombre = texto
    cursor = tok.indice + tok.largo

    if (texto) {
      segmentos.push({ raw, texto, valor: tok.valor, unidad: tok.unidad, esVenta, disponible })
    }
  })

  return segmentos
}

/** Bigramas de caracteres, para tolerar errores de tipeo. */
function bigramas(s: string): string[] {
  const t = ' ' + s + ' '
  const out: string[] = []
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2))
  return out
}

function dice(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const restantes = [...b]
  let comunes = 0
  for (const x of a) {
    const i = restantes.indexOf(x)
    if (i !== -1) {
      comunes++
      restantes.splice(i, 1)
    }
  }
  return (2 * comunes) / (a.length + b.length)
}

/** Dos palabras cuentan como la misma si una es prefijo de la otra (>= 4 letras). */
function tokensCoinciden(a: string, b: string): boolean {
  if (a === b) return true
  const corto = a.length < b.length ? a : b
  return corto.length >= 4 && (a.startsWith(b) || b.startsWith(a))
}

function dicePalabras(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const restantes = [...b]
  let comunes = 0
  for (const x of a) {
    const i = restantes.findIndex((y) => tokensCoinciden(x, y))
    if (i !== -1) {
      comunes++
      restantes.splice(i, 1)
    }
  }
  return (2 * comunes) / (a.length + b.length)
}

/**
 * Puntaje de similitud entre el texto de la lista y un producto del catalogo.
 * Pesa mas la coincidencia de palabras que la de letras: "papa criolla" debe
 * ganarle a "criolla pareja" cuando el candidato correcto es "Criolla".
 */
function puntuar(q: string, nombre: string): number {
  return 0.7 * dicePalabras(q.split(' '), nombre.split(' ')) + 0.3 * dice(bigramas(q), bigramas(nombre))
}

export interface Emparejamiento {
  producto: ProductoCatalogo
  confianza: Confianza
}

/**
 * Busca el producto del catalogo que corresponde a un texto de la lista.
 *
 * Puntua TODOS los candidatos y se queda con el mejor: el orden del catalogo no
 * debe decidir el resultado. Los empates se rompen de forma determinista por
 * nombre mas corto y luego por id.
 */
export function emparejar(texto: string, catalogo: ProductoCatalogo[]): Emparejamiento | null {
  const q = normalizar(texto)
  if (!q) return null

  // 1. Alias confirmado antes por el usuario: es la respuesta, sin discusion.
  const porAlias = catalogo.find((p) => p.aliases.some((a) => normalizar(a) === q))
  if (porAlias) return { producto: porAlias, confianza: 'alias' }

  // 2. Nombre o slug exacto.
  const exacto = catalogo.find((p) => normalizar(p.nombre) === q || p.slug === q)
  if (exacto) return { producto: exacto, confianza: 'exacto' }

  // 3. El mejor puntaje entre todos.
  const rankeados = catalogo
    .map((producto) => ({ producto, puntaje: puntuar(q, normalizar(producto.nombre)) }))
    .sort(
      (a, b) =>
        b.puntaje - a.puntaje ||
        a.producto.nombre.length - b.producto.nombre.length ||
        a.producto.id.localeCompare(b.producto.id),
    )

  const mejor = rankeados[0]
  if (!mejor || mejor.puntaje < UMBRAL_DIFUSO) return null

  const n = normalizar(mejor.producto.nombre)
  const contenido = q.includes(n) || n.includes(q)
  return { producto: mejor.producto, confianza: contenido ? 'contenido' : 'difuso' }
}

/** Lleva el valor leido a la unidad en la que se guarda: kilo, o la unidad suelta. */
function normalizarCosto(
  valor: number,
  unidadTexto: string,
  producto: ProductoCatalogo,
): { costo: number; convertidoDeLibra: boolean } {
  const detectada = clasificarUnidad(unidadTexto)
  if (detectada === 'lb') return { costo: valor * 2, convertidoDeLibra: true }
  if (detectada === 'kg' || detectada === 'unidad') return { costo: valor, convertidoDeLibra: false }
  // El texto no dijo unidad: el producto decide. Si se maneja en libra, la lista
  // viene en libra aunque no lo diga.
  if (producto.unidad === 'LB') return { costo: valor * 2, convertidoDeLibra: true }
  return { costo: valor, convertidoDeLibra: false }
}

export function parsearLista(texto: string, catalogo: ProductoCatalogo[]): ResultadoParse {
  const segmentos = texto.split('\n').flatMap((l) => parsearLinea(l))

  const porProducto = new Map<string, CambioPropuesto>()
  const noReconocidos: NoReconocido[] = []

  for (const seg of segmentos) {
    const match = emparejar(seg.texto, catalogo)

    if (!match) {
      noReconocidos.push({
        raw: seg.raw,
        textoDetectado: seg.texto,
        valor: seg.valor,
        unidadDetectada: clasificarUnidad(seg.unidad),
        disponible: seg.disponible,
      })
      continue
    }

    const { producto, confianza } = match
    let cambio = porProducto.get(producto.id)

    if (!cambio) {
      const antes: EstadoPrecio = {
        costo: producto.costoActual,
        venta: producto.ventaActual,
        disponible: producto.disponible,
      }
      cambio = {
        raw: seg.raw,
        textoDetectado: seg.texto,
        producto,
        confianza,
        antes,
        despues: { ...antes },
        hayCambio: false,
        ventaEsExplicita: false,
        unidadDetectada: null,
        convertidoDeLibra: false,
      }
      porProducto.set(producto.id, cambio)
    }

    cambio.despues.disponible = seg.disponible

    if (seg.valor != null) {
      if (seg.esVenta) {
        // "vender 3200": el numero es el precio de venta, el costo no se toca.
        cambio.despues.venta = seg.valor
        cambio.ventaEsExplicita = true
      } else if (!cambio.unidadDetectada) {
        const { costo, convertidoDeLibra } = normalizarCosto(seg.valor, seg.unidad, producto)
        cambio.despues.costo = Math.round(costo)
        cambio.unidadDetectada = clasificarUnidad(seg.unidad) ?? (producto.unidad === 'LB' ? 'lb' : 'kg')
        cambio.convertidoDeLibra = convertidoDeLibra
        // La venta explicita manda sobre el margen, venga antes o despues en la linea.
        if (!cambio.ventaEsExplicita) {
          cambio.despues.venta = calcularVenta(cambio.despues.costo, producto.margen)
        }
      }
    }
  }

  const cambios = [...porProducto.values()]
  for (const c of cambios) {
    c.hayCambio =
      c.antes.costo !== c.despues.costo ||
      c.antes.venta !== c.despues.venta ||
      c.antes.disponible !== c.despues.disponible
  }

  return { cambios, noReconocidos }
}
