import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { CambioResumen } from '@/lib/resumen'

export const dynamic = 'force-dynamic'

/** Cuantas compras anteriores se pueden volver a copiar. */
const CUANTAS = 5

interface Fila {
  listaId: string
  fecha: Date
  nombre: string
  costo: number | null
  venta: number | null
  costoAntes: number | null
  ventaAntes: number | null
}

export interface ResumenCompra {
  listaId: string
  fecha: string
  cambios: CambioResumen[]
}

/**
 * Las ultimas compras cerradas con sus cambios de precio, para volver a copiar
 * el resumen despues: por si se olvido mandarlo o hay que reenviarlo.
 *
 * El "antes" de cada producto es el precio que tenia justo antes de esa compra,
 * no el de hoy: asi el resumen de hace tres dias sigue diciendo lo mismo que
 * dijo ese dia. Lleva costos, asi que exige la clave.
 */
export async function GET() {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const filas = await prisma.$queryRaw<Fila[]>`
    WITH ultimas AS (
      SELECT id, "actualizacionId"
      FROM "ListaCompra"
      WHERE estado = 'CERRADA' AND "actualizacionId" IS NOT NULL
      ORDER BY fecha DESC
      LIMIT ${CUANTAS}
    )
    SELECT u.id AS "listaId", a.fecha, prod.nombre,
           pr.costo, pr.venta, ant.costo AS "costoAntes", ant.venta AS "ventaAntes"
    FROM ultimas u
    JOIN "Actualizacion" a ON a.id = u."actualizacionId"
    JOIN "Precio" pr ON pr."actualizacionId" = a.id
    JOIN "Producto" prod ON prod.id = pr."productoId"
    LEFT JOIN LATERAL (
      SELECT x.costo, x.venta
      FROM "Precio" x
      WHERE x."productoId" = pr."productoId"
        AND (x.fecha, x."createdAt", x.id) < (pr.fecha, pr."createdAt", pr.id)
      ORDER BY x.fecha DESC, x."createdAt" DESC, x.id DESC
      LIMIT 1
    ) ant ON true
    ORDER BY a.fecha DESC, prod."ordenCompra" ASC NULLS LAST, prod.orden ASC
  `

  // Agrupar por compra, conservando el orden: la mas reciente primero y, dentro
  // de cada una, el orden del recorrido.
  const porLista = new Map<string, ResumenCompra>()
  for (const f of filas) {
    let r = porLista.get(f.listaId)
    if (!r) {
      r = { listaId: f.listaId, fecha: f.fecha.toISOString(), cambios: [] }
      porLista.set(f.listaId, r)
    }
    r.cambios.push({
      nombre: f.nombre,
      costoAntes: f.costoAntes,
      costoDespues: f.costo,
      ventaAntes: f.ventaAntes,
      ventaDespues: f.venta,
    })
  }

  return Response.json({ resumenes: [...porLista.values()] })
}
