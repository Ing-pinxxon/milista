import type { EstadoLista, Unidad } from '@prisma/client'

export type { EstadoLista, Unidad }

export interface ItemListaVista {
  id?: string
  productoId: string | null
  /** Solo para lo que no esta en el catalogo. */
  texto: string | null
  comprado: boolean
  costo: number | null
  unidad: Unidad | null
  producto?: { id: string; nombre: string; slug: string; unidad: Unidad | null } | null
}

export interface ListaVista {
  id: string
  fecha: string
  estado: EstadoLista
  notas: string | null
  items: ItemListaVista[]
}

/** El nombre que se muestra, venga del catalogo o escrito a mano. */
export function nombreDeItem(item: ItemListaVista): string {
  return item.producto?.nombre ?? item.texto ?? '(sin nombre)'
}

export const UNIDADES_COMPRA: { valor: Unidad; etiqueta: string }[] = [
  { valor: 'KG', etiqueta: 'Kg' },
  { valor: 'LB', etiqueta: 'Lb' },
  { valor: 'UNIDAD', etiqueta: 'C/u' },
  { valor: 'BULTO', etiqueta: 'Bulto' },
]

/**
 * Lleva el precio anotado a la unidad en la que se guarda: siempre por kilo,
 * salvo lo que se vende suelto.
 */
export function costoNormalizado(costo: number, unidad: Unidad | null): number {
  return unidad === 'LB' ? costo * 2 : costo
}
