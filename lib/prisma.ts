import { PrismaClient } from '@prisma/client'
import { advertirSiAmbiguo, resolverConexiones } from './conexion.mjs'

// Singleton: en dev Next recarga los modulos en cada cambio y sin esto se abren
// conexiones nuevas hasta agotar el pool de Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function crearCliente(): PrismaClient {
  const conexiones = resolverConexiones()
  const { agrupada, directa } = conexiones

  // Si el entorno tiene variables de mas de una base, hay que dejar constancia:
  // conectarse a la equivocada funcionaria, guardando los precios donde no es.
  advertirSiAmbiguo(conexiones)

  // El schema declara url y directUrl por nombre. Se rellenan si la plataforma
  // los dejo con otro nombre, para que Prisma no falle al resolverlos.
  process.env.DATABASE_URL ??= agrupada
  process.env.DATABASE_URL_UNPOOLED ??= directa

  // La app siempre consulta por la conexion agrupada: cada invocacion serverless
  // abre una conexion nueva y sin pooler se agota Postgres.
  return new PrismaClient({ datasourceUrl: agrupada })
}

function obtenerCliente(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = crearCliente()
  return globalForPrisma.prisma
}

/**
 * Cliente perezoso: no se construye hasta la primera consulta.
 *
 * Importa que sea asi. `next build` evalua los modulos para recolectar las rutas,
 * y resolverConexiones lanza error si no encuentra la base. Construyendolo al
 * importar, el build se caia entero en vez de dejar que la app arranque y muestre
 * la pantalla de "falta conectar la base".
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_destino, prop) {
    const cliente = obtenerCliente()
    const valor = Reflect.get(cliente, prop, cliente)
    return typeof valor === 'function' ? valor.bind(cliente) : valor
  },
})
