import { describe, expect, it } from 'vitest'
import { emparejar, parsearLista, type ProductoCatalogo } from './parser'
import { redondear50 } from './precios'

/** Catalogo de prueba con los productos y margenes reales del negocio. */
function producto(
  id: string,
  nombre: string,
  unidad: ProductoCatalogo['unidad'],
  costo: number | null,
  venta: number | null,
  extra: Partial<ProductoCatalogo> = {},
): ProductoCatalogo {
  return {
    id,
    nombre,
    slug: nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    unidad,
    margen: costo && venta ? Number((venta / costo).toFixed(6)) : 1.3,
    aliases: [],
    costoActual: costo,
    ventaActual: venta,
    disponible: true,
    ...extra,
  }
}

const CATALOGO: ProductoCatalogo[] = [
  producto('criolla-pareja', 'Criolla pareja', 'KG', 4800, 6240),
  producto('criolla', 'Criolla', 'KG', 7200, 9360),
  producto('papa-lavada', 'Papa lavada', 'KG', 1800, 2340),
  producto('papa-sabanera', 'Papa sabanera', 'KG', 4000, 5200),
  producto('guayaba', 'Guayaba', 'KG', 3000, 3900),
  producto('papaya', 'Papaya', 'LB', 6400, 8320),
  producto('fresa', 'Fresa', 'LB', 7000, 9100),
  producto('tomate-parejo', 'Tomate parejo', 'KG', 2500, 3250),
  producto('tomate-grueso', 'Tomate grueso', 'KG', 4500, 5850),
  producto('coliseros', 'Coliseros', 'KG', 2200, 3200),
  producto('granadilla', 'Granadilla', 'UNIDAD', 1666, 2200),
  producto('habichuela', 'Habichuela', 'KG', 4000, 5000),
  producto('alverja', 'Alverja', 'KG', 8400, 10500),
  producto('curuba', 'Curuba', 'KG', 4000, 4800),
  producto('papa-bulto', 'Papa (bulto)', 'BULTO', 125000, null),
]

const unico = (texto: string) => {
  const { cambios } = parsearLista(texto, CATALOGO)
  expect(cambios).toHaveLength(1)
  return cambios[0]
}

describe('precio por kilo', () => {
  it('lee un precio en kilos tal cual', () => {
    const c = unico('Guayaba sale 4000kg ✅')
    expect(c.producto.id).toBe('guayaba')
    expect(c.despues.costo).toBe(4000)
    expect(c.unidadDetectada).toBe('kg')
    expect(c.convertidoDeLibra).toBe(false)
  })

  it('recalcula la venta con el margen del producto y redondea a 50', () => {
    // 4000 x 1.30 = 5200
    expect(unico('Guayaba sale 4000kg ✅').despues.venta).toBe(5200)
  })
})

describe('conversion de libra a kilo', () => {
  it('convierte cuando el texto dice libra', () => {
    const c = unico('Papaya sale 3000libra ✅')
    expect(c.despues.costo).toBe(6000)
    expect(c.unidadDetectada).toBe('lb')
    expect(c.convertidoDeLibra).toBe(true)
  })

  it('asume libra cuando el producto se maneja en Lb y el texto no dice kg', () => {
    const c = unico('Fresa 3500 ✅')
    expect(c.despues.costo).toBe(7000)
    expect(c.convertidoDeLibra).toBe(true)
  })

  it('respeta el kg explicito aunque el producto este en Lb', () => {
    const c = unico('Fresa 7000kg ✅')
    expect(c.despues.costo).toBe(7000)
    expect(c.convertidoDeLibra).toBe(false)
  })
})

describe('varios productos en una linea', () => {
  it('parte la linea y hereda el nombre base', () => {
    const { cambios } = parsearLista('Tomate parejo 3000kg y grueso 4000kg ✅', CATALOGO)
    expect(cambios.map((c) => c.producto.id)).toEqual(['tomate-parejo', 'tomate-grueso'])
    expect(cambios[0].despues.costo).toBe(3000)
    expect(cambios[1].despues.costo).toBe(4000)
  })
})

