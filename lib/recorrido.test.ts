import { describe, expect, it } from 'vitest'
import {
  compararRecorrido,
  destinoPorCentros,
  moverEnRuta,
  moverItem,
  ordenDeLista,
  rangosDe,
  renglonListo,
  rutaDe,
} from './recorrido'

/** Generador pseudoaleatorio con semilla, para que una falla se pueda repetir. */
function azar(semilla: number) {
  let s = semilla >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const restringir = (ruta: string[], conjunto: Set<string>) => ruta.filter((x) => conjunto.has(x))

describe('rutaDe', () => {
  it('lo ordenado va primero, en su puesto; lo demas despues, por la hoja', () => {
    expect(
      rutaDe([
        { id: 'a', orden: 0, ordenCompra: null },
        { id: 'b', orden: 1, ordenCompra: 1 },
        { id: 'c', orden: 2, ordenCompra: 0 },
        { id: 'd', orden: 3, ordenCompra: null },
      ]),
    ).toEqual(['c', 'b', 'a', 'd'])
  })

  it('con puestos repetidos (datos viejos) el orden sigue siendo uno solo', () => {
    // Asi quedaba la base despues de cerrar una lista: dos productos en el puesto 0.
    const productos = [
      { id: 'criolla', orden: 64, ordenCompra: 0 },
      { id: 'brocoli', orden: 0, ordenCompra: 0 },
      { id: 'mora', orden: 16, ordenCompra: 1 },
      { id: 'apio', orden: 1, ordenCompra: 1 },
    ]
    const r1 = rutaDe(productos)
    const r2 = rutaDe([...productos].reverse())
    expect(r1).toEqual(r2)
    expect(r1).toEqual(['brocoli', 'criolla', 'apio', 'mora'])
  })

  it('compararRecorrido es un orden total', () => {
    const a = { id: 'a', orden: 1, ordenCompra: 3 }
    const b = { id: 'b', orden: 1, ordenCompra: 3 }
    expect(compararRecorrido(a, b)).toBeLessThan(0)
    expect(compararRecorrido(b, a)).toBeGreaterThan(0)
    expect(compararRecorrido(a, a)).toBe(0)
  })
})

describe('moverEnRuta — mover uno no cambia a los demas', () => {
  it('ejemplo concreto: subir Mora en la lista', () => {
    const ruta = ['brocoli', 'criolla', 'apio', 'mora', 'habichuela', 'lulo']
    // En pantalla solo estan tres; Mora sube al primer puesto.
    const vista = ['criolla', 'mora', 'habichuela']
    const nueva = moverEnRuta(ruta, vista, 1, 0)
    expect(restringir(nueva, new Set(vista))).toEqual(['mora', 'criolla', 'habichuela'])
    // Lo que no estaba en pantalla no se movio entre si.
    expect(restringir(nueva, new Set(['brocoli', 'apio', 'lulo']))).toEqual(['brocoli', 'apio', 'lulo'])
  })

  it('bajar al ultimo puesto de la vista', () => {
    const ruta = ['a', 'b', 'c', 'd', 'e']
    const vista = ['a', 'c', 'e']
    const nueva = moverEnRuta(ruta, vista, 0, 2)
    expect(restringir(nueva, new Set(vista))).toEqual(['c', 'e', 'a'])
    expect(restringir(nueva, new Set(['b', 'd']))).toEqual(['b', 'd'])
  })

  it('soltarlo en su mismo puesto no cambia nada', () => {
    const ruta = ['a', 'b', 'c']
    expect(moverEnRuta(ruta, ruta, 1, 1)).toBe(ruta)
  })

  it('propiedad, 5.000 casos al azar: la vista queda como se solto y nada mas se mueve', () => {
    const r = azar(20261010)
    for (let caso = 0; caso < 5000; caso++) {
      const n = 1 + Math.floor(r() * 30)
      const ruta = Array.from({ length: n }, (_, i) => `p${i}`)
      // Barajar el recorrido.
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1))
        ;[ruta[i], ruta[j]] = [ruta[j], ruta[i]]
      }
      // Un subconjunto cualquiera en pantalla, en el orden del recorrido.
      const enVista = new Set(ruta.filter(() => r() < 0.6))
      if (enVista.size === 0) enVista.add(ruta[0])
      const vista = ruta.filter((x) => enVista.has(x))
      const desde = Math.floor(r() * vista.length)
      const hasta = Math.floor(r() * vista.length)

      const nueva = moverEnRuta(ruta, vista, desde, hasta)

      // 1. Sigue siendo el mismo conjunto de productos, sin perder ni repetir.
      expect([...nueva].sort()).toEqual([...ruta].sort())
      // 2. En pantalla queda exactamente donde se solto.
      expect(restringir(nueva, enVista)).toEqual(moverItem(vista, desde, hasta))
      // 3. Ningun otro producto cambio de orden relativo.
      const movido = vista[desde]
      const otros = new Set(ruta.filter((x) => x !== movido))
      expect(restringir(nueva, otros)).toEqual(restringir(ruta, otros))
    }
  })
})

