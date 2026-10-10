import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearGuardadorDeRecorrido } from './guardar-recorrido'

/** Una red de mentira donde cada peticion se resuelve cuando el test quiere. */
function redFalsa() {
  const enviadas: string[][] = []
  const pendientes: ((ok: boolean) => void)[] = []
  let enVuelo = 0
  let maxEnVuelo = 0
  const fetch = vi.fn((_url: string, init: { body: string }) => {
    enviadas.push(JSON.parse(init.body).ids)
    enVuelo++
    maxEnVuelo = Math.max(maxEnVuelo, enVuelo)
    return new Promise((resolver) => {
      pendientes.push((ok) => {
        enVuelo--
        resolver({ ok } as Response)
      })
    })
  })
  return {
    fetch,
    enviadas,
    maxEnVuelo: () => maxEnVuelo,
    responder: async (ok = true) => {
      pendientes.shift()?.(ok)
      // Dejar correr las promesas.
      await vi.advanceTimersByTimeAsync(0)
    },
  }
}

describe('crearGuardadorDeRecorrido', () => {
  let red: ReturnType<typeof redFalsa>
  beforeEach(() => {
    vi.useFakeTimers()
    red = redFalsa()
    vi.stubGlobal('fetch', red.fetch)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('varios arrastres seguidos salen en una sola peticion, con el ultimo orden', async () => {
    const g = crearGuardadorDeRecorrido(() => {})
    g.programar(['a', 'b', 'c'])
    await vi.advanceTimersByTimeAsync(200)
    g.programar(['b', 'a', 'c'])
    await vi.advanceTimersByTimeAsync(200)
    g.programar(['c', 'b', 'a'])
    await vi.advanceTimersByTimeAsync(600)
    expect(red.enviadas).toEqual([['c', 'b', 'a']])
  })

  it('nunca hay dos peticiones a la vez: una vieja no puede pisar a una nueva', async () => {
    const g = crearGuardadorDeRecorrido(() => {})
    g.programar(['1'])
    await vi.advanceTimersByTimeAsync(600) // sale la primera y queda en camino
    g.programar(['2'])
    await vi.advanceTimersByTimeAsync(600) // no sale: la primera sigue en camino
    expect(red.enviadas).toEqual([['1']])
    await red.responder() // llega la primera
    await vi.advanceTimersByTimeAsync(10)
    expect(red.enviadas).toEqual([['1'], ['2']])
    expect(red.maxEnVuelo()).toBe(1)
  })

  it('sinGuardar devuelve lo que aun no llega al servidor', async () => {
    const g = crearGuardadorDeRecorrido(() => {})
    expect(g.sinGuardar()).toBeNull()
    g.programar(['x', 'y'])
    expect(g.sinGuardar()).toEqual(['x', 'y']) // esperando
    await vi.advanceTimersByTimeAsync(600)
    expect(g.sinGuardar()).toEqual(['x', 'y']) // en camino
    await red.responder()
    expect(g.sinGuardar()).toBeNull() // guardado
  })

  it('si falla avisa y reintenta, con lo mas nuevo', async () => {
    const alFallar = vi.fn()
    const g = crearGuardadorDeRecorrido(alFallar)
    g.programar(['viejo'])
    await vi.advanceTimersByTimeAsync(600)
    g.programar(['nuevo']) // cambio mientras la primera iba en camino
    await red.responder(false) // y la primera fallo
    expect(alFallar).toHaveBeenCalledOnce()
    expect(g.sinGuardar()).toEqual(['nuevo'])
    await vi.advanceTimersByTimeAsync(4100)
    expect(red.enviadas[red.enviadas.length - 1]).toEqual(['nuevo'])
  })

  it('ahora() manda lo pendiente sin esperar, para cuando se esconde la app', async () => {
    const g = crearGuardadorDeRecorrido(() => {})
    g.programar(['a'])
    g.ahora()
    await vi.advanceTimersByTimeAsync(0)
    expect(red.enviadas).toEqual([['a']])
  })
})
