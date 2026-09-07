'use client'

import { useState } from 'react'
import {
  calcularVenta,
  cop,
  esPerdida,
  porcentajeDe,
  type Ganancia,
  type TipoGanancia,
} from '@/lib/precios'

interface Props {
  ganancia: Ganancia
  /** Para mostrar en cuanto quedaria la venta con lo que se esta escribiendo. */
  costo: number | null
  onGuardar: (g: Ganancia) => void
}

/**
 * Cuanto se le gana a un producto, en porcentaje o en pesos fijos.
 *
 * Se escribe en la unidad en la que el usuario piensa (30, no 1.30) y se ve al
 * instante en cuanto quedaria la venta, que es lo que de verdad importa decidir.
 */
export function EditorGanancia({ ganancia, costo, onGuardar }: Props) {
  const [tipo, setTipo] = useState<TipoGanancia>(ganancia.tipo)
  const [valor, setValor] = useState(
    ganancia.tipo === 'PESOS' ? String(ganancia.pesos ?? '') : String(porcentajeDe(ganancia.margen)),
  )

  const comoGanancia = (t: TipoGanancia, v: string): Ganancia =>
    t === 'PESOS'
      ? { tipo: 'PESOS', margen: ganancia.margen, pesos: v === '' ? null : Number(v) }
      : { tipo: 'PORCENTAJE', margen: v === '' ? 1 : 1 + Number(v) / 100, pesos: ganancia.pesos }

  const propuesta = comoGanancia(tipo, valor)
  const ventaResultante = costo != null && valor !== '' ? calcularVenta(costo, propuesta) : null

  const cambiarTipo = (t: TipoGanancia) => {
    // Al cambiar de modo se traduce lo que ya estaba, para no partir de cero.
    const equivalente =
      costo == null || costo === 0
        ? ''
        : t === 'PESOS'
          ? String(Math.round(costo * ganancia.margen - costo))
          : String(porcentajeDe((costo + (ganancia.pesos ?? 0)) / costo))
    setTipo(t)
    setValor(ganancia.tipo === t ? valor : equivalente)
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        Cuánto le gano
      </p>

      <div className="flex gap-2">
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-neutral-800">
          {(['PORCENTAJE', 'PESOS'] as const).map((t) => (
            <button
              key={t}
              onClick={() => cambiarTipo(t)}
              className={`min-h-[44px] w-12 font-mono text-sm ${
                tipo === t ? 'bg-amber-400 font-bold text-neutral-950' : 'text-neutral-400'
              }`}
            >
              {t === 'PORCENTAJE' ? '%' : '$'}
            </button>
          ))}
        </div>

        <input
          type="number"
          inputMode="numeric"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={tipo === 'PESOS' ? 'pesos' : '30'}
          className="min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 font-mono tabular-nums focus:border-amber-400 focus:outline-none"
        />

        <button
          onClick={() => onGuardar(propuesta)}
          disabled={valor === ''}
          className="min-h-[44px] shrink-0 rounded-lg bg-amber-400 px-3 font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-950 disabled:opacity-30"
        >
          Guardar
        </button>
      </div>

      {ventaResultante != null && (
        <p className="mt-2 font-mono text-[11px] text-neutral-500">
          Con compra de {cop(costo)} la venta queda en{' '}
          <span className="text-amber-400">{cop(ventaResultante)}</span>
        </p>
      )}

      {esPerdida(costo, propuesta) && (
        <p className="mt-1 font-mono text-[11px] text-red-400">
          Ojo: así lo estarías vendiendo igual o más barato de lo que te cuesta.
        </p>
      )}
    </div>
  )
}
