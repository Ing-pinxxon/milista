import { AppPrecios } from '@/components/app-precios'
import { puedeEscribir } from '@/lib/auth'
import { obtenerCatalogo } from '@/lib/consultas'
import { SinBaseDeDatos } from '@/components/sin-base'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const conClave = puedeEscribir()

  try {
    const productos = await obtenerCatalogo(conClave)
    if (productos.length === 0) return <SinBaseDeDatos motivo="vacia" />
    return <AppPrecios inicial={productos} puedeEscribir={conClave} />
  } catch {
    // Primer despliegue sin DATABASE_URL o sin migrar: mejor explicar que hacer
    // que mostrar una pantalla de error del framework.
    return <SinBaseDeDatos motivo="sin-conexion" />
  }
}
