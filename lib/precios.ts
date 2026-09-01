/**
 * Redondea hacia arriba al multiplo de 50 mas cercano.
 *
 * El epsilon absorbe el ruido de coma flotante del margen derivado: sin el,
 * 1666 x 1.320528 = 2199.99965 sube a 2200 pero 2200.0000001 saltaria a 2250.
 */
export function redondear50(v: number): number {
  return Math.ceil((v - 1e-6) / 50) * 50
}

/** Precio de venta a partir del costo y el margen propio del producto. */
export function calcularVenta(costo: number, margen: number): number {
  return redondear50(costo * margen)
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
