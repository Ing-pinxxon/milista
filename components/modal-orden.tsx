'use client'

import { useMemo } from 'react'
import { Modal } from './modal'
import { moverEnRuta } from '@/lib/recorrido'
import { usarArrastre } from '@/lib/usar-arrastre'
import type { ProductoConPrecio } from '@/lib/tipos'

interface Props {
  productos: ProductoConPrecio[]
  /** El recorrido completo: es lo que se muestra y lo que se edita. */
  ruta: string[]
  onCambiarRecorrido: (ruta: string[]) => void
  onCerrar: () => void
}

/**
 * El orden de la plaza, para acomodarlo de corrido.
 *
 * Muestra TODOS los productos, no solo los que tienen precio: si un producto
 * puede aparecer en una lista, tiene que poder acomodarse aqui. Cada arrastre se
 * guarda solo; no hay boton de guardar que se pueda olvidar.
 */
export function ModalOrden({ productos, ruta, onCambiarRecorrido, onCerrar }: Props) {
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const vista = useMemo(
    () => ruta.map((id) => porId.get(id)).filter((p): p is ProductoConPrecio => p != null),
    [ruta, porId],
  )

  const arrastre = usarArrastre({
    cantidad: vista.length,
    arrastrables: vista.length,
    onSoltar: (desde, hasta) => {
      onCambiarRecorrido(moverEnRuta(ruta, vista.map((p) => p.id), desde, hasta))
      navigator.vibrate?.(10)
    },
  })

  return (
    <Modal
      titulo="Orden de la plaza"
      onCerrar={onCerrar}
      pie={
        <button
          onClick={onCerrar}
          className="min-h-[52px] w-full rounded-xl bg-amber-400 font-bold text-neutral-950"
        >
          Listo
        </button>
      }
    >
      <div className="p-4">
        <p className="mb-3 text-sm leading-relaxed text-neutral-400">
          Acomoda los productos como los recorres en la plaza. Toda lista sale en este orden y
          lo que añadas cae en su puesto. Se guarda solo al soltar.
        </p>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-neutral-600">
          Mantén pulsado para mover · cerca del borde se desplaza solo
        </p>

        <div ref={arrastre.refContenedor} className="space-y-1.5">
          {vista.map((p, i) => {
            const alzado = arrastre.alzado === i
            return (
              <div
                key={p.id}
                {...arrastre.propsDe(i)}
                className={`flex select-none items-center gap-3 rounded-xl border px-3 py-3 ${
                  alzado
                    ? 'border-amber-400 bg-neutral-800 shadow-lg shadow-black/50'
                    : 'border-neutral-800 bg-neutral-950'
                }`}
              >
                <span className="w-7 shrink-0 text-right font-mono text-[11px] text-neutral-600">
                  {i + 1}
                </span>
                <span className="font-mono text-neutral-600">⠿</span>
                <span className="truncate">{p.nombre}</span>
                {p.ventaActual == null && p.costoActual == null && (
                  <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wider text-neutral-700">
                    sin precio
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
