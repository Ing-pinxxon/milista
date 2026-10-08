'use client'

import { useMemo, useState } from 'react'
import { Modal } from './modal'
import { moverItem } from '@/lib/compras'
import { usarArrastre } from '@/lib/usar-arrastre'
import type { ProductoConPrecio } from '@/lib/tipos'

interface Props {
  productos: ProductoConPrecio[]
  onCerrar: (huboCambios: boolean) => void
  onPedirClave: () => void
}

/**
 * El orden fijo del recorrido por la plaza.
 *
 * Se ordena una vez y desde ahi toda lista nueva sale asi, y cada producto que
 * se añade cae en su puesto en vez de irse al final.
 */
export function ModalOrden({ productos, onCerrar, onPedirClave }: Props) {
  // Se ordenan solo los que de verdad se compran: los que tienen precio.
  const inicial = useMemo(
    () =>
      productos
        .filter((p) => p.ventaActual != null || p.costoActual != null)
        .sort((a, b) => {
          const oa = a.ordenCompra
          const ob = b.ordenCompra
          if (oa != null && ob != null) return oa - ob
          if (oa != null) return -1
          if (ob != null) return 1
          return a.orden - b.orden
        }),
    [productos],
  )

  const [orden, setOrden] = useState(inicial)
  const [tocado, setTocado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const arrastre = usarArrastre(orden.length, (desde, hasta) => {
    setOrden((xs) => moverItem(xs, desde, hasta))
    setTocado(true)
    navigator.vibrate?.(10)
  })

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    const r = await fetch('/api/productos/orden', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: orden.map((p) => p.id) }),
    })
    setGuardando(false)
    if (r.status === 401) return onPedirClave()
    if (!r.ok) return setError('No se pudo guardar el orden.')
    onCerrar(true)
  }

  return (
    <Modal
      titulo="Orden de la plaza"
      onCerrar={() => onCerrar(false)}
      pie={
        <button
          onClick={guardar}
          disabled={!tocado || guardando}
          className="min-h-[52px] w-full rounded-xl bg-amber-400 font-bold text-neutral-950 disabled:opacity-30"
        >
          {guardando ? 'Guardando…' : tocado ? 'Guardar el orden' : 'Sin cambios'}
        </button>
      }
    >
      <div className="p-4">
        <p className="mb-3 text-sm leading-relaxed text-neutral-400">
          Acomoda los productos como los recorres en la plaza. Toda lista que armes va a salir
          en este orden, y lo que añadas va a caer en su puesto en vez de irse al final.
        </p>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-neutral-600">
          Mantén pulsado para mover · al llegar al borde se desplaza solo
        </p>

        <div ref={arrastre.refContenedor as React.RefObject<HTMLDivElement>} className="space-y-1.5">
          {orden.map((p, i) => {
            const alzado = arrastre.arrastre.indice === i
            return (
              <div
                key={p.id}
                ref={(el) => arrastre.registrarFila(i, el)}
                {...arrastre.manejadores(i)}
                style={{
                  transform: `translateY(${
                    alzado ? arrastre.arrastre.desplazamiento : arrastre.desplazamientoDe(i)
                  }px)`,
                  transition: alzado ? 'none' : 'transform 160ms ease',
                  touchAction: arrastre.arrastre.indice != null ? 'none' : 'manipulation',
                }}
                className={`flex select-none items-center gap-3 rounded-xl border px-3 py-3 ${
                  alzado
                    ? 'relative z-10 scale-[1.02] border-amber-400 bg-neutral-800 shadow-lg shadow-black/50'
                    : 'border-neutral-800 bg-neutral-950'
                }`}
              >
                <span className="w-7 shrink-0 text-right font-mono text-[11px] text-neutral-600">
                  {i + 1}
                </span>
                <span className="font-mono text-neutral-600">⠿</span>
                <span className="truncate">{p.nombre}</span>
              </div>
            )
          })}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </Modal>
  )
}
