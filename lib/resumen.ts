/**
 * El resumen de una compra, en texto listo para pegar en WhatsApp.
 *
 * Lo mas sencillo de leer de un vistazo: lo que subio en rojo, lo que bajo en
 * verde, cada producto en una linea con su precio de compra antes y ahora. Solo
 * entra lo que cambio: si la guayaba salio al precio de siempre no aparece.
 */
import type { Unidad } from '@prisma/client'
import { cop } from './precios'

export interface CambioResumen {
  nombre: string
  /** La unidad en que se anoto la compra: el precio sale en esa misma unidad. */
  unidad: Unidad | null
  /** Como se guarda: por kilo si es de peso (la libra ya va x2), o por unidad. */
  costoAntes: number | null
  costoDespues: number | null
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const ETIQUETA: Record<Unidad, string> = {
  KG: 'kg',
  LB: 'lb',
  UNIDAD: 'c/u',
  PAQUETE: 'paquete',
  BULTO: 'bulto',
}

/**
 * "15 oct". Se arma a mano y no con toLocaleDateString: segun el celular sale
 * "15 oct.", "15 de oct" u otra variante, y el mensaje no debe depender de eso.
 */
export function fechaCorta(fecha: Date): string {
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}`
}

/** Si cambio el precio de compra, que es lo unico que lleva el mensaje. */
export function cambioDePrecio(c: CambioResumen): boolean {
  return c.costoDespues != null && c.costoAntes !== c.costoDespues
}

/**
 * El precio en la unidad en que se anoto. Se guarda por kilo, asi que si se
 * compro por libra se parte en dos: se ve lo mismo que se pago en la plaza.
 */
function enSuUnidad(valor: number, unidad: Unidad | null): number {
  return unidad === 'LB' ? Math.round(valor / 2) : valor
}

/** "Guayaba (kg): $3.000 → $4.000", o sin flecha si es nuevo. */
function linea(c: CambioResumen): string {
  const nombre = c.unidad ? `${c.nombre} (${ETIQUETA[c.unidad]})` : c.nombre
  const ahora = cop(enSuUnidad(c.costoDespues as number, c.unidad))
  if (c.costoAntes == null) return `${nombre}: ${ahora}`
  return `${nombre}: ${cop(enSuUnidad(c.costoAntes, c.unidad))} → ${ahora}`
}

/**
 * El texto completo, agrupado. Los grupos vacios no salen.
 *
 *   🛒 *Compras 15 oct*
 *
 *   🔴 *Subieron*
 *   Guayaba (kg): $3.000 → $4.000
 *
 *   🟢 *Bajaron*
 *   Granadilla (c/u): $1.600 → $1.500
 */
export function armarResumen(fecha: Date, cambios: CambioResumen[]): string {
  const titulo = `🛒 *Compras ${fechaCorta(fecha)}*`
  const cambiados = cambios.filter(cambioDePrecio)
  if (cambiados.length === 0) return `${titulo}\n\nNingún precio cambió.`

  const grupos: [string, CambioResumen[]][] = [
    ['🔴 *Subieron*', cambiados.filter((c) => c.costoAntes != null && c.costoDespues! > c.costoAntes)],
    ['🟢 *Bajaron*', cambiados.filter((c) => c.costoAntes != null && c.costoDespues! < c.costoAntes)],
    ['🆕 *Nuevos*', cambiados.filter((c) => c.costoAntes == null)],
  ]

  const bloques = grupos
    .filter(([, xs]) => xs.length > 0)
    .map(([encabezado, xs]) => [encabezado, ...xs.map(linea)].join('\n'))

  return [titulo, ...bloques].join('\n\n')
}
