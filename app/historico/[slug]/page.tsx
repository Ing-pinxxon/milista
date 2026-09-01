import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GraficaHistorico } from '@/components/grafica-historico'
import { prisma } from '@/lib/prisma'
import { cop } from '@/lib/precios'
import { ETIQUETA_UNIDAD } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

export default async function Historico({ params }: { params: { slug: string } }) {
  const producto = await prisma.producto.findUnique({
    where: { slug: params.slug },
    select: {
      nombre: true,
      unidad: true,
      margen: true,
      disponible: true,
      precios: {
        orderBy: { fecha: 'asc' },
        select: { costo: true, venta: true, fecha: true },
      },
    },
  })

  if (!producto) notFound()

  const puntos = producto.precios.map((p) => ({
    costo: p.costo,
    venta: p.venta,
    fecha: p.fecha.toISOString(),
  }))

  const ultimo = puntos[puntos.length - 1]
  const primero = puntos[0]
  const variacion =
    primero?.costo && ultimo?.costo && puntos.length > 1
      ? ((ultimo.costo - primero.costo) / primero.costo) * 100
      : null

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <Link
        href="/"
        className="inline-flex min-h-[44px] items-center font-mono text-[11px] uppercase tracking-wider text-neutral-500"
      >
        ← Volver
      </Link>

      <header className="mb-6 mt-2">
        <h1 className="text-2xl font-bold tracking-tight">{producto.nombre}</h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          {producto.unidad ? ETIQUETA_UNIDAD[producto.unidad] : '—'} · margen ×
          {Number(producto.margen).toFixed(2)} · {puntos.length} registro
          {puntos.length === 1 ? '' : 's'}
          {!producto.disponible && <span className="text-red-400"> · sin existencia</span>}
        </p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-2">
        <Tarjeta etiqueta="Compra hoy" valor={cop(ultimo?.costo)} />
        <Tarjeta etiqueta="Venta hoy" valor={cop(ultimo?.venta)} acento />
        <Tarjeta
          etiqueta="Variación"
          valor={variacion == null ? '—' : `${variacion > 0 ? '+' : ''}${variacion.toFixed(0)}%`}
        />
      </div>

      <GraficaHistorico puntos={puntos} />
    </main>
  )
}

function Tarjeta({ etiqueta, valor, acento }: { etiqueta: string; valor: string; acento?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-800 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{etiqueta}</p>
      <p
        className={`mt-1 font-mono text-lg font-bold tabular-nums ${acento ? 'text-amber-400' : 'text-neutral-100'}`}
      >
        {valor}
      </p>
    </div>
  )
}
