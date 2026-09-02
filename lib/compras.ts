import type { ProductoConPrecio } from './consultas'

/** Dias sin precio nuevo tras los cuales conviene volver a preguntar por el producto. */
export const DIAS_PARA_SUGERIR = 3

export type MotivoSugerencia = 'sin-existencia' | 'sin-actualizar'

export interface Sugerencia {
  producto: ProductoConPrecio
  motivo: MotivoSugerencia
}

/**
 * Que conviene llevar anotado a la plaza.
 *
 * Dos razones, y el orden importa porque la primera es la certera:
 * 1. El producto esta marcado sin existencia (el ❌ de la lista del dia). Eso ya
 *    lo dijo el proveedor: hace falta.
 * 2. Lleva varios dias sin precio nuevo, asi que probablemente nadie lo ha
 *    mirado y vale la pena preguntar.
 *
 * Los productos sin precio y los inactivos no se sugieren: son las lineas en
 * blanco de la hoja, no cosas que se compren.
 */
export function sugerirCompras(
  productos: ProductoConPrecio[],
  ahora = new Date(),
  dias = DIAS_PARA_SUGERIR,
): Sugerencia[] {
  const limite = ahora.getTime() - dias * 24 * 60 * 60 * 1000

  const sugerencias = productos.flatMap<Sugerencia>((producto) => {
    if (!producto.disponible) return [{ producto, motivo: 'sin-existencia' }]

    // Sin precio nunca registrado no se sugiere: no es algo que se compre.
    if (producto.ventaActual == null || !producto.fechaPrecio) return []

    const desactualizado = new Date(producto.fechaPrecio).getTime() < limite
    return desactualizado ? [{ producto, motivo: 'sin-actualizar' }] : []
  })

  // El orden de la hoja de calculo, que es el que el usuario tiene en la cabeza.
  return sugerencias.sort((a, b) => a.producto.orden - b.producto.orden)
}
