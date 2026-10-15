import { describe, expect, it } from 'vitest'
import { armarResumen, cambioDePrecio, fechaCorta, type CambioResumen } from './resumen'

const HOY = new Date(2026, 9, 15) // 15 de octubre, hora local

const c = (
  nombre: string,
  unidad: CambioResumen['unidad'],
  costoAntes: number | null,
  costoDespues: number | null,
): CambioResumen => ({ nombre, unidad, costoAntes, costoDespues })

describe('fechaCorta', () => {
  it('dia y mes abreviado, sin depender del celular', () => {
    expect(fechaCorta(HOY)).toBe('15 oct')
    expect(fechaCorta(new Date(2026, 0, 3))).toBe('3 ene')
    expect(fechaCorta(new Date(2026, 11, 31))).toBe('31 dic')
  })
})

describe('cambioDePrecio', () => {
  it('lo que salio igual no cuenta', () => {
    expect(cambioDePrecio(c('Guayaba', 'KG', 3000, 3000))).toBe(false)
  })
  it('si cambio la compra, cuenta', () => {
    expect(cambioDePrecio(c('Guayaba', 'KG', 3000, 4000))).toBe(true)
  })
  it('un producto sin precio anterior cuenta', () => {
    expect(cambioDePrecio(c('Repollo', 'KG', null, 2000))).toBe(true)
  })
})

describe('armarResumen', () => {
  it('el caso normal, tal como se ve en WhatsApp', () => {
    const texto = armarResumen(HOY, [
      c('Guayaba', 'KG', 3000, 4000),
      c('Granadilla', 'UNIDAD', 1600, 1500),
      c('Tomate chonto', 'KG', 2500, 2200),
      c('Cebolla cabezona', 'KG', 3000, 3400),
    ])
    expect(texto).toBe(
      [
        '🛒 *Compras 15 oct*',
        '',
        '🔴 *Subieron*',
        'Guayaba (kg): $3.000 → $4.000',
        'Cebolla cabezona (kg): $3.000 → $3.400',
        '',
        '🟢 *Bajaron*',
        'Granadilla (c/u): $1.600 → $1.500',
        'Tomate chonto (kg): $2.500 → $2.200',
      ].join('\n'),
    )
  })

  it('lo anotado en libra sale en libra, lo mismo que se pago', () => {
    // Se guarda por kilo: 7.000 y 7.400 el kilo son 3.500 y 3.700 la libra.
    const texto = armarResumen(HOY, [c('Mora', 'LB', 7000, 7400)])
    expect(texto).toContain('Mora (lb): $3.500 → $3.700')
  })

  it('lo anotado en kilo sale en kilo aunque el producto se maneje en libra', () => {
    // La unidad es la de la compra, no la del producto: 4.200 el kilo es 4.200.
    const texto = armarResumen(HOY, [c('Mora', 'KG', 7000, 4200)])
    expect(texto).toContain('Mora (kg): $7.000 → $4.200')
  })

  it('el color va por lo que cambio, en la unidad que sea', () => {
    const texto = armarResumen(HOY, [c('Fresa', 'LB', 8000, 7000)])
    expect(texto).toBe('🛒 *Compras 15 oct*\n\n🟢 *Bajaron*\nFresa (lb): $4.000 → $3.500')
  })

  it('bulto y paquete llevan su unidad', () => {
    const texto = armarResumen(HOY, [
      c('Papa pastusa', 'BULTO', 125000, 130000),
      c('Huevos', 'PAQUETE', 14000, 13500),
    ])
    expect(texto).toContain('Papa pastusa (bulto): $125.000 → $130.000')
    expect(texto).toContain('Huevos (paquete): $14.000 → $13.500')
  })

  it('sin unidad no lleva parentesis', () => {
    const texto = armarResumen(HOY, [c('Colcafé', null, 5000, 5200)])
    expect(texto).toContain('\nColcafé: $5.000 → $5.200')
  })

  it('lo que salio al mismo precio no aparece', () => {
    const texto = armarResumen(HOY, [c('Guayaba', 'KG', 3000, 4000), c('Mora', 'LB', 7000, 7000)])
    expect(texto).toContain('Guayaba')
    expect(texto).not.toContain('Mora')
  })

  it('un grupo vacio no sale', () => {
    const texto = armarResumen(HOY, [c('Guayaba', 'KG', 3000, 4000)])
    expect(texto).not.toContain('Bajaron')
    expect(texto).not.toContain('Nuevos')
  })

  it('lo que no tenia precio va en nuevos, sin flecha', () => {
    const texto = armarResumen(HOY, [c('Guayaba', 'KG', 3000, 4000), c('Repollo', 'KG', null, 2000)])
    expect(texto).toContain('\n\n🆕 *Nuevos*\nRepollo (kg): $2.000')
    expect(texto.indexOf('Subieron')).toBeLessThan(texto.indexOf('Nuevos'))
  })

  it('si nada cambio, lo dice en vez de mandar un mensaje vacio', () => {
    expect(armarResumen(HOY, [c('Mora', 'LB', 7000, 7000)])).toBe(
      '🛒 *Compras 15 oct*\n\nNingún precio cambió.',
    )
    expect(armarResumen(HOY, [])).toContain('Ningún precio cambió.')
  })

  it('dentro de cada grupo respeta el orden del recorrido', () => {
    const texto = armarResumen(HOY, [
      c('Mora', 'LB', 7000, 7200),
      c('Cilantro', 'KG', 15000, 14000),
      c('Arveja', 'KG', 8000, 8400),
    ])
    expect(texto.indexOf('Mora')).toBeLessThan(texto.indexOf('Arveja'))
  })
})
