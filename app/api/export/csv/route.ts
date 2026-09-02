import { puedeEscribir, respuestaSinAcceso } from '@/lib/auth'
import { obtenerCatalogo } from '@/lib/consultas'

// Depende de la base: no se puede prerenderizar en el build.
export const dynamic = 'force-dynamic'

const ETIQUETA: Record<string, string> = {
  KG: 'Kg',
  LB: 'Lb',
  UNIDAD: 'C/u',
  PAQUETE: 'Paquete',
  BULTO: 'Bulto',
}

function campo(v: string | number | null): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * CSV con las mismas columnas y el mismo orden de filas que la hoja de calculo
 * que se usa hoy, para poder pegarlo encima sin reacomodar nada.
 */
export async function GET() {
  // Trae la columna de precio de compra: esto no es publico.
  if (!puedeEscribir()) return respuestaSinAcceso()

  const productos = await obtenerCatalogo(true)

  const filas = [
    ['Producto', 'Unidad', 'Precio compra', 'Precio venta'],
    ...productos.map((p) => [
      campo(p.nombre),
      campo(p.unidad ? ETIQUETA[p.unidad] : ''),
      campo(p.costoActual),
      campo(p.ventaActual),
    ]),
  ]

  const csv = filas.map((f) => f.join(',')).join('\n')
  const fecha = new Date().toISOString().slice(0, 10)

  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="precios-${fecha}.csv"`,
    },
  })
}
