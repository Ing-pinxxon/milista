import { createHash, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const COOKIE_SESION = 'milista_sesion'
/** Un ano: esto se usa desde el celular del duenio, no desde un equipo compartido. */
export const DURACION_SESION = 60 * 60 * 24 * 365

function tokenEsperado(): string | null {
  const clave = process.env.CLAVE_ESCRITURA
  if (!clave) return null
  return createHash('sha256').update(clave).digest('hex')
}

function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** Valida la clave que el usuario escribio y devuelve el token de sesion. */
export function tokenParaClave(clave: string): string | null {
  const esperado = tokenEsperado()
  if (!esperado) return null
  const recibido = createHash('sha256').update(clave).digest('hex')
  return igualSeguro(recibido, esperado) ? esperado : null
}

/** true si la peticion trae una cookie de sesion valida. */
export function puedeEscribir(): boolean {
  const esperado = tokenEsperado()
  // Sin CLAVE_ESCRITURA configurada nadie escribe: es preferible una app de solo
  // lectura a una abierta de par en par por un despliegue mal configurado.
  if (!esperado) return false
  const actual = cookies().get(COOKIE_SESION)?.value
  return !!actual && igualSeguro(actual, esperado)
}

/** Respuesta estandar cuando falta la clave. */
export function respuestaSinAcceso(): Response {
  return Response.json({ error: 'Necesitas la clave para hacer cambios.' }, { status: 401 })
}
