import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { EstadoLista, Unidad } from '@prisma/client'

export const dynamic = 'force-dynamic'

const INCLUIR = {
  items: {
    orderBy: { orden: 'asc' },
    include: { producto: { select: { id: true, nombre: true, slug: true, unidad: true } } },
  },
} as const

export interface ItemGuardado {
  productoId?: string | null
  texto?: string | null
  comprado?: boolean
  costo?: number | null
  unidad?: Unidad | null
}

/**
 * Guarda la lista entera de una vez.
 *
 * Es un documento chico que maneja una sola persona, asi que reemplazar los
 * items completos sale mas simple y con menos viajes que una ruta por cada
 * chulo. Lo hace en una transaccion para que nunca quede a medias.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const { estado, notas, items = [] } = (await req.json()) as {
    estado?: EstadoLista
    notas?: string | null
    items?: ItemGuardado[]
  }

  // Un producto no puede estar dos veces en la misma lista.
  const vistos = new Set<string>()
  const limpios = items.filter((it) => {
    if (!it.productoId) return true
    if (vistos.has(it.productoId)) return false
    vistos.add(it.productoId)
    return true
  })

  const lista = await prisma.$transaction(async (tx) => {
    await tx.itemLista.deleteMany({ where: { listaId: params.id } })
    return tx.listaCompra.update({
      where: { id: params.id },
      data: {
        ...(estado ? { estado } : {}),
        ...(notas !== undefined ? { notas } : {}),
        items: {
          create: limpios.map((it, orden) => ({
            productoId: it.productoId ?? null,
            texto: it.productoId ? null : (it.texto?.trim() || null),
            comprado: it.comprado ?? false,
            costo: it.costo ?? null,
            unidad: it.unidad ?? null,
            orden,
          })),
        },
      },
      include: INCLUIR,
    })
  })

  return Response.json({ lista })
}

/** Descarta la lista sin aplicar nada. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!puedeEscribir()) return respuestaSinAcceso()
  await prisma.listaCompra.delete({ where: { id: params.id } })
  return Response.json({ ok: true })
}
