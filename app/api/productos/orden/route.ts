import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Guarda el recorrido de la plaza: llegan los ids en orden y cada uno queda en
 * su puesto, 0, 1, 2... sin repetidos.
 *
 * Es una sola instruccion en vez de una por producto: con 112 productos eran 112
 * viajes a la base en cada arrastre.
 */
export async function PUT(req: Request) {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown }
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) {
    return Response.json({ error: 'Faltan los ids.' }, { status: 400 })
  }

  // Sin repetidos: dos puestos para el mismo producto no significan nada.
  const unicos = [...new Set(ids as string[])]

  await prisma.$transaction([
    // Lo que no viene pierde su puesto y vuelve a ordenarse por la hoja.
    prisma.$executeRaw`
      UPDATE "Producto" SET "ordenCompra" = NULL
      WHERE NOT (id = ANY(${unicos}::text[]))`,
    prisma.$executeRaw`
      UPDATE "Producto" AS p SET "ordenCompra" = (v.puesto - 1)::int
      FROM unnest(${unicos}::text[]) WITH ORDINALITY AS v(id, puesto)
      WHERE p.id = v.id`,
  ])

  return Response.json({ ok: true, ordenados: unicos.length })
}
