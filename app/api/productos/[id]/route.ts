import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Edicion manual de costo o venta.
 *
 * Inserta un Precio nuevo en vez de actualizar el vigente: las correcciones a
 * mano tambien son historico, y sin esto la grafica mentiria.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const body = (await req.json()) as { costo?: number | null; venta?: number | null; disponible?: boolean }

  const producto = await prisma.producto.findUnique({
    where: { id: params.id },
    include: { precios: { orderBy: { fecha: 'desc' }, take: 1 } },
  })
  if (!producto) return Response.json({ error: 'Producto no encontrado.' }, { status: 404 })

  const vigente = producto.precios[0]
  const costo = body.costo === undefined ? (vigente?.costo ?? null) : body.costo
  const venta = body.venta === undefined ? (vigente?.venta ?? null) : body.venta

  const precio = await prisma.precio.create({
    data: { productoId: producto.id, costo, venta, origen: 'MANUAL' },
  })

  if (body.disponible !== undefined) {
    await prisma.producto.update({
      where: { id: producto.id },
      data: { disponible: body.disponible },
    })
  }

  return Response.json({ ok: true, precio })
}
