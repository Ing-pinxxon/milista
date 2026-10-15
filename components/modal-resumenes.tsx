'use client'

import { useEffect, useState } from 'react'
import { Modal } from './modal'
import { ResumenCompra } from './resumen-compra'
import { armarResumen, cambioDePrecio, fechaCorta } from '@/lib/resumen'
import type { ResumenCompra as Resumen } from '@/app/api/listas/resumenes/route'

/**
 * Las ultimas compras cerradas, para volver a copiar su resumen: por si se
 * olvido mandarlo o hay que reenviarlo.
 */
export function ModalResumenes({ onCerrar }: { onCerrar: () => void }) {
  const [resumenes, setResumenes] = useState<Resumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/listas/resumenes', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { resumenes: Resumen[] }) => setResumenes(d.resumenes))
      .catch(() => setError('No se pudieron traer las compras anteriores.'))
  }, [])

  return (
    <Modal titulo="Compras anteriores" onCerrar={onCerrar}>
      <div className="space-y-4 p-4">
        {resumenes == null && !error && (
          <p className="py-8 text-center font-mono text-xs uppercase tracking-[0.3em] text-neutral-600">
            cargando
          </p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {resumenes?.length === 0 && (
          <p className="py-8 text-center text-neutral-500">Todavía no has cerrado ninguna compra.</p>
        )}
        {resumenes?.map((r) => {
          const fecha = new Date(r.fecha)
          const n = r.cambios.filter(cambioDePrecio).length
          return (
            <div key={r.listaId} className="space-y-2">
              <p className="font-medium">
                {fechaCorta(fecha)}
                <span className="ml-2 font-mono text-[11px] text-neutral-500">
                  {n === 0 ? 'sin cambios de precio' : n === 1 ? '1 precio cambió' : `${n} precios cambiaron`}
                </span>
              </p>
              <ResumenCompra texto={armarResumen(fecha, r.cambios)} />
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