describe('sin existencia', () => {
  it('marca el ❌ sin borrar el precio', () => {
    const c = unico('Criolla ❌')
    expect(c.producto.id).toBe('criolla')
    expect(c.despues.disponible).toBe(false)
    expect(c.despues.costo).toBe(7200)
    expect(c.despues.venta).toBe(9360)
    expect(c.hayCambio).toBe(true)
  })

  it('tambien entiende "no hay" escrito', () => {
    expect(unico('Guayaba no hay').despues.disponible).toBe(false)
  })
})

describe('bug 1 — "vender" no debe pisar el costo', () => {
  it('distingue el costo del precio de venta en la misma linea', () => {
    const c = unico('Coliseros 2200kg ✅ vender 3200')
    expect(c.despues.costo).toBe(2200)
    expect(c.despues.venta).toBe(3200)
    expect(c.ventaEsExplicita).toBe(true)
  })

  it('la venta explicita manda sobre el margen', () => {
    // Con el margen (1.30) daria 3900; el usuario dijo 3500.
    const c = unico('Guayaba 3000kg vender 3500')
    expect(c.despues.costo).toBe(3000)
    expect(c.despues.venta).toBe(3500)
  })
})

describe('bug 2 — las fracciones no son precios', () => {
  it('no lee 1 y 2 como precios en "1/2 roba"', () => {
    const { cambios } = parsearLista('criolla 1/2 roba pareja 4800kg', CATALOGO)
    expect(cambios).toHaveLength(1)
    expect(cambios[0].producto.id).toBe('criolla-pareja')
    expect(cambios[0].despues.costo).toBe(4800)
  })

  it('ignora cantidades pequenas que no son precios', () => {
    const c = unico('2 bultos de Papa (bulto) 125000')
    expect(c.despues.costo).toBe(125000)
  })
})

describe('bug 3 — el emparejamiento no depende del orden del catalogo', () => {
  it('"Papá criolla" cae en Criolla, no en Criolla pareja', () => {
    expect(unico('Papá criolla 4000kg').producto.id).toBe('criolla')
  })

  it('da el mismo resultado con el catalogo invertido', () => {
    const alReves = [...CATALOGO].reverse()
    const a = emparejar('papa criolla', CATALOGO)
    const b = emparejar('papa criolla', alReves)
    expect(a?.producto.id).toBe(b?.producto.id)
    expect(a?.producto.id).toBe('criolla')
  })
})

describe('emparejamiento difuso', () => {
  it('ignora tildes y mayusculas', () => {
    expect(emparejar('GUAYABÁ', CATALOGO)?.producto.id).toBe('guayaba')
  })

  it('un alias guardado gana y se reporta como alias', () => {
    const conAlias = CATALOGO.map((p) =>
      p.id === 'criolla' ? { ...p, aliases: ['papa criolla amarilla'] } : p,
    )
    const m = emparejar('papa criolla amarilla', conAlias)
    expect(m?.producto.id).toBe('criolla')
    expect(m?.confianza).toBe('alias')
  })

  it('devuelve null cuando no se parece a nada', () => {
    expect(emparejar('destornillador estrella', CATALOGO)).toBeNull()
  })
})

describe('margen propio de cada producto', () => {
  it('el mismo costo da ventas distintas segun el producto', () => {
    // Habichuela 1.25 vs Guayaba 1.30, ambos a 4000.
    expect(unico('Habichuela 4000kg').despues.venta).toBe(5000)
    expect(unico('Guayaba 4000kg').despues.venta).toBe(5200)
  })

  it('conserva el margen 1.25 de la alverja', () => {
    expect(unico('Alverja 8400kg').despues.venta).toBe(10500)
  })

  it('conserva el margen 1.20 de la curuba', () => {
    expect(unico('Curuba 4000kg').despues.venta).toBe(4800)
  })

  it('reproduce el precio actual de la granadilla por unidad', () => {
    const c = unico('Granadilla 1666 C/u')
    expect(c.despues.costo).toBe(1666)
    expect(c.unidadDetectada).toBe('unidad')
    expect(c.despues.venta).toBe(2200)
  })
})

describe('redondeo a 50', () => {
  it('sube al siguiente multiplo de 50', () => {
    expect(redondear50(2860)).toBe(2900)
    expect(redondear50(3900)).toBe(3900)
    expect(redondear50(3901)).toBe(3950)
  })
})

