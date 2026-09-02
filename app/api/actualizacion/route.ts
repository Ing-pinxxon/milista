import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { obtenerCatalogo } from '@/lib/consultas'
import { parsearLista } from '@/lib/parser'

/**
 * Interpreta la lista y devuelve el preview. NO escribe nada: el usuario revisa
 * antes en pantalla y confirma con /api/actualizacion/aplicar.
 */
export async function POST(req: Request) {
  if (!puedeEscribir()) return respuestaSinAcceso()

  const { texto } = (await req.json()) as { texto?: string }
  if (!texto?.trim()) return Response.json({ error: 'No llego texto.' }, { status: 400 })

  // Con costos: el parser necesita el margen de cada producto para calcular la venta.
  const catalogo = await obtenerCatalogo(true)
  const { cambios, noReconocidos } = parsearLista(texto, catalogo)

  return Response.json({ cambios, noReconocidos })
}
