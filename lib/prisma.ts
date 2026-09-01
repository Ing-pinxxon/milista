import { PrismaClient } from '@prisma/client'

// Singleton: en dev Next recarga los modulos en cada cambio y sin esto se abren
// conexiones nuevas hasta agotar el pool de Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
