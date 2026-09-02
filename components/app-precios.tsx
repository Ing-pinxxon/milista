'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FilaProducto } from './fila-producto'
import { ModalCompras } from './modal-compras'
import { ModalLista } from './modal-lista'
import { ModalNuevo } from './modal-nuevo'
import { PedirClave } from './pedir-clave'
import { normalizar } from '@/lib/normalizar'
import { guardarCatalogo, leerCatalogo } from '@/lib/offline'
import type { ProductoConPrecio } from '@/lib/tipos'

type Modo = 'lista' | 'compras' | 'nuevo' | 'clave' | null

const hoyISO = () => new Date().toISOString().slice(0, 10)

export function AppPrecios({
  inicial,
  puedeEscribir: puedeEscribirInicial,
}: {
  inicial: ProductoConPrecio[]
  puedeEscribir: boolean
}) {
  const [productos, setProductos] = useState(inicial)
  const [puedeEscribir, setPuedeEscribir] = useState(puedeEscribirInicial)
  const [q, setQ] = useState('')
  const [modo, setModo] = useState<Modo>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [sinConexion, setSinConexion] = useState(false)
  const caja = useRef<HTMLInputElement>(null)

  // El catalogo se guarda en el celular para poder consultar precios en la plaza
  // sin senal. Si el servidor no responde, se muestra lo ultimo que se vio.
  useEffect(() => {
    guardarCatalogo(inicial)
  }, [inicial])

  useEffect(() => {
    const alCambiarRed = () => setSinConexion(!navigator.onLine)
    alCambiarRed()
    window.addEventListener('online', alCambiarRed)
    window.addEventListener('offline', alCambiarRed)
    return () => {
      window.removeEventListener('online', alCambiarRed)
      window.removeEventListener('offline', alCambiarRed)
    }
  }, [])

  const refrescar = async () => {
    try {
      const r = await fetch('/api/productos', { cache: 'no-store' })
      if (!r.ok) throw new Error('sin respuesta')
      const { productos: frescos } = await r.json()
      setProductos(frescos)
      guardarCatalogo(frescos)
    } catch {
      const guardado = await leerCatalogo()
      if (guardado?.length) setProductos(guardado)
    }
  }

  const flash = (m: string) => {
    setAviso(m)
    setTimeout(() => setAviso(null), 2500)
  }

  const editar = async (id: string, costo: number | null, venta: number | null) => {
    const r = await fetch(`/api/productos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ costo, venta }),
    })
    if (r.status === 401) return setModo('clave')
    if (r.ok) {
      setProductos((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, costoActual: costo, ventaActual: venta, fechaPrecio: new Date().toISOString(), origenPrecio: 'MANUAL' as const }
            : p,
        ),
      )
    }
  }

  const resultados = useMemo(() => {
    const t = normalizar(q)
    // Sin busqueda se muestran los que tienen precio: es la vista util al abrir.
    if (!t) return productos.filter((p) => p.ventaActual != null).slice(0, 15)
    return productos
      .filter((p) => normalizar(p.nombre).includes(t) || p.aliases.some((a) => a.includes(t)))
      .sort(
        (a, b) =>
          Number(normalizar(b.nombre).startsWith(t)) - Number(normalizar(a.nombre).startsWith(t)),
      )
  }, [productos, q])

  // Solo cuentan los precios que alguien cambio hoy, no la carga inicial.
  const actualizadosHoy = productos.filter(
    (p) => p.fechaPrecio?.slice(0, 10) === hoyISO() && p.origenPrecio !== 'SEED',
  ).length

  const copiarColumnas = () => {
    // Dos columnas en el orden exacto de la hoja de calculo, para pegar encima.
    const txt = productos
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((p) => `${p.costoActual ?? ''}\t${p.ventaActual ?? ''}`)
      .join('\n')
    navigator.clipboard?.writeText(txt).then(
      () => flash('Columnas copiadas'),
      () => flash('No se pudo copiar'),
    )
  }

  return (
    <div className="min-h-screen pb-40">
      <div className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950 px-4 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <input
          ref={caja}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escribe el producto…"
          autoComplete="off"
          enterKeyHint="search"
          className="min-h-[56px] w-full rounded-2xl border-2 border-neutral-800 bg-neutral-900 px-4 text-xl placeholder:text-neutral-600 focus:border-amber-400 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            {sinConexion && <span className="text-amber-500">sin señal · </span>}
            {actualizadosHoy > 0
              ? `${actualizadosHoy} actualizado${actualizadosHoy === 1 ? '' : 's'} hoy`
              : `${productos.length} productos`}
          </span>
          {q && (
            <button
              onClick={() => setQ('')}
              className="font-mono text-[11px] uppercase text-neutral-500"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {resultados.length === 0 ? (
        <div className="mt-14 px-4 text-center">
          <p className="mb-4 text-neutral-500">No está en la lista.</p>
          {q && (
            <button
              onClick={() => setModo(puedeEscribir ? 'nuevo' : 'clave')}
              className="min-h-[48px] rounded-xl bg-amber-400 px-5 font-bold text-neutral-950"
            >
              Agregar «{q}»
            </button>
          )}
        </div>
      ) : (
        <div>
          {resultados.map((p) => (
            <FilaProducto
              key={p.id}
              producto={p}
              puedeEscribir={puedeEscribir}
              onEditar={editar}
              onPedirClave={() => setModo('clave')}
            />
          ))}
        </div>
      )}

      {aviso && (
        <div className="fixed bottom-32 left-1/2 z-40 -translate-x-1/2 animate-fade-in rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-neutral-950">
          {aviso}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-800 bg-neutral-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          <button
            onClick={() => setModo(puedeEscribir ? 'lista' : 'clave')}
            className="min-h-[52px] flex-1 rounded-xl bg-amber-400 font-bold text-neutral-950 active:opacity-80"
          >
            Pegar lista del día
          </button>
          <button
            onClick={() => setModo(puedeEscribir ? 'compras' : 'clave')}
            className="min-h-[52px] flex-1 rounded-xl border-2 border-amber-400 font-bold text-amber-400 active:opacity-80"
          >
            Lista de compras
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setModo(puedeEscribir ? 'nuevo' : 'clave')}
            className="min-h-[40px] flex-1 rounded-lg border border-neutral-800 font-mono text-[10px] uppercase tracking-wider text-neutral-500"
          >
            + Producto
          </button>
        </div>
        {/* Las dos exportaciones llevan el precio de compra: solo con clave. */}
        {puedeEscribir && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={copiarColumnas}
              className="min-h-[40px] flex-1 rounded-lg border border-neutral-800 font-mono text-[10px] uppercase tracking-wider text-neutral-500"
            >
              Copiar columnas
            </button>
            <a
              href="/api/export/csv"
              className="flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-neutral-800 font-mono text-[10px] uppercase tracking-wider text-neutral-500"
            >
              Descargar CSV
            </a>
          </div>
        )}
      </div>

      {modo === 'lista' && (
        <ModalLista
          productos={productos}
          onCerrar={(huboAltas) => {
            setModo(null)
            // Se crearon productos aunque no se aplicara ninguna lista.
            if (huboAltas) refrescar()
          }}
          onPedirClave={() => setModo('clave')}
          onAplicado={(n) => {
            setModo(null)
            flash(`${n} actualizado${n === 1 ? '' : 's'}`)
            refrescar()
          }}
        />
      )}

      {modo === 'compras' && (
        <ModalCompras
          productos={productos}
          onCerrar={(huboCambios) => {
            setModo(null)
            if (huboCambios) refrescar()
          }}
          onPedirClave={() => setModo('clave')}
          onAplicado={(n) => {
            setModo(null)
            flash(n === 0 ? 'Lista cerrada' : `${n} precio${n === 1 ? '' : 's'} actualizado${n === 1 ? '' : 's'}`)
            refrescar()
          }}
        />
      )}

      {modo === 'nuevo' && (
        <ModalNuevo
          nombreInicial={q}
          onCerrar={() => setModo(null)}
          onPedirClave={() => setModo('clave')}
          onCreado={(nombre) => {
            setModo(null)
            setQ('')
            flash(`${nombre} agregado`)
            refrescar()
          }}
        />
      )}

      {modo === 'clave' && (
        <PedirClave
          onCerrar={() => setModo(null)}
          onEntro={() => {
            setPuedeEscribir(true)
            setModo(null)
            flash('Ya puedes hacer cambios')
            // El catalogo en memoria vino sin compras ni margenes: hay que pedirlo
            // otra vez ahora que hay clave.
            refrescar()
          }}
        />
      )}
    </div>
  )
}