describe('ordenDeLista', () => {
  const rangos = rangosDe(['criolla', 'mora', 'habichuela', 'lulo'])
  const p = (productoId: string, comprado = false, costo: number | null = null) => ({
    productoId,
    comprado,
    costo,
  })
  const nota = (comprado = false) => ({ productoId: null, comprado, costo: null })

  it('los productos van en el orden del recorrido, no en el que se anotaron', () => {
    const items = [p('lulo'), p('criolla'), p('habichuela')]
    const { indices } = ordenDeLista(items, rangos, false)
    expect(indices.map((i) => items[i].productoId)).toEqual(['criolla', 'habichuela', 'lulo'])
  })

  it('lo que se añade cae en su puesto sin tener que arrastrarlo', () => {
    const items = [p('criolla'), p('habichuela'), p('mora')] // Mora se añadio de ultima
    const { indices } = ordenDeLista(items, rangos, false)
    expect(indices.map((i) => items[i].productoId)).toEqual(['criolla', 'mora', 'habichuela'])
  })

  it('las notas sueltas van despues de los productos y no se arrastran', () => {
    const items = [nota(), p('mora'), p('criolla')]
    const r = ordenDeLista(items, rangos, false)
    expect(r.indices).toEqual([2, 1, 0])
    expect(r.arrastrables).toBe(2)
  })

  it('comprando, lo resuelto baja al final y deja de arrastrarse', () => {
    const items = [p('criolla', true, 7000), p('mora'), p('habichuela', true, null), nota(true)]
    const r = ordenDeLista(items, rangos, true)
    // Mora y Habichuela (chuleada sin precio todavia) siguen arriba; lo resuelto, abajo.
    expect(r.indices.map((i) => items[i].productoId)).toEqual(['mora', 'habichuela', 'criolla', null])
    expect(r.arrastrables).toBe(2)
  })

  it('un producto que no esta en el recorrido va al final de los productos', () => {
    const items = [p('nuevo'), p('lulo')]
    const { indices } = ordenDeLista(items, rangos, false)
    expect(indices.map((i) => items[i].productoId)).toEqual(['lulo', 'nuevo'])
  })
})

describe('renglonListo', () => {
  it('un producto chuleado sin precio no esta listo', () => {
    expect(renglonListo({ productoId: 'p', comprado: true, costo: null })).toBe(false)
  })
  it('con precio si', () => {
    expect(renglonListo({ productoId: 'p', comprado: true, costo: 1 })).toBe(true)
  })
  it('una nota basta con chulearla', () => {
    expect(renglonListo({ productoId: null, comprado: true, costo: null })).toBe(true)
  })
})

describe('destinoPorCentros — cae donde se suelta', () => {
  /**
   * Renglones de 50 px con 6 px de espacio entre ellos: como en pantalla.
   * El metodo viejo sumaba solo los 50 px y se corria un puesto cada ~7 renglones.
   */
  const ALTO = 50
  const ESPACIO = 6
  const centros = Array.from({ length: 40 }, (_, i) => i * (ALTO + ESPACIO) + ALTO / 2)

  it('soltar el centro sobre el centro de otro renglon lo deja en ese puesto', () => {
    for (const desde of [0, 1, 5, 12, 30, 39]) {
      for (const hasta of [0, 2, 7, 15, 25, 39]) {
        // Apenas pasado el centro del destino en la direccion del movimiento.
        const ajuste = hasta > desde ? 1 : hasta < desde ? -1 : 0
        expect(destinoPorCentros(centros, desde, centros[hasta] + ajuste, 40)).toBe(hasta)
      }
    }
  })

  it('el caso que fallaba: del puesto 2 al 10', () => {
    expect(destinoPorCentros(centros, 1, centros[9] + 1, 40)).toBe(9)
  })

  it('con el centro EXACTO encima de otro, toma su puesto: subiendo y bajando', () => {
    // Asi se suelta en la vida real. Una version anterior, bajando, lo dejaba un
    // puesto corto por resolver el empate al reves; el test de arriba no lo veia
    // porque soltaba un pixel pasado.
    for (const desde of [0, 1, 5, 12, 30, 39]) {
      for (const hasta of [0, 2, 7, 15, 25, 39]) {
        expect(destinoPorCentros(centros, desde, centros[hasta], 40)).toBe(hasta)
      }
    }
  })

  it('es simetrico: llegar a la mitad del camino no basta', () => {
    const mitad = (centros[5] + centros[6]) / 2
    expect(destinoPorCentros(centros, 5, mitad, 40)).toBe(5)
    expect(destinoPorCentros(centros, 6, mitad, 40)).toBe(6)
  })

  it('no se sale de los renglones arrastrables', () => {
    // Solo los 10 primeros se arrastran: aunque se suelte mas abajo, cae en el 10.
    expect(destinoPorCentros(centros, 3, centros[30], 10)).toBe(9)
    expect(destinoPorCentros(centros, 3, -500, 10)).toBe(0)
  })

  it('moverlo un poquito no lo cambia de puesto', () => {
    expect(destinoPorCentros(centros, 5, centros[5] + 20, 40)).toBe(5)
    expect(destinoPorCentros(centros, 5, centros[5] - 20, 40)).toBe(5)
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
