'use client'

import type { ProductoConPrecio } from './tipos'

/**
 * Cache del catalogo en el celular.
 *
 * Sirve para consultar precios en la plaza sin senal. Es una cache: la verdad
 * vive en Postgres, esto es solo la ultima foto que se alcanzo a ver.
 */
const CLAVE = 'milista:catalogo'

export function guardarCatalogo(productos: ProductoConPrecio[]): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ fecha: Date.now(), productos }))
  } catch {
    // Modo incognito o almacenamiento lleno: la app sigue funcionando online.
  }
}

export async function leerCatalogo(): Promise<ProductoConPrecio[] | null> {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return null
    return (JSON.parse(crudo) as { productos: ProductoConPrecio[] }).productos
  } catch {
    return null
  }
}
