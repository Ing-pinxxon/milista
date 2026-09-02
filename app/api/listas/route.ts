import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const INCLUIR = {
  items: {
    orderBy: { orden: 'asc' },
    include: { producto: { select: { id: true, nombre: true, slug: true, unidad: true } } },
  },
} as const

/** La lista en curso, si hay una. Solo puede haber una abierta a la vez. */
export async function GET() {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const lista = await prisma.listaCompra.findFirst({
    where: { estado: { in: ['ARMANDO', 'COMPRANDO'] } },
    orderBy: { fecha: 'desc' },
    include: INCLUIR,
  })

  return Response.json({ lista })
}

export interface ItemNuevo {
  productoId?: string | null
  texto?: string | null
}

/**
 * Abre una lista nueva con lo que se marco como faltante.
 *
 * Si ya hay una abierta la devuelve en vez de crear otra: dos listas a la vez
 * solo sirven para anotar los precios en la que no es.
 */
export async function POST(req: Request) {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const abierta = await prisma.listaCompra.findFirst({
    where: { estado: { in: ['ARMANDO', 'COMPRANDO'] } },
    include: INCLUIR,
  })
  if (abierta) return Response.json({ lista: abierta, yaExistia: true })

  const { items = [] } = (await req.json().catch(() => ({}))) as { items?: ItemNuevo[] }

  const lista = await prisma.listaCompra.create({
    data: {
      items: {
        create: items.map((it, orden) => ({
          productoId: it.productoId ?? null,
          texto: it.productoId ? null : (it.texto?.trim() || null),
          orden,
        })),
      },
    },
    include: INCLUIR,
  })

  return Response.json({ lista })
}
