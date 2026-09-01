import { PrismaClient } from '@prisma/client'
import { sembrarCatalogo } from '../lib/seed'

// Envoltorio de linea de comandos para `npx prisma db seed`. La logica vive en
// lib/seed.ts porque el endpoint /api/setup usa la misma.
const prisma = new PrismaClient()

sembrarCatalogo(prisma)
  .then(({ productos, precios }) => {
    console.log(`Seed listo: ${productos} productos, ${precios} precios iniciales.`)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
