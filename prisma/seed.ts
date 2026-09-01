import { PrismaClient } from '@prisma/client'
import { slugificar } from '../lib/normalizar'
import { PRODUCTOS } from './productos'

const prisma = new PrismaClient()

/** Margen propio: el que ya estaba implicito en los precios actuales. */
function margenDe(compra: number | null, venta: number | null): number {
  if (!compra || !venta) return 1.3
  return Number((venta / compra).toFixed(6))
}

async function main() {
  const slugs = new Set<string>()

  for (const [orden, fila] of PRODUCTOS.entries()) {
    const slug = slugificar(fila.nombre)
    if (slugs.has(slug)) throw new Error(`Slug repetido: ${slug} (${fila.nombre})`)
    slugs.add(slug)

    const margen = margenDe(fila.compra, fila.venta)

    // Idempotente: se puede volver a correr sin duplicar. No pisa aliases ni
    // disponibilidad, que son datos que el usuario fue construyendo.
    const producto = await prisma.producto.upsert({
      where: { slug },
      create: { nombre: fila.nombre, slug, unidad: fila.unidad, margen, orden },
      update: { nombre: fila.nombre, unidad: fila.unidad, margen, orden },
    })

    // El precio inicial solo se crea si el producto todavia no tiene historico:
    // recorrer el seed no debe insertar un punto falso en la grafica.
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

  const total = await prisma.producto.count()
  const conPrecio = await prisma.precio.count()
  console.log(`Seed listo: ${total} productos, ${conPrecio} precios iniciales.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
