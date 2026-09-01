import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { obtenerCatalogo } from '@/lib/consultas'
import { limpiarNombre, slugificar } from '@/lib/normalizar'
import { calcularVenta } from '@/lib/precios'
import { prisma } from '@/lib/prisma'
import type { Unidad } from '@prisma/client'

// Publica: es lo que la PWA cachea para funcionar sin senal.
export const dynamic = 'force-dynamic'

export async function GET() {
  const productos = await obtenerCatalogo()
  return Response.json({ productos })
}

/** Crea un producto que la lista trajo y el catalogo todavia no tenia. */
export async function POST(req: Request) {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const body = (await req.json()) as {
    nombre?: string
    unidad?: Unidad | null
    costo?: number | null
    venta?: number | null
    margen?: number
    alias?: string
  }

  const nombre = body.nombre?.trim()
  if (!nombre) return Response.json({ error: 'Falta el nombre.' }, { status: 400 })

  const slug = slugificar(nombre)
  if (await prisma.producto.findUnique({ where: { slug }, select: { id: true } })) {
    return Response.json({ error: 'Ya existe un producto con ese nombre.' }, { status: 409 })
  }

  const costo = body.costo ?? null
  const margen = body.margen ?? (costo && body.venta ? body.venta / costo : 1.3)
  const venta = body.venta ?? (costo ? calcularVenta(costo, margen) : null)

  // Va al final de la hoja de calculo para no correr las filas existentes.
  const ultimo = await prisma.producto.findFirst({ orderBy: { orden: 'desc' }, select: { orden: true } })

  const producto = await prisma.producto.create({
    data: {
      nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
      slug,
      unidad: body.unidad ?? null,
      margen: Number(margen.toFixed(6)),
      orden: (ultimo?.orden ?? -1) + 1,
      aliases: body.alias ? [limpiarNombre(body.alias)] : [],
      precios: costo != null || venta != null ? { create: { costo, venta, origen: 'MANUAL' } } : undefined,
    },
  })

  return Response.json({ ok: true, producto: { ...producto, margen: Number(producto.margen) } })
}
