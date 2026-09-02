import { prisma } from './prisma'
import type { ProductoCatalogo, UnidadProducto } from './parser'

export interface ProductoConPrecio extends ProductoCatalogo {
  orden: number
  fechaPrecio: string | null
  /** De donde vino el precio vigente. El seed no cuenta como cambio del dia. */
  origenPrecio: 'SEED' | 'LISTA' | 'MANUAL' | null
}

interface FilaCruda {
  id: string
  nombre: string
  slug: string
  unidad: UnidadProducto | null
  margen: unknown
  aliases: string[]
  orden: number
  disponible: boolean
  costo: number | null
  venta: number | null
  fecha: Date | null
  origen: 'SEED' | 'LISTA' | 'MANUAL' | null
}

/**
 * Catalogo con el precio vigente de cada producto.
 *
 * El precio vigente es el registro de Precio mas reciente. Se resuelve con un
 * LATERAL para que sea una sola consulta y use el indice (productoId, fecha desc):
 * un findMany con take 1 por producto serian 112 consultas.
 *
 * `conCostos` decide si salen el precio de compra y el margen. Sin clave no
 * salen, y no es solo que no se pinten: no se envian. Quien tenga el link ve lo
 * que se cobra, no lo que se gana.
 *
 * Es obligatorio a proposito, sin valor por defecto: quien consulta el catalogo
 * tiene que decidir explicitamente. Con un default, olvidarlo dejaba los margenes
 * en 0 y el parser calculaba ventas de 0 pesos sin que nada fallara.
 */
export async function obtenerCatalogo(conCostos: boolean): Promise<ProductoConPrecio[]> {
  const filas = await prisma.$queryRaw<FilaCruda[]>`
    SELECT p.id, p.nombre, p.slug, p.unidad, p.margen, p.aliases, p.orden, p.disponible,
           pr.costo, pr.venta, pr.fecha, pr.origen
    FROM "Producto" p
    LEFT JOIN LATERAL (
      SELECT costo, venta, fecha, origen
      FROM "Precio"
      WHERE "productoId" = p.id
      ORDER BY fecha DESC, "createdAt" DESC
      LIMIT 1
    ) pr ON true
    WHERE p.activo = true
    ORDER BY p.orden ASC
  `

  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    unidad: f.unidad,
    margen: conCostos ? Number(f.margen) : 0,
    aliases: f.aliases,
    orden: f.orden,
    disponible: f.disponible,
    costoActual: conCostos ? f.costo : null,
    ventaActual: f.venta,
    fechaPrecio: f.fecha ? f.fecha.toISOString() : null,
    origenPrecio: f.origen,
  }))
}
