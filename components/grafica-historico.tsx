'use client'

import { useMemo, useState } from 'react'
import { cop } from '@/lib/precios'

export interface PuntoPrecio {
  costo: number | null
  venta: number | null
  fecha: string
}

// Paleta validada contra el fondo #0a0a0a: banda de luminosidad, piso de croma,
// separacion para daltonismo (ΔE 32 protan) y contraste >= 3:1.
const COLOR_VENTA = '#d97706'
const COLOR_COSTO = '#2563eb'

// Medidas pensadas para que en un celular el SVG salga a escala 1:1 y el texto
// del eje sea legible; en pantalla grande se limita el ancho para que no crezca.
const ALTO = 260
const ANCHO = 400
const MARGEN = { arriba: 14, derecha: 14, abajo: 26, izquierda: 52 }

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

export function GraficaHistorico({ puntos }: { puntos: PuntoPrecio[] }) {
  const [activo, setActivo] = useState<number | null>(null)
  const [verTabla, setVerTabla] = useState(false)

  const escala = useMemo(() => {
    const valores = puntos.flatMap((p) => [p.costo, p.venta]).filter((v): v is number => v != null)
    if (valores.length === 0) return null

    const min = Math.min(...valores)
    const max = Math.max(...valores)
    // Un respiro arriba y abajo para que la linea no toque los bordes.
    const colchon = (max - min) * 0.15 || max * 0.1 || 100
    const y0 = Math.max(0, min - colchon)
    const y1 = max + colchon

    const tiempos = puntos.map((p) => new Date(p.fecha).getTime())
    const t0 = Math.min(...tiempos)
    const t1 = Math.max(...tiempos)

    const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha
    const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo

    return {
      y0,
      y1,
      // Con un solo punto (o varios el mismo dia) se centra en vez de dividir por cero.
      x: (t: number) => (t1 === t0 ? MARGEN.izquierda + anchoUtil / 2 : MARGEN.izquierda + ((t - t0) / (t1 - t0)) * anchoUtil),
      y: (v: number) => MARGEN.arriba + altoUtil - ((v - y0) / (y1 - y0)) * altoUtil,
    }
  }, [puntos])

  if (!escala) {
    return (
      <p className="rounded-xl border border-neutral-800 p-8 text-center text-neutral-500">
        Este producto todavía no tiene precios registrados.
      </p>
    )
  }

  const serie = (campo: 'costo' | 'venta') =>
    puntos
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p[campo] != null)
      .map(({ p }) => ({ x: escala.x(new Date(p.fecha).getTime()), y: escala.y(p[campo] as number) }))

  const linea = (pts: { x: number; y: number }[]) =>
    pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ')

  const ventas = serie('venta')
  const costos = serie('costo')
  // Sin clave no llegan costos: la grafica se queda solo con la venta y no debe
  // anunciar una serie que no existe.
  const hayCostos = costos.length > 0

  const marcasY = [escala.y0, (escala.y0 + escala.y1) / 2, escala.y1]
  const punto = activo != null ? puntos[activo] : null

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 font-mono text-[11px] uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm" style={{ background: COLOR_VENTA }} />
          <span className="text-neutral-400">Venta</span>
        </span>
        {hayCostos && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm" style={{ background: COLOR_COSTO }} />
            <span className="text-neutral-400">Compra</span>
          </span>
        )}
        <button
          onClick={() => setVerTabla((v) => !v)}
          className="ml-auto text-neutral-500 underline underline-offset-2"
        >
          {verTabla ? 'Ver gráfica' : 'Ver tabla'}
        </button>
      </div>

      {verTabla ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-left font-mono text-sm tabular-nums">
            <thead className="border-b border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-normal">Fecha</th>
                {hayCostos && <th className="px-3 py-2 font-normal">Compra</th>}
                <th className="px-3 py-2 font-normal">Venta</th>
              </tr>
            </thead>
            <tbody>
              {[...puntos].reverse().map((p, i) => (
                <tr key={i} className="border-b border-neutral-900 last:border-0">
                  <td className="px-3 py-2 text-neutral-400">{fmtFecha(p.fecha)}</td>
                  {hayCostos && <td className="px-3 py-2">{cop(p.costo)}</td>}
                  <td className="px-3 py-2 text-amber-400">{cop(p.venta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <svg
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            className="w-full max-w-[560px]"
            role="img"
            aria-label="Evolución del precio de compra y de venta en el tiempo"
            onMouseLeave={() => setActivo(null)}
          >
            {/* Rejilla recesiva */}
            {marcasY.map((v, i) => (
              <g key={i}>
                <line
                  x1={MARGEN.izquierda}
                  x2={ANCHO - MARGEN.derecha}
                  y1={escala.y(v)}
                  y2={escala.y(v)}
                  stroke="#262626"
                  strokeWidth="1"
                />
                <text
                  x={MARGEN.izquierda - 8}
                  y={escala.y(v) + 4}
                  textAnchor="end"
                  className="fill-neutral-600 font-mono text-[11px]"
                >
                  {cop(v)}
                </text>
              </g>
            ))}

            {costos.length > 1 && (
              <path d={linea(costos)} fill="none" stroke={COLOR_COSTO} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {ventas.length > 1 && (
              <path d={linea(ventas)} fill="none" stroke={COLOR_VENTA} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Con un solo registro no hay linea que dibujar: se marcan los puntos. */}
            {costos.map((d, i) => (
              <circle key={`c${i}`} cx={d.x} cy={d.y} r={activo === i ? 5 : 3} fill={COLOR_COSTO} stroke="#0a0a0a" strokeWidth="2" />
            ))}
            {ventas.map((d, i) => (
              <circle key={`v${i}`} cx={d.x} cy={d.y} r={activo === i ? 5 : 3} fill={COLOR_VENTA} stroke="#0a0a0a" strokeWidth="2" />
            ))}

            {/* Zonas de toque anchas: el dedo no acierta un punto de 3px. */}
            {puntos.map((p, i) => {
              const x = escala.x(new Date(p.fecha).getTime())
              const ancho = (ANCHO - MARGEN.izquierda - MARGEN.derecha) / Math.max(puntos.length, 1)
              return (
                <rect
                  key={i}
                  x={x - ancho / 2}
                  y={MARGEN.arriba}
                  width={ancho}
                  height={ALTO - MARGEN.arriba - MARGEN.abajo}
                  fill="transparent"
                  onMouseEnter={() => setActivo(i)}
                  onTouchStart={() => setActivo(i)}
                />
              )
            })}

            {activo != null && (
              <line
                x1={escala.x(new Date(puntos[activo].fecha).getTime())}
                x2={escala.x(new Date(puntos[activo].fecha).getTime())}
                y1={MARGEN.arriba}
                y2={ALTO - MARGEN.abajo}
                stroke="#525252"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            )}

            <text x={MARGEN.izquierda} y={ALTO - 8} className="fill-neutral-600 font-mono text-[11px]">
              {fmtFecha(puntos[0].fecha)}
            </text>
            <text x={ANCHO - MARGEN.derecha} y={ALTO - 8} textAnchor="end" className="fill-neutral-600 font-mono text-[11px]">
              {fmtFecha(puntos[puntos.length - 1].fecha)}
            </text>
          </svg>

          {punto && (
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-[13px] tabular-nums">
              <span className="text-neutral-400">{fmtFecha(punto.fecha)}</span>
              {hayCostos && <span style={{ color: COLOR_COSTO }}>compra {cop(punto.costo)}</span>}
              <span style={{ color: COLOR_VENTA }}>venta {cop(punto.venta)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
