'use client'

import { useState } from 'react'
import { Modal } from './modal'
import { cop } from '@/lib/precios'
import {
  ETIQUETA_CONFIANZA,
  type CambioRevisable,
  type NoReconocido,
  type Preview,
  type ProductoConPrecio,
} from '@/lib/tipos'

interface Props {
  productos: ProductoConPrecio[]
  /** `huboAltas` avisa que se crearon productos y el catalogo de afuera quedo viejo. */
  onCerrar: (huboAltas: boolean) => void
  onAplicado: (cantidad: number) => void
  onPedirClave: () => void
}

const PLACEHOLDER = `Tomate parejo 3000kg y grueso 4000kg ✅
Fresa 3500lb ✅
Coliseros 2200kg ✅ vender 3200
Mora ❌`

export function ModalLista({ productos, onCerrar, onAplicado, onPedirClave }: Props) {
  const [texto, setTexto] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Si se crearon productos, el catalogo de afuera quedo viejo aunque no se
  // aplique ningun cambio de precio.
  const [huboAltas, setHuboAltas] = useState(false)

  const analizar = async () => {
    setCargando(true)
    setError(null)
    const r = await fetch('/api/actualizacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    })
    setCargando(false)
    if (r.status === 401) return onPedirClave()
    if (!r.ok) return setError('No se pudo interpretar la lista.')
    const datos = await r.json()
    setPreview({
      cambios: datos.cambios.map((c: CambioRevisable) => ({ ...c, aplicar: c.hayCambio })),
      noReconocidos: datos.noReconocidos,
    })
  }

  const aplicar = async () => {
    if (!preview) return
    const marcados = preview.cambios.filter((c) => c.aplicar)
    setCargando(true)
    const r = await fetch('/api/actualizacion/aplicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texto,
        cambios: marcados.map((c) => ({
          productoId: c.producto.id,
          costo: c.despues.costo,
          venta: c.despues.venta,
          disponible: c.despues.disponible,
          aliasNuevo: c.aliasNuevo,
        })),
      }),
    })
    setCargando(false)
    if (r.status === 401) return onPedirClave()
    if (!r.ok) return setError('No se pudieron guardar los cambios.')
    navigator.vibrate?.(20)
    onAplicado(marcados.length)
  }

  const alternar = (i: number) =>
    setPreview((p) =>
      p ? { ...p, cambios: p.cambios.map((c, j) => (j === i ? { ...c, aplicar: !c.aplicar } : c)) } : p,
    )

  /** El usuario dice a que producto pertenecia una linea que el parser no reconocio. */
  const asignar = (noReconocido: NoReconocido, producto: ProductoConPrecio) => {
    setPreview((p) => {
      if (!p) return p
      const costo = noReconocido.valor
      const cambio: CambioRevisable = {
        raw: noReconocido.raw,
        textoDetectado: noReconocido.textoDetectado,
        producto,
        confianza: 'alias',
        antes: {
          costo: producto.costoActual,
          venta: producto.ventaActual,
          disponible: producto.disponible,
        },
        despues: {
          costo: costo ?? producto.costoActual,
          venta: costo ? Math.ceil((costo * producto.margen) / 50) * 50 : producto.ventaActual,
          disponible: noReconocido.disponible,
        },
        hayCambio: true,
        ventaEsExplicita: false,
        unidadDetectada: noReconocido.unidadDetectada,
        convertidoDeLibra: false,
        aplicar: true,
        // Esto es lo que hace que la proxima vez acierte solo.
        aliasNuevo: noReconocido.textoDetectado,
      }
      return {
        cambios: [...p.cambios, cambio],
        noReconocidos: p.noReconocidos.filter((n) => n !== noReconocido),
      }
    })
  }

  /** El producto ya se creo con su precio: sale de la lista de pendientes. */
  const creado = (noReconocido: NoReconocido) => {
    setPreview((p) =>
      p ? { ...p, noReconocidos: p.noReconocidos.filter((n) => n !== noReconocido) } : p,
    )
    setHuboAltas(true)
  }

  const marcados = preview?.cambios.filter((c) => c.aplicar).length ?? 0

  if (!preview) {
    return (
      <Modal
        titulo="Lista del día"
        onCerrar={() => onCerrar(huboAltas)}
        pie={
          <button
            onClick={analizar}
            disabled={!texto.trim() || cargando}
            className="min-h-[52px] w-full rounded-xl bg-amber-400 font-bold text-neutral-950 disabled:opacity-30"
          >
            {cargando ? 'Leyendo…' : 'Ver cambios'}
          </button>
        }
      >
        <div className="p-4">
          <p className="mb-3 text-sm leading-relaxed text-neutral-400">
            Pega la lista tal como te llega, con ✅ y ❌. Entiende kilos y libras, dos precios en una
            línea, y frases como «vender 3200».
          </p>
          <textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={14}
            placeholder={PLACEHOLDER}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-[15px] leading-relaxed placeholder:text-neutral-600 focus:border-amber-400 focus:outline-none"
          />
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      titulo="Revisar cambios"
      onCerrar={() => onCerrar(huboAltas)}
      pie={
        <div className="flex gap-2">
          <button
            onClick={() => setPreview(null)}
            className="min-h-[52px] rounded-xl border border-neutral-700 px-4 font-mono text-[11px] uppercase tracking-wider text-neutral-300"
          >
            Volver
          </button>
          <button
            onClick={aplicar}
            disabled={marcados === 0 || cargando}
            className="min-h-[52px] flex-1 rounded-xl bg-amber-400 font-bold text-neutral-950 disabled:opacity-30"
          >
            {cargando ? 'Guardando…' : `Aplicar ${marcados}`}
          </button>
        </div>
      }
    >
      <div className="space-y-2 p-4">
        {preview.cambios.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No se reconoció ningún producto.</p>
        )}

        {preview.cambios.map((c, i) => {
          const sube = (c.despues.costo ?? 0) > (c.antes.costo ?? 0)
          const baja = (c.despues.costo ?? 0) < (c.antes.costo ?? 0)
          return (
            <button
              key={c.producto.id}
              onClick={() => alternar(i)}
              className={`w-full rounded-xl border p-3 text-left transition-opacity ${
                c.aplicar ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-900 opacity-40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{c.producto.nombre}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {c.confianza !== 'exacto' && (
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        c.confianza === 'difuso'
                          ? 'bg-amber-950 text-amber-500'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {ETIQUETA_CONFIANZA[c.confianza]}
                    </span>
                  )}
                  {c.convertidoDeLibra && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-amber-500">
                      lb ×2
                    </span>
                  )}
                  {!c.hayCambio && (
                    <span className="font-mono text-[10px] uppercase text-neutral-500">igual</span>
                  )}
                </div>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[13px] tabular-nums">
                <span className="text-neutral-500">{cop(c.antes.costo)}</span>
                <span className={sube ? 'text-red-400' : baja ? 'text-green-400' : 'text-neutral-600'}>
                  {sube ? '↑' : baja ? '↓' : '→'}
                </span>
                <span className="font-bold">{cop(c.despues.costo)}</span>
                <span className="text-neutral-700">·</span>
                <span className="text-amber-400">venta {cop(c.despues.venta)}</span>
                {c.ventaEsExplicita && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    fijada
                  </span>
                )}
              </div>

              {!c.despues.disponible && (
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-red-400">
                  sin existencia
                </p>
              )}
              <p className="mt-1.5 truncate font-mono text-[10px] text-neutral-600">{c.raw}</p>
            </button>
          )
        })}

        {preview.noReconocidos.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-900/60 bg-amber-950/20 p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-amber-500">
              No los encontré
            </p>
            {preview.noReconocidos.map((n, k) => (
              <SinReconocer
                key={k}
                item={n}
                productos={productos}
                onAsignar={asignar}
                onCreado={creado}
              />
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </Modal>
  )
}

/** Una linea que el parser no supo emparejar: se crea como producto o se asigna. */
function SinReconocer({
  item,
  productos,
  onAsignar,
  onCreado,
}: {
  item: NoReconocido
  productos: ProductoConPrecio[]
  onAsignar: (n: NoReconocido, p: ProductoConPrecio) => void
  onCreado: (n: NoReconocido) => void
}) {
  const [eligiendo, setEligiendo] = useState(false)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El nombre va con mayuscula inicial, como el resto del catalogo.
  const nombre = item.textoDetectado.charAt(0).toUpperCase() + item.textoDetectado.slice(1)

  const agregar = async () => {
    setCreando(true)
    setError(null)
    // La libra se guarda por kilo, igual que en el resto de la app.
    const unidad =
      item.unidadDetectada === 'lb' ? 'LB' : item.unidadDetectada === 'unidad' ? 'UNIDAD' : 'KG'
    const costo = item.valor == null ? null : item.unidadDetectada === 'lb' ? item.valor * 2 : item.valor

    const r = await fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, unidad, costo, alias: item.textoDetectado }),
    })
    setCreando(false)
    if (!r.ok) return setError((await r.json()).error ?? 'No se pudo crear.')
    onCreado(item)
  }

  return (
    <div className="border-t border-amber-900/40 py-2 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-neutral-300">
          {item.textoDetectado} {item.valor ? cop(item.valor) : ''}
        </span>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={agregar}
            disabled={creando}
            className="min-h-[36px] rounded bg-amber-400 px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-950 disabled:opacity-40"
          >
            {creando ? '…' : 'Agregar'}
          </button>
          <button
            onClick={() => setEligiendo((v) => !v)}
            className="min-h-[36px] rounded border border-amber-700 px-2 font-mono text-[10px] uppercase tracking-wider text-amber-400"
          >
            {eligiendo ? 'Cancelar' : 'Es este otro'}
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {eligiendo && (
        <select
          autoFocus
          defaultValue=""
          onChange={(e) => {
            const p = productos.find((x) => x.id === e.target.value)
            if (p) onAsignar(item, p)
          }}
          className="mt-2 min-h-[44px] w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-sm"
        >
          <option value="" disabled>
            Elige el producto…
          </option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
