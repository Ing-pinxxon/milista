-- CreateEnum
CREATE TYPE "TipoGanancia" AS ENUM ('PORCENTAJE', 'PESOS');

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "gananciaPesos" INTEGER,
ADD COLUMN     "tipoGanancia" "TipoGanancia" NOT NULL DEFAULT 'PORCENTAJE';
