import { describe, expect, it } from 'vitest'
import { advertirSiAmbiguo, resolverConexiones } from './conexion.mjs'

const POOLER = 'postgresql://u:c@ep-cool-pond-123-pooler.us-east-2.aws.neon.tech/milista'
const DIRECTA = 'postgresql://u:c@ep-cool-pond-123.us-east-2.aws.neon.tech/milista'
const LOCAL = 'postgresql://postgres@127.0.0.1:5433/milista?schema=public'

describe('resolverConexiones', () => {
  it('usa la misma URL para todo cuando solo hay una', () => {
    const r = resolverConexiones({ DATABASE_URL: LOCAL })
    expect(r.agrupada).toBe(LOCAL)
    expect(r.directa).toBe(LOCAL)
  })

  it('encuentra la conexion aunque la variable no se llame DATABASE_URL', () => {
    // El caso que reporto el usuario: Vercel la dejo con otro nombre.
    const r = resolverConexiones({ STORAGE_URL: LOCAL })
    expect(r.agrupada).toBe(LOCAL)
  })

  it('separa agrupada de directa con los nombres de Neon en Vercel', () => {
    const r = resolverConexiones({ DATABASE_URL: POOLER, DATABASE_URL_UNPOOLED: DIRECTA })
    expect(r.agrupada).toBe(POOLER)
    expect(r.directa).toBe(DIRECTA)
  })

  it('entiende los nombres heredados de Postgres', () => {
    const r = resolverConexiones({ POSTGRES_URL: POOLER, POSTGRES_URL_NON_POOLING: DIRECTA })
    expect(r.agrupada).toBe(POOLER)
    expect(r.directa).toBe(DIRECTA)
  })

  it('funciona con un prefijo propio', () => {
    const r = resolverConexiones({ STORAGE_URL: POOLER, STORAGE_URL_UNPOOLED: DIRECTA })
    expect(r.agrupada).toBe(POOLER)
    expect(r.directa).toBe(DIRECTA)
  })

  it('distingue por el host cuando los nombres no dicen nada', () => {
    const r = resolverConexiones({ BASE_A: DIRECTA, BASE_B: POOLER })
    expect(r.agrupada).toBe(POOLER)
    expect(r.directa).toBe(DIRECTA)
  })

  it('ignora variables que no son conexiones de Postgres', () => {
    const r = resolverConexiones({
      CLAVE_ESCRITURA: 'una frase larga',
      NEXT_PUBLIC_APP_URL: 'https://milista.vercel.app',
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: LOCAL,
    })
    expect(r.agrupada).toBe(LOCAL)
  })

  it('no depende del orden en que vengan las variables', () => {
    const a = resolverConexiones({ DATABASE_URL_UNPOOLED: DIRECTA, DATABASE_URL: POOLER })
    const b = resolverConexiones({ DATABASE_URL: POOLER, DATABASE_URL_UNPOOLED: DIRECTA })
    expect(a).toEqual(b)
  })

  it('explica el problema cuando no hay ninguna conexion', () => {
    // Sin esto, Prisma falla mas adelante con un mensaje que no dice que hacer.
    expect(() => resolverConexiones({ CLAVE_ESCRITURA: 'x' })).toThrow(/Postgres/)
  })
})

describe('variables huerfanas de una conexion anterior', () => {
  // El caso real: se reconecto la base en Vercel con otro prefijo y quedaron las
  // dos parejas. Sin aviso, la app escribiria los precios en la base vieja.
  const VIEJA_POOL = 'postgresql://u:c@ep-vieja-000-pooler.us-east-2.aws.neon.tech/milista'
  const VIEJA_DIR = 'postgresql://u:c@ep-vieja-000.us-east-2.aws.neon.tech/milista'
  const NUEVA_POOL = 'postgresql://u:c@ep-nueva-999-pooler.us-east-2.aws.neon.tech/milista'
  const NUEVA_DIR = 'postgresql://u:c@ep-nueva-999.us-east-2.aws.neon.tech/milista'

  const enredado = {
    DATABASE_URL: VIEJA_POOL,
    DATABASE_URL_UNPOOLED: VIEJA_DIR,
    STORAGE_URL: NUEVA_POOL,
    STORAGE_URL_UNPOOLED: NUEVA_DIR,
  }

  it('detecta que hay mas de una base', () => {
    expect(resolverConexiones(enredado).ambiguo).toBe(true)
  })

  it('avisa nombrando las candidatas y la que uso', () => {
    const avisos: string[] = []
    advertirSiAmbiguo(resolverConexiones(enredado), (m: string) => avisos.push(m))
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toContain('STORAGE_URL')
    expect(avisos[0]).toContain('DATABASE_URL')
  })

  it('MILISTA_DATABASE_URL manda sobre la heuristica y calla el aviso', () => {
    const r = resolverConexiones({ ...enredado, MILISTA_DATABASE_URL: NUEVA_POOL })
    expect(r.agrupada).toBe(NUEVA_POOL)
    expect(r.nombreAgrupada).toBe('MILISTA_DATABASE_URL')
    expect(r.ambiguo).toBe(false)

    const avisos: string[] = []
    advertirSiAmbiguo(r, (m: string) => avisos.push(m))
    expect(avisos).toHaveLength(0)
  })

  it('MILISTA_DATABASE_URL_UNPOOLED fija la directa', () => {
    const r = resolverConexiones({
      ...enredado,
      MILISTA_DATABASE_URL: NUEVA_POOL,
      MILISTA_DATABASE_URL_UNPOOLED: NUEVA_DIR,
    })
    expect(r.directa).toBe(NUEVA_DIR)
    expect(r.nombreDirecta).toBe('MILISTA_DATABASE_URL_UNPOOLED')
  })
})

describe('el caso normal no molesta', () => {
  it('una sola base repartida en varias variables no es ambigua', () => {
    // Neon inyecta la pareja mas el juego heredado: son todas la misma base.
    const r = resolverConexiones({
      DATABASE_URL: POOLER,
      DATABASE_URL_UNPOOLED: DIRECTA,
      POSTGRES_URL: POOLER,
      POSTGRES_URL_NON_POOLING: DIRECTA,
    })
    expect(r.ambiguo).toBe(false)

    const avisos: string[] = []
    advertirSiAmbiguo(r, (m: string) => avisos.push(m))
    expect(avisos).toHaveLength(0)
  })

  it('el Postgres local tampoco es ambiguo', () => {
    expect(resolverConexiones({ DATABASE_URL: LOCAL }).ambiguo).toBe(false)
  })

  it('dice de que variable salio cada conexion', () => {
    const r = resolverConexiones({ STORAGE_URL: POOLER, STORAGE_URL_UNPOOLED: DIRECTA })
    expect(r.nombreAgrupada).toBe('STORAGE_URL')
    expect(r.nombreDirecta).toBe('STORAGE_URL_UNPOOLED')
  })
})
