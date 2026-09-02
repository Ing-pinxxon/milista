import { describe, expect, it } from 'vitest'
import { sugerirCompras } from './compras'
import { costoNormalizado } from './tipos-compras'
import type { ProductoConPrecio } from './consultas'

const AHORA = new Date('2026-09-10T12:00:00Z')
const haceDias = (d: number) => new Date(AHORA.getTime() - d * 86400000).toISOString()

function producto(over: Partial<ProductoConPrecio> = {}): ProductoConPrecio {
  return {
    id: 'p',
    nombre: 'Guayaba',
    slug: 'guayaba',
    unidad: 'KG',
    margen: 1.3,
    aliases: [],
    orden: 0,
    disponible: true,
    costoActual: 3000,
    ventaActual: 3900,
    fechaPrecio: haceDias(0),
    origenPrecio: 'LISTA',
    ...over,
  }
}

describe('sugerirCompras', () => {
  it('sugiere lo que esta marcado sin existencia', () => {
    const s = sugerirCompras([producto({ disponible: false })], AHORA)
    expect(s).toHaveLength(1)
    expect(s[0].motivo).toBe('sin-existencia')
  })

  it('sugiere lo que lleva dias sin precio nuevo', () => {
    const s = sugerirCompras([producto({ fechaPrecio: haceDias(5) })], AHORA)
    expect(s[0].motivo).toBe('sin-actualizar')
  })

  it('no sugiere lo que se actualizo hoy', () => {
    expect(sugerirCompras([producto({ fechaPrecio: haceDias(0) })], AHORA)).toHaveLength(0)
  })

  it('sin existencia manda aunque el precio sea de hoy', () => {
    // El proveedor ya dijo que no hay: eso pesa mas que la fecha.
    const s = sugerirCompras([producto({ disponible: false, fechaPrecio: haceDias(0) })], AHORA)
    expect(s[0].motivo).toBe('sin-existencia')
  })

  it('ignora los productos que nunca han tenido precio', () => {
    // Las lineas en blanco de la hoja (arroces, platos) no son cosas que se compren.
    const vacio = producto({ ventaActual: null, costoActual: null, fechaPrecio: null })
    expect(sugerirCompras([vacio], AHORA)).toHaveLength(0)
  })

  it('respeta el orden de la hoja de calculo', () => {
    const s = sugerirCompras(
      [
        producto({ id: 'c', orden: 9, disponible: false }),
        producto({ id: 'a', orden: 1, disponible: false }),
        producto({ id: 'b', orden: 5, disponible: false }),
      ],
      AHORA,
    )
    expect(s.map((x) => x.producto.id)).toEqual(['a', 'b', 'c'])
  })

  it('el umbral de dias es configurable', () => {
    const p = producto({ fechaPrecio: haceDias(2) })
    expect(sugerirCompras([p], AHORA, 3)).toHaveLength(0)
    expect(sugerirCompras([p], AHORA, 1)).toHaveLength(1)
  })
})

describe('costoNormalizado', () => {
  it('la libra se guarda por kilo', () => {
    // En la plaza la mora se compra por libra; en la base todo va por kilo.
    expect(costoNormalizado(3600, 'LB')).toBe(7200)
  })

  it('el kilo se guarda tal cual', () => {
    expect(costoNormalizado(16000, 'KG')).toBe(16000)
  })

  it('lo que se vende suelto no se convierte', () => {
    expect(costoNormalizado(1666, 'UNIDAD')).toBe(1666)
    expect(costoNormalizado(125000, 'BULTO')).toBe(125000)
  })

  it('sin unidad se toma como esta', () => {
    expect(costoNormalizado(4000, null)).toBe(4000)
  })
})
