/**
 * El resumen de una compra, en texto listo para pegar en WhatsApp.
 *
 * Es para el socio o para las cuentas, asi que lleva compra y venta con el
 * antes -> despues. Solo entra lo que cambio de precio: si la guayaba salio al
 * mismo precio de siempre no aparece, y el mensaje dice justo lo que se movio.
 */
import { cop } from './precios'

export interface CambioResumen {
  nombre: string
  costoAntes: number | null
  costoDespues: number | null
  ventaAntes: number | null
  ventaDespues: number | null
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * "15 oct". Se arma a mano y no con toLocaleDateString: segun el celular sale
 * "15 oct.", "15 de oct" u otra variante, y el mensaje no debe depender de eso.
 */
export function fechaCorta(fecha: Date): string {
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}`
}

/** Si cambio algo: la compra o la venta. */
export function cambioDePrecio(c: CambioResumen): boolean {
  return c.costoAntes !== c.costoDespues || c.ventaAntes !== c.ventaDespues
}

/** "$3.000 → $4.000", "$4.000 (igual)" o, si antes no tenia precio, "nuevo $4.000". */
function tramo(antes: number | null, despues: number | null): string {
  if (antes == null) return `nuevo ${cop(despues)}`
  if (antes === despues) return `${cop(despues)} (igual)`
  return `${cop(antes)} → ${cop(despues)}`
}

function flecha(antes: number | null, despues: number | null): string {
  if (antes == null || despues == null || antes === despues) return ''
  return despues > antes ? ' ↑' : ' ↓'
}

/**
 * El texto completo. La flecha va con la compra, que es lo que cambio en la
 * plaza; la venta es la consecuencia.
 *
 *   🛒 *Compras 15 oct*
 *
 *   Guayaba  $3.000 → $4.000 ↑
 *      venta $3.900 → $5.200
 *
 *   _1 precio cambió_
 */
export function armarResumen(fecha: Date, cambios: CambioResumen[]): string {
  const cambiados = cambios.filter(cambioDePrecio)
  const titulo = `🛒 *Compras ${fechaCorta(fecha)}*`

  if (cambiados.length === 0) return `${titulo}\n\nNingún precio cambió.`

  const lineas = cambiados.flatMap((c) => {
    const compra = `${c.nombre}  ${tramo(c.costoAntes, c.costoDespues)}${flecha(c.costoAntes, c.costoDespues)}`
    if (c.ventaDespues == null) return [compra]
    return [compra, `   venta ${tramo(c.ventaAntes, c.ventaDespues)}`]
  })

  const n = cambiados.length
  const pie = n === 1 ? '_1 precio cambió_' : `_${n} precios cambiaron_`
  return [titulo, '', ...lineas, '', pie].join('\n')
}
