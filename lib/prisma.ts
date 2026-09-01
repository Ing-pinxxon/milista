import { PrismaClient } from '@prisma/client'
import { resolverConexiones } from './conexion.mjs'

// Singleton: en dev Next recarga los modulos en cada cambio y sin esto se abren
// conexiones nuevas hasta agotar el pool de Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function crearCliente(): PrismaClient {
  const { agrupada, directa } = resolverConexiones()

  // El schema declara url y directUrl por nombre. Se rellenan si la plataforma
  // los dejo con otro nombre, para que Prisma no falle al resolverlos.
  process.env.DATABASE_URL ??= agrupada
  process.env.DATABASE_URL_UNPOOLED ??= directa

  // La app siempre consulta por la conexion agrupada: cada invocacion serverless
  // abre una conexion nueva y sin pooler se agota Postgres.
  return new PrismaClient({ datasourceUrl: agrupada })
}

export const prisma = globalForPrisma.prisma ?? crearCliente()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
