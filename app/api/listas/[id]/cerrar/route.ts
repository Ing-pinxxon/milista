import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { cop } from '@/lib/precios'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export interface CambioDeCompra {
  productoId: string
  costo: number | null
  venta: number | null
}

/**
 * Cierra la lista y aplica los precios que se anotaron comprando.
 *
 * Los cambios llegan ya confirmados por el usuario en la pantalla de revision,
 * igual que al pegar la lista de WhatsApp. Todo va en una transaccion: o queda
 * la actualizacion completa con sus precios, o no queda nada.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const { cambios = [] } = (await req.json().catch(() => ({}))) as { cambios?: CambioDeCompra[] }

  const lista = await prisma.listaCompra.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { orden: 'asc' }, include: { producto: true } } },
  })
  if (!lista) return Response.json({ error: 'Esa lista ya no existe.' }, { status: 404 })

  // Se guarda la lista tal como quedo, para poder auditar de donde salio cada
  // precio igual que con el texto crudo de WhatsApp.
  const textoOriginal = [
    `Lista de compras del ${lista.fecha.toLocaleDateString('es-CO')}`,
    ...lista.items.map((it) => {
      const nombre = it.producto?.nombre ?? it.texto ?? '(sin nombre)'
      const marca = it.comprado ? '[x]' : '[ ]'
      const precio = it.costo != null ? ` ${cop(it.costo)}${it.unidad ? '/' + it.unidad : ''}` : ''
      return `${marca} ${nombre}${precio}`
    }),
  ].join('\n')

  const resultado = await prisma.$transaction(async (tx) => {
    const actualizacion = await tx.actualizacion.create({
      data: { textoOriginal, cantidadCambios: cambios.length },
    })

    for (const c of cambios) {
      await tx.precio.create({
        data: {
          productoId: c.productoId,
          costo: c.costo,
          venta: c.venta,
          origen: 'COMPRA',
          actualizacionId: actualizacion.id,
        },
      })
      // Si se compro, hay existencia: se levanta el ❌ que traia de la lista.
      await tx.producto.update({ where: { id: c.productoId }, data: { disponible: true } })
    }

    await tx.listaCompra.update({
      where: { id: params.id },
      data: { estado: 'CERRADA', actualizacionId: actualizacion.id },
    })

    return actualizacion
  })

  return Response.json({ ok: true, actualizacionId: resultado.id, cantidadCambios: cambios.length })
}
