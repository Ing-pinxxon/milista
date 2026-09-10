import { describe, expect, it } from 'vitest'
import { estaListo, moverItem, ordenParaMostrar, sugerirCompras } from './compras'
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
    tipoGanancia: 'PORCENTAJE',
    margen: 1.3,
    gananciaPesos: null,
    aliases: [],
    orden: 0,
    ordenCompra: null,
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

describe('el orden del recorrido por la plaza', () => {
  it('lo ya comprado antes va en el orden en que se compro, no en el de la hoja', () => {
    const s = sugerirCompras(
      [
        producto({ id: 'hoja-primero', orden: 0, ordenCompra: 2, disponible: false }),
        producto({ id: 'hoja-ultimo', orden: 9, ordenCompra: 0, disponible: false }),
        producto({ id: 'hoja-medio', orden: 5, ordenCompra: 1, disponible: false }),
      ],
      AHORA,
    )
    expect(s.map((x) => x.producto.id)).toEqual(['hoja-ultimo', 'hoja-medio', 'hoja-primero'])
  })

  it('lo que nunca se ha comprado va al final, en el orden de la hoja', () => {
    const s = sugerirCompras(
      [
        producto({ id: 'nuevo-b', orden: 8, ordenCompra: null, disponible: false }),
        producto({ id: 'conocido', orden: 9, ordenCompra: 0, disponible: false }),
        producto({ id: 'nuevo-a', orden: 3, ordenCompra: null, disponible: false }),
      ],
      AHORA,
    )
    expect(s.map((x) => x.producto.id)).toEqual(['conocido', 'nuevo-a', 'nuevo-b'])
  })
})

describe('estaListo', () => {
  it('un producto chuleado sin precio todavia no esta listo', () => {
    // Si bajara aqui, el campo del precio se iria de debajo del dedo.
    expect(estaListo({ productoId: 'p', comprado: true, costo: null })).toBe(false)
  })

  it('un producto chuleado y con precio si', () => {
    expect(estaListo({ productoId: 'p', comprado: true, costo: 3000 })).toBe(true)
  })

  it('una nota suelta basta con chulearla', () => {
    expect(estaListo({ productoId: null, comprado: true, costo: null })).toBe(true)
  })

  it('sin chulear nunca esta listo', () => {
    expect(estaListo({ productoId: 'p', comprado: false, costo: 3000 })).toBe(false)
  })
})

describe('ordenParaMostrar', () => {
  const r = (comprado: boolean, costo: number | null = null) => ({
    productoId: 'p',
    comprado,
    costo,
  })

  it('lo resuelto baja al final y lo pendiente sube', () => {
    const items = [r(true, 100), r(false), r(true, 200), r(false)]
    expect(ordenParaMostrar(items)).toEqual([1, 3, 0, 2])
  })

  it('conserva el orden del recorrido dentro de cada grupo', () => {
    const items = [r(true, 1), r(true, 2), r(false), r(true, 3)]
    // Los resueltos mantienen 0, 1, 3 entre ellos.
    expect(ordenParaMostrar(items)).toEqual([2, 0, 1, 3])
  })

  it('un chuleado sin precio no baja', () => {
    const items = [r(true, null), r(false)]
    expect(ordenParaMostrar(items)).toEqual([0, 1])
  })
})

describe('moverItem', () => {
  it('mueve hacia abajo conservando el resto', () => {
    expect(moverItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('mueve hacia arriba', () => {
    expect(moverItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('moverlo a su mismo puesto no cambia nada', () => {
    const xs = ['a', 'b', 'c']
    expect(moverItem(xs, 1, 1)).toBe(xs)
  })

  it('no se sale del arreglo', () => {
    expect(moverItem(['a', 'b'], 0, 99)).toEqual(['b', 'a'])
    expect(moverItem(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
  })
})
