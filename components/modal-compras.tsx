'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from './modal'
import { normalizar } from '@/lib/normalizar'
import { calcularVenta, cop } from '@/lib/precios'
import { sugerirCompras } from '@/lib/compras'
import {
  UNIDADES_COMPRA,
  costoNormalizado,
  nombreDeItem,
  type ItemListaVista,
  type ListaVista,
  type Unidad,
} from '@/lib/tipos-compras'
import type { ProductoConPrecio } from '@/lib/tipos'

type Paso = 'cargando' | 'armar' | 'comprar' | 'revisar'

interface Props {
  productos: ProductoConPrecio[]
  onCerrar: (huboCambios: boolean) => void
  onAplicado: (cantidad: number) => void
  onPedirClave: () => void
}

export function ModalCompras({ productos, onCerrar, onAplicado, onPedirClave }: Props) {
  const [paso, setPaso] = useState<Paso>('cargando')
  const [lista, setLista] = useState<ListaVista | null>(null)
  const [items, setItems] = useState<ItemListaVista[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [libre, setLibre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Rellena la unidad que falte con la del producto, para que en la plaza ya
   * venga marcada la de siempre y solo haya que tocarla cuando cambie.
   */
  const conUnidadPorDefecto = (xs: ItemListaVista[]): ItemListaVista[] =>
    xs.map((it) =>
      it.unidad || !it.productoId
        ? it
        : { ...it, unidad: productos.find((p) => p.id === it.productoId)?.unidad ?? null },
    )

  // Al abrir: se retoma la lista en curso, o se propone una nueva con lo que
  // probablemente falta.
  useEffect(() => {
    ;(async () => {
      const r = await fetch('/api/listas', { cache: 'no-store' })
      if (r.status === 401) return onPedirClave()
      const { lista: abierta } = (await r.json()) as { lista: ListaVista | null }

      if (abierta) {
        setLista(abierta)
        setItems(conUnidadPorDefecto(abierta.items))
        setPaso(abierta.estado === 'COMPRANDO' ? 'comprar' : 'armar')
        return
      }

      setItems(
        sugerirCompras(productos).map((s) => ({
          productoId: s.producto.id,
          texto: null,
          comprado: false,
          costo: null,
          unidad: s.producto.unidad,
          producto: {
            id: s.producto.id,
            nombre: s.producto.nombre,
            slug: s.producto.slug,
            unidad: s.producto.unidad,
          },
        })),
      )
      setPaso('armar')
    })().catch(() => setError('No se pudo abrir la lista.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enLista = useMemo(
    () => new Set(items.map((i) => i.productoId).filter(Boolean) as string[]),
    [items],
  )

  const candidatos = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return []
    return productos
      .filter((p) => !enLista.has(p.id) && normalizar(p.nombre).includes(q))
      .slice(0, 6)
  }, [busqueda, productos, enLista])

  const agregarProducto = (p: ProductoConPrecio) => {
    setItems((xs) => [
      ...xs,
      {
        productoId: p.id,
        texto: null,
        comprado: false,
        costo: null,
        unidad: p.unidad,
        producto: { id: p.id, nombre: p.nombre, slug: p.slug, unidad: p.unidad },
      },
    ])
    setBusqueda('')
  }

  const agregarLibre = () => {
    const t = libre.trim()
    if (!t) return
    setItems((xs) => [
      ...xs,
      { productoId: null, texto: t, comprado: false, costo: null, unidad: null },
    ])
    setLibre('')
  }

  const quitar = (i: number) => setItems((xs) => xs.filter((_, j) => j !== i))

  const cambiar = (i: number, cambio: Partial<ItemListaVista>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...cambio } : x)))

  /** Guarda el estado completo en el servidor. */
  const guardar = async (estado: ListaVista['estado'], listaActual = lista) => {
    setOcupado(true)
    setError(null)
    try {
      const cuerpo = JSON.stringify({
        estado,
        items: items.map((i) => ({
          productoId: i.productoId,
          texto: i.texto,
          comprado: i.comprado,
          costo: i.costo,
          unidad: i.unidad,
        })),
      })

      const r = listaActual
        ? await fetch(`/api/listas/${listaActual.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: cuerpo,
          })
        : await fetch('/api/listas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items.map((i) => ({ productoId: i.productoId, texto: i.texto })) }),
          })

      if (r.status === 401) return onPedirClave()
      if (!r.ok) throw new Error('guardar')
      const { lista: guardada } = (await r.json()) as { lista: ListaVista }
      setLista(guardada)
      setItems(conUnidadPorDefecto(guardada.items))
      return guardada
    } catch {
      setError('No se pudo guardar la lista.')
      return null
    } finally {
      setOcupado(false)
    }
  }

  const empezarACompar = async () => {
    const creada = await guardar('COMPRANDO', lista)
    // Recien creada por POST: hay que fijarle el estado.
    if (creada && creada.estado !== 'COMPRANDO') {
      await fetch(`/api/listas/${creada.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'COMPRANDO', items: creada.items }),
      })
    }
    if (creada) setPaso('comprar')
  }

  // Lo comprado con precio anotado es lo que va a mover precios.
  const cambios = useMemo(() => {
    return items
      .filter((i) => i.comprado && i.costo != null && i.productoId)
      .map((i) => {
        const p = productos.find((x) => x.id === i.productoId)
        if (!p) return null
        const costo = Math.round(costoNormalizado(i.costo as number, i.unidad))
        return {
          producto: p,
          costo,
          venta: calcularVenta(costo, p.margen),
          convertido: i.unidad === 'LB',
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [items, productos])

  const aplicar = async () => {
    if (!lista) return
    setOcupado(true)
    const r = await fetch(`/api/listas/${lista.id}/cerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cambios: cambios.map((c) => ({ productoId: c.producto.id, costo: c.costo, venta: c.venta })),
      }),
    })
    setOcupado(false)
    if (r.status === 401) return onPedirClave()
    if (!r.ok) return setError('No se pudieron guardar los precios.')
    navigator.vibrate?.(20)
    onAplicado(cambios.length)
  }

  const comprados = items.filter((i) => i.comprado).length

  if (paso === 'cargando') {
    return (
      <Modal titulo="Lista de compras" onCerrar={() => onCerrar(false)}>
        <p className="p-8 text-center font-mono text-xs uppercase tracking-[0.3em] text-neutral-600">
          cargando
        </p>
      </Modal>
    )
  }

  // ---------------------------------------------------------------- armar
  if (paso === 'armar') {
    return (
      <Modal
        titulo="¿Qué falta?"
        onCerrar={() => onCerrar(false)}
        pie={
          <button
            onClick={empezarACompar}
            disabled={items.length === 0 || ocupado}
            className="min-h-[52px] w-full rounded-xl bg-amber-400 font-bold text-neutral-950 disabled:opacity-30"
          >
            {ocupado ? 'Guardando…' : `Ir a comprar (${items.length})`}
          </button>
        }
      >
        <div className="space-y-4 p-4">
          <p className="text-sm leading-relaxed text-neutral-400">
            Empecé por lo que está marcado sin existencia y lo que lleva días sin actualizarse.
            Quita lo que no necesites y añade lo demás.
          </p>

          <div>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto para añadir…"
              className="min-h-[52px] w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 focus:border-amber-400 focus:outline-none"
            />
            {candidatos.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-xl border border-neutral-800">
                {candidatos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => agregarProducto(p)}
                    className="flex w-full items-center justify-between border-b border-neutral-900 px-3 py-3 text-left last:border-0 active:bg-neutral-900"
                  >
                    <span>{p.nombre}</span>
                    <span className="font-mono text-lg text-amber-400">+</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={libre}
              onChange={(e) => setLibre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregarLibre()}
              placeholder="Otra cosa que recordar…"
              className="min-h-[52px] flex-1 rounded-xl border border-neutral-800 bg-neutral-900 px-4 focus:border-amber-400 focus:outline-none"
            />
            <button
              onClick={agregarLibre}
              disabled={!libre.trim()}
              className="min-h-[52px] rounded-xl border border-neutral-700 px-4 font-mono text-[11px] uppercase tracking-wider text-neutral-300 disabled:opacity-30"
            >
              Añadir
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-neutral-800">
            {items.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-neutral-500">La lista está vacía.</p>
            )}
            {items.map((it, i) => (
              <div
                key={it.id ?? `${it.productoId ?? it.texto}-${i}`}
                className="flex items-center justify-between gap-2 border-b border-neutral-900 px-3 py-3 last:border-0"
              >
                <span className="truncate">
                  {nombreDeItem(it)}
                  {!it.productoId && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-neutral-600">
                      nota
                    </span>
                  )}
                </span>
                <button
                  onClick={() => quitar(i)}
                  className="min-h-[36px] shrink-0 px-2 font-mono text-[11px] uppercase text-neutral-500"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </Modal>
    )
  }

  // -------------------------------------------------------------- comprar
  if (paso === 'comprar') {
    return (
      <Modal
        titulo={`Comprando · ${comprados}/${items.length}`}
        onCerrar={async () => {
          await guardar('COMPRANDO')
          onCerrar(true)
        }}
        pie={
          <div className="flex gap-2">
            <button
              onClick={() => setPaso('armar')}
              className="min-h-[52px] rounded-xl border border-neutral-700 px-4 font-mono text-[11px] uppercase tracking-wider text-neutral-300"
            >
              Editar
            </button>
            <button
              onClick={async () => {
                await guardar('COMPRANDO')
                setPaso('revisar')
              }}
              disabled={ocupado}
              className="min-h-[52px] flex-1 rounded-xl bg-amber-400 font-bold text-neutral-950 disabled:opacity-30"
            >
              {ocupado ? 'Guardando…' : `Terminar (${cambios.length} precios)`}
            </button>
          </div>
        }
      >
        <div className="p-4">
          <p className="mb-3 text-sm text-neutral-400">
            Toca cada cosa al comprarla y anota a cómo salió. Se guarda solo.
          </p>

          <div className="space-y-2">
            {items.map((it, i) => (
              <div
                key={it.id ?? i}
                className={`rounded-xl border p-3 ${
                  it.comprado ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-800'
                }`}
              >
                <button
                  onClick={() => cambiar(i, { comprado: !it.comprado })}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm font-bold ${
                      it.comprado
                        ? 'border-amber-400 bg-amber-400 text-neutral-950'
                        : 'border-neutral-700 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <span className={`truncate ${it.comprado ? 'text-neutral-400 line-through' : ''}`}>
                    {nombreDeItem(it)}
                  </span>
                </button>

                {/* El precio solo se pide de lo que esta en el catalogo: las notas
                    sueltas no mueven precios. */}
                {it.comprado && it.productoId && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={it.costo ?? ''}
                      onChange={(e) =>
                        cambiar(i, { costo: e.target.value === '' ? null : Number(e.target.value) })
                      }
                      placeholder="A cómo salió"
                      className="min-h-[48px] w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 font-mono text-lg tabular-nums focus:border-amber-400 focus:outline-none"
                    />
                    <div className="grid grid-cols-4 gap-1.5">
                      {UNIDADES_COMPRA.map((u) => (
                        <button
                          key={u.valor}
                          onClick={() => cambiar(i, { unidad: u.valor })}
                          className={`min-h-[44px] rounded-lg border font-mono text-[11px] uppercase ${
                            it.unidad === u.valor
                              ? 'border-amber-400 bg-amber-400 font-bold text-neutral-950'
                              : 'border-neutral-800 text-neutral-400'
                          }`}
                        >
                          {u.etiqueta}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      </Modal>
    )
  }

  // -------------------------------------------------------------- revisar
  return (
    <Modal
      titulo="Revisar precios"
      onCerrar={() => onCerrar(true)}
      pie={
        <div className="flex gap-2">
          <button
            onClick={() => setPaso('comprar')}
            className="min-h-[52px] rounded-xl border border-neutral-700 px-4 font-mono text-[11px] uppercase tracking-wider text-neutral-300"
          >
            Volver
          </button>
          <button
            onClick={aplicar}
            disabled={ocupado}
            className="min-h-[52px] flex-1 rounded-xl bg-amber-400 font-bold text-neutral-950 disabled:opacity-30"
          >
            {ocupado ? 'Guardando…' : `Aplicar ${cambios.length}`}
          </button>
        </div>
      }
    >
      <div className="space-y-2 p-4">
        {cambios.length === 0 && (
          <p className="py-8 text-center text-neutral-500">
            No anotaste ningún precio. Puedes cerrar la lista igual.
          </p>
        )}
        {cambios.map((c) => {
          const sube = (c.costo ?? 0) > (c.producto.costoActual ?? 0)
          const baja = (c.costo ?? 0) < (c.producto.costoActual ?? 0)
          return (
            <div key={c.producto.id} className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{c.producto.nombre}</span>
                {c.convertido && (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-amber-500">
                    lb ×2
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[13px] tabular-nums">
                <span className="text-neutral-500">{cop(c.producto.costoActual)}</span>
                <span className={sube ? 'text-red-400' : baja ? 'text-green-400' : 'text-neutral-600'}>
                  {sube ? '↑' : baja ? '↓' : '→'}
                </span>
                <span className="font-bold">{cop(c.costo)}</span>
                <span className="text-neutral-700">·</span>
                <span className="text-amber-400">venta {cop(c.venta)}</span>
              </div>
            </div>
          )
        })}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </Modal>
  )
}
