/**
 * Normaliza texto para comparar y para guardar aliases: minusculas, sin tildes,
 * sin puntuacion, espacios colapsados. Se conserva la barra porque distingue
 * unidades ("c/u") y fracciones ("1/2").
 *
 * Es la misma funcion que usa el emparejador y la que guarda los aliases, para
 * que un alias guardado siempre se encuentre despues por lookup directo.
 */
export function normalizar(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Palabras de relleno de las listas de WhatsApp, y unidades de cantidad. */
const RELLENO =
  /\b(sale|salen|vale|valen|esta|estan|a|para|vender|venta|vendo|de|del|el|la|los|las|en|hoy|manana|cuesta|cuestan|y|con|por|cada|arrobas?|robas?|bultos?de)\b/g

/**
 * Deja solo el nombre del producto: normaliza y quita relleno y fracciones.
 * Ej: "sale 1/2 roba pareja" -> "pareja"
 */
export function limpiarNombre(s: string): string {
  return normalizar(s)
    .replace(/\b\d+\s*\/\s*\d+\b/g, ' ')
    .replace(RELLENO, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Slug estable para la URL del historico y para la clave del upsert del seed. */
export function slugificar(nombre: string): string {
  return normalizar(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
