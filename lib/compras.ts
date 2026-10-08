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

  // El recorrido de la plaza manda sobre el orden de la hoja: si ya se compro
  // antes, se respeta el puesto en que se compro. Lo que nunca se ha comprado va
  // al final, en el orden de la hoja.
  return sugerencias.sort((a, b) => {
    const oa = a.producto.ordenCompra
    const ob = b.producto.ordenCompra
    if (oa != null && ob != null) return oa - ob
    if (oa != null) return -1
    if (ob != null) return 1
    return a.producto.orden - b.producto.orden
  })
}

/** Lo minimo que necesita saber el ordenamiento de un renglon de la lista. */
export interface RenglonOrdenable {
  productoId: string | null
  comprado: boolean
  costo: number | null
}

/**
 * Si el renglon ya esta resuelto y puede bajarse al final.
 *
 * Un producto no esta listo con solo chulearlo: falta el precio, y si bajara
 * antes, el campo se iria de debajo del dedo justo al ir a escribirlo. Una nota
 * suelta no lleva precio, asi que con chulearla basta.
 */
export function estaListo(item: RenglonOrdenable): boolean {
  if (!item.comprado) return false
  return item.productoId ? item.costo != null : true
}

/**
 * El orden en que se ven los renglones: primero lo que falta, y al final lo ya
 * resuelto. Dentro de cada grupo se conserva el orden del recorrido.
 *
 * Devuelve indices sobre el arreglo original, para no perder cual es cual.
 */
export function ordenParaMostrar(items: RenglonOrdenable[]): number[] {
  const indices = items.map((_, i) => i)
  return [
    ...indices.filter((i) => !estaListo(items[i])),
    ...indices.filter((i) => estaListo(items[i])),
  ]
}

/** Mueve un elemento de una posicion a otra, conservando el resto del orden. */
export function moverItem<T>(items: T[], desde: number, hasta: number): T[] {
  if (desde === hasta || desde < 0 || desde >= items.length) return items
  const copia = [...items]
  const [movido] = copia.splice(desde, 1)
  copia.splice(Math.max(0, Math.min(hasta, copia.length)), 0, movido)
  return copia
}

/**
 * Lo que hace falta de un producto para saber donde va en el recorrido.
 */
export interface ProductoOrdenable {
  id: string
  orden: number
  ordenCompra: number | null
}

/** Separa el orden del recorrido del de la hoja: lo no ordenado va despues de todo. */
const SALTO_SIN_ORDENAR = 1_000_000

/**
 * El puesto de cada producto en el recorrido por la plaza.
 *
 * Lo que ya tiene un puesto asignado va primero, en ese puesto. Lo que nunca se
 * ha ordenado va despues, en el orden de la hoja de calculo.
 */
export function construirRangos(productos: ProductoOrdenable[]): Map<string, number> {
  const rangos = new Map<string, number>()
  for (const p of productos) {
    rangos.set(p.id, p.ordenCompra ?? SALTO_SIN_ORDENAR + p.orden)
  }
  return rangos
}

/** Las notas sueltas no tienen puesto en el recorrido: se quedan al final. */
function rangoDe(productoId: string | null, rangos: Map<string, number>): number {
  if (!productoId) return Number.POSITIVE_INFINITY
  return rangos.get(productoId) ?? Number.POSITIVE_INFINITY
}

/**
 * Mete un renglon nuevo en el puesto que le toca segun el recorrido.
 *
 * Sin esto, buscar un producto y seleccionarlo lo manda al final de la lista y
 * toca arrastrarlo hasta su sitio, que es justo el tiempo que se queria ahorrar.
 */
export function insertarEnOrden<T extends { productoId: string | null }>(
  items: T[],
  nuevo: T,
  rangos: Map<string, number>,
): T[] {
  const rango = rangoDe(nuevo.productoId, rangos)
  const posicion = items.findIndex((it) => rangoDe(it.productoId, rangos) > rango)
  if (posicion === -1) return [...items, nuevo]
  return [...items.slice(0, posicion), nuevo, ...items.slice(posicion)]
}
