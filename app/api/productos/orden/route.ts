import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Fija el orden del recorrido por la plaza.
 *
 * Llegan los ids en el orden en que se recorre, y cada uno se queda con su
 * puesto. Lo que no venga en la lista pierde su puesto y vuelve a ordenarse por
 * la hoja de calculo, que es lo que se espera al sacar algo del recorrido.
 */
export async function PUT(req: Request) {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const { ids } = (await req.json()) as { ids?: string[] }
  if (!Array.isArray(ids)) return Response.json({ error: 'Faltan los ids.' }, { status: 400 })

  // Sin repetidos: dos puestos para el mismo producto no significan nada.
  const unicos = [...new Set(ids)]

  await prisma.$transaction([
    prisma.producto.updateMany({
      where: { id: { notIn: unicos } },
      data: { ordenCompra: null },
    }),
    ...unicos.map((id, puesto) =>
      prisma.producto.update({ where: { id }, data: { ordenCompra: puesto } }),
    ),
  ])

  return Response.json({ ok: true, ordenados: unicos.length })
}
