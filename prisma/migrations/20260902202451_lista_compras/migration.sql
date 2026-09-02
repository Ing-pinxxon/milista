-- CreateEnum
CREATE TYPE "EstadoLista" AS ENUM ('ARMANDO', 'COMPRANDO', 'CERRADA');

-- AlterEnum
ALTER TYPE "OrigenPrecio" ADD VALUE 'COMPRA';

-- CreateTable
CREATE TABLE "ListaCompra" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoLista" NOT NULL DEFAULT 'ARMANDO',
    "notas" TEXT,
    "actualizacionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListaCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemLista" (
    "id" TEXT NOT NULL,
    "listaId" TEXT NOT NULL,
    "productoId" TEXT,
    "texto" TEXT,
    "comprado" BOOLEAN NOT NULL DEFAULT false,
    "costo" INTEGER,
    "unidad" "Unidad",
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemLista_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListaCompra_estado_fecha_idx" ON "ListaCompra"("estado", "fecha" DESC);

-- CreateIndex
CREATE INDEX "ItemLista_listaId_orden_idx" ON "ItemLista"("listaId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "ItemLista_listaId_productoId_key" ON "ItemLista"("listaId", "productoId");

-- AddForeignKey
ALTER TABLE "ItemLista" ADD CONSTRAINT "ItemLista_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "ListaCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLista" ADD CONSTRAINT "ItemLista_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
