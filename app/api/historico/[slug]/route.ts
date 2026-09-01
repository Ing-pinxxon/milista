import { prisma } from '@/lib/prisma'

// Depende de la base: no se puede prerenderizar en el build.
export const dynamic = 'force-dynamic'

/** Serie de precios de un producto, del mas viejo al mas nuevo, para la grafica. */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const producto = await prisma.producto.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      nombre: true,
      unidad: true,
      margen: true,
      precios: {
        orderBy: { fecha: 'asc' },
        select: { costo: true, venta: true, fecha: true, origen: true },
      },
    },
  })

  if (!producto) return Response.json({ error: 'Producto no encontrado.' }, { status: 404 })

  return Response.json({
    producto: { ...producto, margen: Number(producto.margen) },
  })
}
