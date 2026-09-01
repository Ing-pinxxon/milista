-- CreateEnum
CREATE TYPE "Unidad" AS ENUM ('KG', 'LB', 'UNIDAD', 'PAQUETE', 'BULTO');

-- CreateEnum
CREATE TYPE "OrigenPrecio" AS ENUM ('SEED', 'LISTA', 'MANUAL');

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "unidad" "Unidad",
    "categoria" TEXT,
    "margen" DECIMAL(10,6) NOT NULL,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Precio" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "costo" INTEGER,
    "venta" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" "OrigenPrecio" NOT NULL DEFAULT 'LISTA',
    "actualizacionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Precio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actualizacion" (
    "id" TEXT NOT NULL,
    "textoOriginal" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cantidadCambios" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actualizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Producto_slug_key" ON "Producto"("slug");

-- CreateIndex
CREATE INDEX "Producto_activo_orden_idx" ON "Producto"("activo", "orden");

-- CreateIndex
CREATE INDEX "Precio_productoId_fecha_idx" ON "Precio"("productoId", "fecha" DESC);

-- CreateIndex
CREATE INDEX "Precio_actualizacionId_idx" ON "Precio"("actualizacionId");

-- CreateIndex
CREATE INDEX "Actualizacion_fecha_idx" ON "Actualizacion"("fecha" DESC);

-- AddForeignKey
ALTER TABLE "Precio" ADD CONSTRAINT "Precio_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Precio" ADD CONSTRAINT "Precio_actualizacionId_fkey" FOREIGN KEY ("actualizacionId") REFERENCES "Actualizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
