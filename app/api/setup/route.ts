import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sembrarCatalogo } from '@/lib/seed'

// Toca la base: no se puede prerenderizar.
export const dynamic = 'force-dynamic'
// El seed recorre 112 productos, mas de lo que dura una funcion por defecto.
export const maxDuration = 60

/**
 * Carga el catalogo inicial desde el navegador, para no tener que clonar el repo
 * ni instalar nada despues del primer despliegue.
 *
 * Protegido con la misma clave que el resto de la escritura. Es seguro repetirlo:
 * hace upsert, no borra nada y no agrega puntos falsos al historico.
 */
export async function POST() {
  if (!puedeEscribir()) return respuestaSinAcceso()

  try {
    const { productos, precios } = await sembrarCatalogo(prisma)
    return Response.json({ ok: true, productos, precios })
  } catch (e) {
    console.error('Fallo el seed:', e)
    return Response.json(
      { error: 'No se pudo cargar el catálogo. Revisa que las migraciones hayan corrido.' },
      { status: 500 },
    )
  }
}