describe('numeros escritos como llegan', () => {
  it('entiende el separador de miles', () => {
    expect(unico('Guayaba 4.000 kg').despues.costo).toBe(4000)
  })
})

describe('lo que no reconoce', () => {
  it('manda a no reconocidos lo que no existe en el catalogo', () => {
    const { cambios, noReconocidos } = parsearLista('Zapallito raro 5000kg', CATALOGO)
    expect(cambios).toHaveLength(0)
    expect(noReconocidos).toHaveLength(1)
    expect(noReconocidos[0].valor).toBe(5000)
  })

  it('ignora lineas vacias y basura sin nombre', () => {
    expect(parsearLista('\n\n   \n', CATALOGO).cambios).toHaveLength(0)
  })
})

describe('lista completa', () => {
  it('procesa varias lineas de una lista real', () => {
    const { cambios, noReconocidos } = parsearLista(
      [
        'Buenos dias, la lista de hoy:',
        'Guayaba sale 4000kg ✅',
        'Papaya sale 3000libra ✅',
        'Tomate parejo 3000kg y grueso 4000kg ✅',
        'Criolla ❌',
        'Coliseros 2200kg ✅ vender 3200',
      ].join('\n'),
      CATALOGO,
    )
    const ids = cambios.map((c) => c.producto.id)
    expect(ids).toContain('guayaba')
    expect(ids).toContain('papaya')
    expect(ids).toContain('tomate-parejo')
    expect(ids).toContain('tomate-grueso')
    expect(ids).toContain('criolla')
    expect(ids).toContain('coliseros')
    expect(noReconocidos.every((n) => n.valor == null)).toBe(true)
  })
})

describe('los aliases se guardan como el parser los va a leer', () => {
  it('un alias con palabras de relleno vuelve a emparejar', () => {
    // El alias se guarda pasando por limpiarNombre, que quita "del". Si se
    // guardara con normalizar quedaria "guayabita del monte" y no volveria a
    // encontrarse nunca, porque el parser genera "guayabita monte".
    const conAlias = CATALOGO.map((p) =>
      p.id === 'guayaba' ? { ...p, aliases: ['guayabita monte'] } : p,
    )
    const m = emparejar('guayabita del monte', conAlias)
    expect(m?.producto.id).toBe('guayaba')
    expect(m?.confianza).toBe('alias')
  })
})

describe('no confundir productos que solo comparten el principio', () => {
  const CON_PAPAS: ProductoCatalogo[] = [
    ...CATALOGO,
    producto('papa-sabanera-2', 'Papa sabanera', 'KG', 4000, 5200),
  ]

  it('"papá pastusa" no puede caer en Papaya', () => {
    // "papa" es prefijo de "papaya". Sin pesar menos las coincidencias parciales,
    // Papaya le ganaba a todas las papas y se le metia el precio equivocado.
    const m = emparejar('papa pastusa', CON_PAPAS)
    expect(m?.producto.id).not.toBe('papaya')
  })

  it('una papa que no esta en el catalogo se manda a no reconocidos', () => {
    // Mejor pedirle al usuario que la agregue que colarla en otra papa.
    const { cambios, noReconocidos } = parsearLista('Papá pastusa vender 1400', CON_PAPAS)
    expect(cambios).toHaveLength(0)
    expect(noReconocidos).toHaveLength(1)
    expect(noReconocidos[0].textoDetectado).toContain('pastusa')
  })

  it('sigue emparejando lo que si corresponde', () => {
    expect(emparejar('papa criolla', CON_PAPAS)?.producto.id).toBe('criolla')
    expect(emparejar('papaya', CON_PAPAS)?.producto.id).toBe('papaya')
    expect(emparejar('papa lavada', CON_PAPAS)?.producto.id).toBe('papa-lavada')
  })

  it('una palabra exacta no pierde su pareja contra una parcial', () => {
    // "papa" exacto en "Papa lavada" vale mas que "papa"~"papaya" por prefijo.
    const dos = [producto('papaya', 'Papaya', 'LB', 6400, 8320), producto('papa', 'Papa', 'KG', 1800, 2340)]
    expect(emparejar('papa pastusa', dos)?.producto.id).toBe('papa')
  })
})
