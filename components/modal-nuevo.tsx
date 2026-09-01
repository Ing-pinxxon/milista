'use client'

import { useState } from 'react'
import { Modal } from './modal'
import type { Unidad } from '@prisma/client'

const UNIDADES: { valor: Unidad; etiqueta: string }[] = [
  { valor: 'KG', etiqueta: 'Kg' },
  { valor: 'LB', etiqueta: 'Lb' },
  { valor: 'UNIDAD', etiqueta: 'C/u' },
  { valor: 'PAQUETE', etiqueta: 'Paquete' },
]

export function ModalNuevo({
  nombreInicial,
  onCerrar,
  onCreado,
  onPedirClave,
}: {
  nombreInicial: string
  onCerrar: () => void
  onCreado: (nombre: string) => void
  onPedirClave: () => void
}) {
  const [nombre, setNombre] = useState(nombreInicial)
  const [unidad, setUnidad] = useState<Unidad>('KG')
  const [costo, setCosto] = useState('')
  const [venta, setVenta] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const guardar = async () => {
    setEnviando(true)
    setError(null)
    const r = await fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        unidad,
        costo: costo === '' ? null : Number(costo),
        venta: venta === '' ? null : Number(venta),
      }),
    })
    setEnviando(false)
    if (r.status === 401) return onPedirClave()
    if (!r.ok) return setError((await r.json()).error ?? 'No se pudo crear.')
    onCreado(nombre)
  }

  return (
    <Modal
      titulo="Nuevo producto"
      onCerrar={onCerrar}
      pie={
        <button
          onClick={guardar}
          disabled={!nombre.trim() || enviando}
          className="min-h-[52px] w-full rounded-xl bg-amber-400 font-bold text-neutral-950 disabled:opacity-30"
        >
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      }
    >
      <div className="space-y-4 p-4">
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
          className="min-h-[52px] w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 text-lg focus:border-amber-400 focus:outline-none"
        />

        <div className="grid grid-cols-4 gap-2">
          {UNIDADES.map((u) => (
            <button
              key={u.valor}
              onClick={() => setUnidad(u.valor)}
              className={`min-h-[44px] rounded-xl border font-mono text-xs uppercase tracking-wider ${
                unidad === u.valor
                  ? 'border-amber-400 bg-amber-400 font-bold text-neutral-950'
                  : 'border-neutral-800 text-neutral-400'
              }`}
            >
              {u.etiqueta}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            placeholder="Compra"
            className="min-h-[52px] flex-1 rounded-xl border border-neutral-800 bg-neutral-900 px-4 font-mono tabular-nums focus:border-amber-400 focus:outline-none"
          />
          <input
            type="number"
            inputMode="numeric"
            value={venta}
            onChange={(e) => setVenta(e.target.value)}
            placeholder="Venta"
            className="min-h-[52px] flex-1 rounded-xl border border-neutral-800 bg-neutral-900 px-4 font-mono tabular-nums text-amber-400 focus:border-amber-400 focus:outline-none"
          />
        </div>

        <p className="text-sm text-neutral-500">
          Si dejas la venta vacía se calcula con margen ×1.30. Después puedes ajustarla y el margen
          del producto queda con lo que pongas.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </Modal>
  )
}
