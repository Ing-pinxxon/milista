'use client'

import { useMemo, useState } from 'react'
import { Modal } from './modal'
import { normalizar } from '@/lib/normalizar'
import { gananciaDe } from '@/lib/parser'
import {
  calcularVenta,
  cop,
  esPerdida,
  porcentajeDe,
  type Ganancia,
  type TipoGanancia,
} from '@/lib/precios'
import type { ProductoConPrecio } from '@/lib/tipos'

interface Props {
  productos: ProductoConPrecio[]
  onCerrar: (huboCambios: boolean) => void
  onPedirClave: () => void
}

interface Pendiente {
  tipo: TipoGanancia
  valor: string
}

/**
 * Repasar de corrido cuanto se le gana a cada producto.
 *
 * Ordenado de mayor a menor ganancia, que es como se encuentra lo que quedo
 * alto. Se editan varios y se guardan de una sola vez.
 */
export function ModalGanancias({ productos, onCerrar, onPedirClave }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [cambios, setCambios] = useState<Record<string, Pendiente>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lista = useMemo(() => {
    const q = normalizar(busqueda)
    return productos
      .filter((p) => p.costoActual != null && (!q || normalizar(p.nombre).includes(q)))
      // De mayor a menor: lo que quedo alto sale primero, que es lo que se busca.
      .sort((a, b) => b.margen - a.margen)
  }, [productos, busqueda])

  const valorDe = (p: ProductoConPrecio): Pendiente =>
    cambios[p.id] ?? {
      tipo: p.tipoGanancia,
      valor:
        p.tipoGanancia === 'PESOS'
          ? String(p.gananciaPesos ?? '')
          : String(porcentajeDe(p.margen)),
    }

  const comoGanancia = (p: ProductoConPrecio, v: Pendiente): Ganancia =>
    v.tipo === 'PESOS'
      ? { tipo: 'PESOS', margen: p.margen, pesos: v.valor === '' ? null : Number(v.valor) }
      : { tipo: 'PORCENTAJE', margen: v.valor === '' ? 1 : 1 + Number(v.valor) / 100, pesos: null }

  const editar = (p: ProductoConPrecio, cambio: Partial<Pendiente>) =>
    setCambios((c) => ({ ...c, [p.id]: { ...valorDe(p), ...cambio } }))

  const pendientes = Object.keys(cambios).length

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      for (const [id, v] of Object.entries(cambios)) {
        const p = productos.find((x) => x.id === id)
        if (!p) continue
        const g = comoGanancia(p, v)
        const r = await fetch(`/api/productos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipoGanancia: g.tipo, margen: g.margen, gananciaPesos: g.pesos }),
        })
        if (r.status === 401) return onPedirClave()
        if (!r.ok) throw new Error('guardar')
      }
      onCerrar(true)
    } catch {
      setError('No se pudieron guardar todos los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo="Cuánto le gano"
      onCerrar={() => onCerrar(false)}
      pie={
        <button
          onClick={guardar}
          disabled={pendientes === 0 || guardando}
          className="min-h-[52px] w-full rounded-xl bg-amber-400 font-bold text-neutral-950 disabled:opacity-30"
        >
          {guardando ? 'Guardando…' : pendientes === 0 ? 'Sin cambios' : `Guardar ${pendientes}`}
        </button>
      }
    >
      <div className="p-4">
        <p className="mb-3 text-sm leading-relaxed text-neutral-400">
          De mayor a menor, para encontrar rápido lo que quedó alto. Cambia lo que quieras y
          guarda todo de una vez.
        </p>

        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto…"
          className="mb-3 min-h-[48px] w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 focus:border-amber-400 focus:outline-none"
        />

        <div className="space-y-2">
          {lista.map((p) => {
            const v = valorDe(p)
            const g = comoGanancia(p, v)
            const nuevaVenta = p.costoActual != null && v.valor !== '' ? calcularVenta(p.costoActual, g) : null
            const cambiado = p.id in cambios
            const original = calcularVenta(p.costoActual ?? 0, gananciaDe(p))

            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 ${cambiado ? 'border-amber-700 bg-amber-950/10' : 'border-neutral-800'}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{p.nombre}</span>
                  <span className="shrink-0 font-mono text-[11px] text-neutral-500">
                    compra {cop(p.costoActual)}
                  </span>
                </div>

                <div className="mt-2 flex gap-2">
                  <div className="flex shrink-0 overflow-hidden rounded-lg border border-neutral-800">
                    {(['PORCENTAJE', 'PESOS'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => editar(p, { tipo: t })}
                        className={`min-h-[44px] w-11 font-mono text-sm ${
                          v.tipo === t ? 'bg-amber-400 font-bold text-neutral-950' : 'text-neutral-400'
                        }`}
                      >
                        {t === 'PORCENTAJE' ? '%' : '$'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={v.valor}
                    onChange={(e) => editar(p, { valor: e.target.value })}
                    className="min-h-[44px] w-20 shrink-0 rounded-lg border border-neutral-800 bg-neutral-900 px-3 font-mono tabular-nums focus:border-amber-400 focus:outline-none"
                  />
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 font-mono text-[13px] tabular-nums">
                    {cambiado && nuevaVenta !== original && (
                      <>
                        <span className="text-neutral-600 line-through">{cop(original)}</span>
                        <span className="text-neutral-600">→</span>
                      </>
                    )}
                    <span className={esPerdida(p.costoActual, g) ? 'text-red-400' : 'text-amber-400'}>
                      {cop(nuevaVenta)}
                    </span>
                  </div>
                </div>

                {esPerdida(p.costoActual, g) && (
                  <p className="mt-1.5 font-mono text-[10px] text-red-400">
                    Queda igual o por debajo del costo.
                  </p>
                )}
              </div>
            )
          })}
          {lista.length === 0 && (
            <p className="py-8 text-center text-neutral-500">Nada que coincida.</p>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </Modal>
  )
}
