import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gananciaDesde, type TipoGanancia } from '@/lib/precios'

/**
 * Edicion manual de costo, venta o de lo que se le gana al producto.
 *
 * Inserta un Precio nuevo en vez de actualizar el vigente: las correcciones a
 * mano tambien son historico, y sin esto la grafica mentiria.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const body = (await req.json()) as {
    costo?: number | null
    venta?: number | null
    disponible?: boolean
    tipoGanancia?: TipoGanancia
    margen?: number
    gananciaPesos?: number | null
  }

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

  const cambios: {
    disponible?: boolean
    tipoGanancia?: TipoGanancia
    margen?: number
    gananciaPesos?: number | null
  } = {}

  if (body.disponible !== undefined) cambios.disponible = body.disponible

  const tipo: TipoGanancia = body.tipoGanancia ?? producto.tipoGanancia

  if (body.tipoGanancia !== undefined || body.margen !== undefined || body.gananciaPesos !== undefined) {
    // Ganancia editada a mano.
    cambios.tipoGanancia = tipo
    if (body.margen !== undefined) cambios.margen = body.margen
    if (body.gananciaPesos !== undefined) cambios.gananciaPesos = body.gananciaPesos
  } else if (body.venta !== undefined && costo && venta) {
    // Se corrigio la venta: la ganancia se ajusta a lo que el usuario decidio.
    // Sin esto quedaria guardada la ganancia vieja y la siguiente lista volveria
    // a subir el precio, deshaciendo la correccion.
    const g = gananciaDesde(costo, venta, tipo)
    cambios.tipoGanancia = tipo
    cambios.margen = g.margen
    cambios.gananciaPesos = g.pesos
  }

  const actualizado = Object.keys(cambios).length
    ? await prisma.producto.update({ where: { id: producto.id }, data: cambios })
    : producto

  return Response.json({
    ok: true,
    precio,
    producto: {
      tipoGanancia: actualizado.tipoGanancia,
      margen: Number(actualizado.margen),
      gananciaPesos: actualizado.gananciaPesos,
    },
  })
}
