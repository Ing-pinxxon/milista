/**
 * Deja el .env que el CLI de Prisma espera, a partir de las variables que haya
 * inyectado la plataforma con el nombre que sea.
 *
 * Corre antes de `prisma migrate deploy` en el despliegue. Prisma lee el .env
 * solo, pero exige los nombres del schema (DATABASE_URL y DATABASE_URL_UNPOOLED),
 * y en Vercel la base puede haber quedado con un prefijo propio.
 */
import { existsSync, writeFileSync } from 'node:fs'
import { advertirSiAmbiguo, resolverConexiones } from '../lib/conexion.mjs'

const RUTA = '.env'

// Nunca se pisa un .env existente: en local es la configuracion del que desarrolla.
if (existsSync(RUTA)) {
  console.log('preparar-env: ya hay un .env, no lo toco.')
  process.exit(0)
}

const conexiones = resolverConexiones()
const { agrupada, directa, nombreAgrupada, nombreDirecta } = conexiones

writeFileSync(
  RUTA,
  [
    '# Generado en el build a partir de las variables de la plataforma.',
    `DATABASE_URL="${agrupada}"`,
    `DATABASE_URL_UNPOOLED="${directa}"`,
    '',
  ].join('\n'),
)

// Queda en el log del build: si algun dia se conecta a la base que no es, aqui
// se ve de que variable salio.
console.log(
  `preparar-env: consultas desde ${nombreAgrupada}, migraciones desde ${nombreDirecta}.`,
)
advertirSiAmbiguo(conexiones)
