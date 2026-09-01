'use client'

import { useState } from 'react'
import { Modal } from './modal'

/** La lectura es publica; para cambiar precios hace falta la clave del negocio. */
export function PedirClave({ onCerrar, onEntro }: { onCerrar: () => void; onEntro: () => void }) {
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const entrar = async () => {
    setEnviando(true)
    setError(null)
    const r = await fetch('/api/sesion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave }),
    })
    setEnviando(false)
    if (r.ok) return onEntro()
    setError('Clave incorrecta.')
  }

  return (
    <Modal
      titulo="Clave"
      onCerrar={onCerrar}
      pie={
        <button
          onClick={entrar}
          disabled={!clave || enviando}
          className="min-h-[52px] w-full rounded-xl bg-amber-400 font-bold text-neutral-950 disabled:opacity-30"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      }
    >
      <div className="p-4">
        <p className="mb-4 text-sm text-neutral-400">
          Cualquiera puede consultar los precios. Para cambiarlos hace falta la clave.
        </p>
        <input
          autoFocus
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && clave && entrar()}
          placeholder="Clave"
          className="min-h-[52px] w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 text-lg focus:border-amber-400 focus:outline-none"
        />
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </Modal>
  )
}
