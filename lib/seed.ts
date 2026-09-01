import type { PrismaClient } from '@prisma/client'
import { slugificar } from './normalizar'
import { PRODUCTOS } from './productos'

/** Margen propio: el que ya estaba implicito en los precios de la hoja actual. */
function margenDe(compra: number | null, venta: number | null): number {
  if (!compra || !venta) return 1.3
  return Number((venta / compra).toFixed(6))
}

export interface ResultadoSeed {
  productos: number
  precios: number
}

/**
 * Carga los 112 productos con su margen y su precio inicial.
 *
 * Idempotente: se puede volver a correr sin duplicar nada. No pisa aliases ni
 * disponibilidad, que son datos que el usuario va construyendo con el uso, y no
 * inserta un precio inicial si el producto ya tiene historico (seria un punto
 * falso en la grafica).
 */
export async function sembrarCatalogo(prisma: PrismaClient): Promise<ResultadoSeed> {
  const slugs = new Set<string>()

  for (const [orden, fila] of PRODUCTOS.entries()) {
    const slug = slugificar(fila.nombre)
    if (slugs.has(slug)) throw new Error(`Slug repetido: ${slug} (${fila.nombre})`)
    slugs.add(slug)

    const margen = margenDe(fila.compra, fila.venta)

    const producto = await prisma.producto.upsert({
      where: { slug },
      create: { nombre: fila.nombre, slug, unidad: fila.unidad, margen, orden },
      update: { nombre: fila.nombre, unidad: fila.unidad, margen, orden },
    })

    const tienePrecio = await prisma.precio.findFirst({
      where: { productoId: producto.id },
      select: { id: true },
    })

    if (!tienePrecio && (fila.compra != null || fila.venta != null)) {
      await prisma.precio.create({
        data: { productoId: producto.id, costo: fila.compra, venta: fila.venta, origen: 'SEED' },
      })
    }
  }

  return {
    productos: await prisma.producto.count(),
    precios: await prisma.precio.count(),
  }
}
