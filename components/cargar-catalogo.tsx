'use client'

import { useState } from 'react'
import { PedirClave } from './pedir-clave'

/**
 * Carga los 112 productos tras el primer despliegue, desde el mismo navegador.
 *
 * Sin esto habria que clonar el repo y correr el seed por terminal, que no sirve
 * de nada si estas con el celular en la mano.
 */
export function CargarCatalogo() {
  const [estado, setEstado] = useState<'listo' | 'cargando' | 'clave'>('listo')
  const [error, setError] = useState<string | null>(null)

  const cargar = async () => {
    setEstado('cargando')
    setError(null)
    try {
      const r = await fetch('/api/setup', { method: 'POST' })
      if (r.status === 401) {
        setEstado('clave')
        return
      }
      if (!r.ok) {
        setError((await r.json()).error ?? 'No se pudo cargar el catálogo.')
        setEstado('listo')
        return
      }
      // Recarga entera: la home se renderiza en el servidor y ahora sí hay datos.
      window.location.reload()
    } catch {
      setError('No hubo respuesta del servidor.')
      setEstado('listo')
    }
  }

  return (
    <>
      <button
        onClick={cargar}
        disabled={estado === 'cargando'}
        className="min-h-[52px] w-full rounded-xl bg-amber-400 px-6 font-bold text-neutral-950 disabled:opacity-40"
      >
        {estado === 'cargando' ? 'Cargando…' : 'Cargar los 112 productos'}
      </button>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {estado === 'clave' && (
        <PedirClave onCerrar={() => setEstado('listo')} onEntro={cargar} />
      )}
    </>
  )
}
