import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { limpiarNombre } from '@/lib/normalizar'
import { prisma } from '@/lib/prisma'

export interface CambioConfirmado {
  productoId: string
  costo: number | null
  venta: number | null
  disponible: boolean
  /** Texto de la lista que el usuario confirmo a mano para este producto. */
  aliasNuevo?: string
}

/**
 * Aplica los cambios que el usuario dejo marcados, en una sola transaccion:
 * guarda la lista cruda, inserta un Precio por cambio, actualiza disponibilidad
 * y aprende los aliases confirmados.
 */
export async function POST(req: Request) {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const { texto, cambios } = (await req.json()) as {
    texto?: string
    cambios?: CambioConfirmado[]
  }

  if (!Array.isArray(cambios) || cambios.length === 0) {
    return Response.json({ error: 'No hay cambios que aplicar.' }, { status: 400 })
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const actualizacion = await tx.actualizacion.create({
      data: { textoOriginal: texto ?? '', cantidadCambios: cambios.length },
    })

    for (const c of cambios) {
      await tx.precio.create({
        data: {
          productoId: c.productoId,
          costo: c.costo,
          venta: c.venta,
          origen: 'LISTA',
          actualizacionId: actualizacion.id,
        },
      })

      // limpiarNombre y no normalizar: tiene que coincidir con lo que el parser
      // genera al leer la lista, o el alias guardado no serviria de nada.
      const alias = c.aliasNuevo ? limpiarNombre(c.aliasNuevo) : null
      const producto = await tx.producto.findUnique({
        where: { id: c.productoId },
        select: { aliases: true },
      })

      await tx.producto.update({
        where: { id: c.productoId },
        data: {
          disponible: c.disponible,
          // Solo se agrega si es nuevo: el array no debe crecer con repetidos.
          ...(alias && producto && !producto.aliases.includes(alias)
            ? { aliases: { push: alias } }
            : {}),
        },
      })
    }

    return actualizacion
  })

  return Response.json({ ok: true, actualizacionId: resultado.id, cantidadCambios: cambios.length })
}
