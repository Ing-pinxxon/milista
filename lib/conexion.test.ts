import { describe, expect, it } from 'vitest'
import { resolverConexiones } from './conexion.mjs'

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
