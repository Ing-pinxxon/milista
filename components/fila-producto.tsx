'use client'

import { useState } from 'react'
import { cop, calcularVenta } from '@/lib/precios'
import { ETIQUETA_UNIDAD, type ProductoConPrecio } from '@/lib/tipos'

const hoyISO = () => new Date().toISOString().slice(0, 10)

interface Props {
  producto: ProductoConPrecio
  puedeEscribir: boolean
  onEditar: (id: string, costo: number | null, venta: number | null) => void
  onPedirClave: () => void
}

/**
 * Una fila de la lista. El precio de venta manda visualmente: es lo que se
 * consulta a diario. Los campos de edicion viven en un panel que se abre al
 * tocar la fila, para que la lista se pueda barrer con la vista sin ruido.
 */
export function FilaProducto({ producto, puedeEscribir, onEditar, onPedirClave }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [costo, setCosto] = useState(producto.costoActual?.toString() ?? '')
  const [venta, setVenta] = useState(producto.ventaActual?.toString() ?? '')

  const esDeHoy = producto.fechaPrecio?.slice(0, 10) === hoyISO() && producto.origenPrecio !== 'SEED'

  const guardar = (nuevoCosto: string, nuevaVenta: string) => {
    if (!puedeEscribir) return onPedirClave()
    onEditar(
      producto.id,
      nuevoCosto === '' ? null : Number(nuevoCosto),
      nuevaVenta === '' ? null : Number(nuevaVenta),
    )
  }

  const aplicarMargen = () => {
    if (costo === '') return
    const v = String(calcularVenta(Number(costo), producto.margen))
    setVenta(v)
    guardar(costo, v)
  }

  return (
    <div className="border-b border-neutral-900">
      <button
        onClick={() => puedeEscribir && setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-neutral-900"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-[17px] leading-tight">
            {producto.nombre}
            {!producto.disponible && (
              <span className="shrink-0 rounded bg-red-950 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-400">
                no hay
              </span>
            )}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            {producto.unidad ? ETIQUETA_UNIDAD[producto.unidad] : '—'}
            {/* La compra solo se muestra con clave: es dato del negocio, no del cliente. */}
            {puedeEscribir && <> · compra {cop(producto.costoActual)}</>}
            {esDeHoy && <span className="text-amber-500"> · hoy</span>}
          </p>
        </div>
        <p className="shrink-0 font-mono text-3xl font-bold leading-none tabular-nums text-amber-400">
          {cop(producto.ventaActual)}
        </p>
      </button>

      {abierto && puedeEscribir && (
        <div className="animate-fade-in space-y-3 bg-neutral-900/50 px-4 pb-4 pt-1">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                Compra
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                onBlur={() => guardar(costo, venta)}
                className="min-h-[44px] w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 font-mono tabular-nums focus:border-amber-400 focus:outline-none"
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                Venta
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={venta}
                onChange={(e) => setVenta(e.target.value)}
                onBlur={() => guardar(costo, venta)}
                className="min-h-[44px] w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 font-mono tabular-nums text-amber-400 focus:border-amber-400 focus:outline-none"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={aplicarMargen}
              disabled={costo === ''}
              className="min-h-[44px] flex-1 rounded-xl border border-neutral-700 font-mono text-[11px] uppercase tracking-wider text-neutral-300 disabled:opacity-30"
            >
              Aplicar margen ×{producto.margen.toFixed(2)}
            </button>
            <a
              href={`/historico/${producto.slug}`}
              className="flex min-h-[44px] items-center rounded-xl border border-neutral-700 px-4 font-mono text-[11px] uppercase tracking-wider text-neutral-300"
            >
              Histórico
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
