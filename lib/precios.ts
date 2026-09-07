/**
 * Redondea hacia arriba al multiplo de 50 mas cercano.
 *
 * El epsilon absorbe el ruido de coma flotante del margen derivado: sin el,
 * 1666 x 1.320528 = 2199.99965 sube a 2200 pero 2200.0000001 saltaria a 2250.
 */
export function redondear50(v: number): number {
  return Math.ceil((v - 1e-6) / 50) * 50
}

export type TipoGanancia = 'PORCENTAJE' | 'PESOS'

/**
 * Lo que se le gana a un producto.
 *
 * Dos formas, porque no todo se cobra igual: la fruta se maneja por porcentaje,
 * pero a un jabon o a un cafe se le gana una cantidad fija sin importar cuanto
 * suba el proveedor.
 */
export interface Ganancia {
  tipo: TipoGanancia
  /** Multiplicador cuando el tipo es PORCENTAJE: 1.30 es ganarle el 30%. */
  margen: number
  /** Pesos fijos sobre el costo cuando el tipo es PESOS. */
  pesos: number | null
}

/** Precio de venta a partir del costo y de lo que se le gana al producto. */
export function calcularVenta(costo: number, ganancia: Ganancia): number {
  if (ganancia.tipo === 'PESOS' && ganancia.pesos != null) {
    return redondear50(costo + ganancia.pesos)
  }
  return redondear50(costo * ganancia.margen)
}

/**
 * La ganancia que explica un par costo/venta.
 *
 * Se usa cuando se corrige la venta a mano: si no, quedaria guardada la ganancia
 * vieja y la siguiente lista volveria a subir el precio deshaciendo la correccion.
 */
export function gananciaDesde(costo: number, venta: number, tipo: TipoGanancia): Ganancia {
  if (tipo === 'PESOS') return { tipo, margen: 1.3, pesos: Math.round(venta - costo) }
  // Un costo en cero no permite deducir porcentaje: se conserva el 1.30 de siempre.
  return { tipo, margen: costo > 0 ? Number((venta / costo).toFixed(6)) : 1.3, pesos: null }
}

/** El porcentaje que se le gana, para mostrarlo como lo piensa el usuario. */
export function porcentajeDe(margen: number): number {
  return Math.round((margen - 1) * 100)
}

/**
 * true si con esa ganancia el producto se vende igual o por debajo de lo que
 * cuesta. Es facil de teclear por error (un 3 en vez de un 30) y no avisa nadie.
 */
export function esPerdida(costo: number | null, ganancia: Ganancia): boolean {
  if (costo == null || costo <= 0) return false
  return calcularVenta(costo, ganancia) <= costo
}

/** Etiqueta corta: "+30%" o "+$900". */
export function describirGanancia(ganancia: Ganancia): string {
  if (ganancia.tipo === 'PESOS' && ganancia.pesos != null) return `+${cop(ganancia.pesos)}`
  return `+${porcentajeDe(ganancia.margen)}%`
}

/** Formato de pesos colombianos para pantalla. */
export function cop(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  return '$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(v))
}

/**
 * Interpreta un numero escrito como llega en WhatsApp.
 * "4.000" y "4,000" -> 4000 (separador de miles)
 * "1666,67" -> 1666.67 (decimal)
 * "4000" -> 4000
 */
export function parseNumero(raw: string): number | null {
  if (!raw) return null
  let s = raw.replace(/\s/g, '')
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '')
  else if (/^\d+[.,]\d{1,2}$/.test(s)) s = s.replace(',', '.')
  else s = s.replace(/[.,]/g, '')
  const n = Number.parseFloat(s)
  return Number.isNaN(n) ? null : n
}
