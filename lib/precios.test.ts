import { describe, expect, it } from 'vitest'
import {
  calcularVenta,
  describirGanancia,
  esPerdida,
  gananciaDesde,
  porcentajeDe,
  redondear50,
  type Ganancia,
} from './precios'

const porcentaje = (margen: number): Ganancia => ({ tipo: 'PORCENTAJE', margen, pesos: null })
const pesos = (p: number): Ganancia => ({ tipo: 'PESOS', margen: 1.3, pesos: p })

describe('calcularVenta por porcentaje', () => {
  it('aplica el margen y redondea a 50', () => {
    expect(calcularVenta(4000, porcentaje(1.3))).toBe(5200)
    expect(calcularVenta(2200, porcentaje(1.3))).toBe(2900) // 2860 -> 2900
  })

  it('respeta el margen propio de cada producto', () => {
    expect(calcularVenta(4000, porcentaje(1.25))).toBe(5000)
    expect(calcularVenta(4000, porcentaje(1.2))).toBe(4800)
  })
})

describe('calcularVenta por pesos fijos', () => {
  it('suma los pesos al costo', () => {
    expect(calcularVenta(2840, pesos(660))).toBe(3500)
  })

  it('la ganancia no cambia aunque suba el costo', () => {
    // Es justo lo que distingue este modo del porcentaje.
    expect(calcularVenta(2000, pesos(500)) - 2000).toBe(500)
    expect(calcularVenta(10000, pesos(500)) - 10000).toBe(500)
  })

  it('sin pesos definidos cae al porcentaje', () => {
    expect(calcularVenta(4000, { tipo: 'PESOS', margen: 1.3, pesos: null })).toBe(5200)
  })
})

describe('gananciaDesde', () => {
  it('deduce el porcentaje de una venta corregida a mano', () => {
    // Si no se guardara, la proxima lista volveria a subir el precio.
    const g = gananciaDesde(4000, 5000, 'PORCENTAJE')
    expect(g.margen).toBe(1.25)
    expect(calcularVenta(4000, g)).toBe(5000)
  })

  it('deduce los pesos de una venta corregida a mano', () => {
    const g = gananciaDesde(2840, 3500, 'PESOS')
    expect(g.pesos).toBe(660)
  })

  it('con costo en cero conserva el 1.30 en vez de dividir por cero', () => {
    expect(gananciaDesde(0, 5000, 'PORCENTAJE').margen).toBe(1.3)
  })
})

describe('como se muestra', () => {
  it('el porcentaje se lee como lo piensa el usuario', () => {
    expect(porcentajeDe(1.3)).toBe(30)
    expect(porcentajeDe(1.25)).toBe(25)
    expect(describirGanancia(porcentaje(1.3))).toBe('+30%')
  })

  it('los pesos se muestran en pesos', () => {
    expect(describirGanancia(pesos(900))).toBe('+$900')
  })
})

describe('redondear50', () => {
  it('sube al siguiente multiplo de 50', () => {
    expect(redondear50(2860)).toBe(2900)
    expect(redondear50(3900)).toBe(3900)
  })
})

describe('esPerdida', () => {
  it('avisa cuando la venta no cubre el costo', () => {
    // Dejar la ganancia en cero, o por debajo al corregir una venta a mano.
    expect(esPerdida(4000, porcentaje(1))).toBe(true)
    expect(esPerdida(4000, porcentaje(0.875))).toBe(true)
    expect(esPerdida(4000, pesos(0))).toBe(true)
  })

  it('no avisa cuando si se gana, aunque sea poco', () => {
    // 4000 x 1.03 = 4120, que redondeado a 50 son 4150: flaco, pero gana.
    expect(esPerdida(4000, porcentaje(1.03))).toBe(false)
    expect(esPerdida(4000, porcentaje(1.3))).toBe(false)
    expect(esPerdida(4000, pesos(500))).toBe(false)
  })

  it('sin costo no puede saberse', () => {
    expect(esPerdida(null, porcentaje(1.3))).toBe(false)
    expect(esPerdida(0, porcentaje(1.3))).toBe(false)
  })
})
