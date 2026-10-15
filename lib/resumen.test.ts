import { describe, expect, it } from 'vitest'
import { armarResumen, cambioDePrecio, fechaCorta, type CambioResumen } from './resumen'

const HOY = new Date(2026, 9, 15) // 15 de octubre, hora local

const c = (
  nombre: string,
  costoAntes: number | null,
  costoDespues: number | null,
  ventaAntes: number | null,
  ventaDespues: number | null,
): CambioResumen => ({ nombre, costoAntes, costoDespues, ventaAntes, ventaDespues })

describe('fechaCorta', () => {
  it('dia y mes abreviado, sin depender del celular', () => {
    expect(fechaCorta(HOY)).toBe('15 oct')
    expect(fechaCorta(new Date(2026, 0, 3))).toBe('3 ene')
    expect(fechaCorta(new Date(2026, 11, 31))).toBe('31 dic')
  })
})

describe('cambioDePrecio', () => {
  it('lo que salio igual no cuenta', () => {
    expect(cambioDePrecio(c('Guayaba', 3000, 3000, 3900, 3900))).toBe(false)
  })
  it('si cambio la compra, cuenta', () => {
    expect(cambioDePrecio(c('Guayaba', 3000, 4000, 3900, 5200))).toBe(true)
  })
  it('si solo cambio la venta (por el redondeo a 50), tambien cuenta', () => {
    // Criolla pareja: compra igual, pero la venta paso de 6240 a 6250.
    expect(cambioDePrecio(c('Criolla pareja', 4800, 4800, 6240, 6250))).toBe(true)
  })
  it('un producto sin precio anterior cuenta', () => {
    expect(cambioDePrecio(c('Repollo', null, 2000, null, 2600))).toBe(true)
  })
})

describe('armarResumen', () => {
  it('el caso normal, tal como se ve en WhatsApp', () => {
    const texto = armarResumen(HOY, [
      c('Guayaba', 3000, 4000, 3900, 5200),
      c('Cilantro', 15000, 14000, 19500, 18200),
    ])
    expect(texto).toBe(
      [
        '🛒 *Compras 15 oct*',
        '',
        'Guayaba  $3.000 → $4.000 ↑',
        '   venta $3.900 → $5.200',
        'Cilantro  $15.000 → $14.000 ↓',
        '   venta $19.500 → $18.200',
        '',
        '_2 precios cambiaron_',
      ].join('\n'),
    )
  })

  it('lo que salio al mismo precio no aparece', () => {
    const texto = armarResumen(HOY, [
      c('Guayaba', 3000, 4000, 3900, 5200),
      c('Mora', 7000, 7000, 9100, 9100),
    ])
    expect(texto).toContain('Guayaba')
    expect(texto).not.toContain('Mora')
    expect(texto).toContain('_1 precio cambió_')
  })

  it('si solo cambio la venta, la compra dice (igual) y no lleva flecha', () => {
    const texto = armarResumen(HOY, [c('Criolla pareja', 4800, 4800, 6240, 6250)])
    expect(texto).toContain('Criolla pareja  $4.800 (igual)\n')
    expect(texto).toContain('   venta $6.240 → $6.250')
  })

  it('un producto nuevo dice "nuevo"', () => {
    const texto = armarResumen(HOY, [c('Repollo', null, 2000, null, 2600)])
    expect(texto).toContain('Repollo  nuevo $2.000\n   venta nuevo $2.600')
  })

  it('sin venta (como la papa por bulto) va solo la linea de compra', () => {
    const texto = armarResumen(HOY, [c('Papa (bulto)', 125000, 130000, null, null)])
    expect(texto).toContain('Papa (bulto)  $125.000 → $130.000 ↑\n\n_1 precio cambió_')
    expect(texto).not.toContain('venta')
  })

  it('si nada cambio, lo dice en vez de mandar un mensaje vacio', () => {
    expect(armarResumen(HOY, [c('Mora', 7000, 7000, 9100, 9100)])).toBe(
      '🛒 *Compras 15 oct*\n\nNingún precio cambió.',
    )
    expect(armarResumen(HOY, [])).toContain('Ningún precio cambió.')
  })

  it('respeta el orden en que llegan los cambios', () => {
    const texto = armarResumen(HOY, [
      c('Mora', 7000, 7200, 9100, 9400),
      c('Arveja', 8000, 8400, 10000, 10500),
    ])
    expect(texto.indexOf('Mora')).toBeLessThan(texto.indexOf('Arveja'))
  })
})
