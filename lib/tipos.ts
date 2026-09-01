import type { CambioPropuesto, NoReconocido } from './parser'
import type { ProductoConPrecio } from './consultas'

export type { CambioPropuesto, NoReconocido, ProductoConPrecio }

/** Un cambio en la pantalla de revision: el del parser mas lo que decide el usuario. */
export interface CambioRevisable extends CambioPropuesto {
  /** Si esta marcado para aplicarse. */
  aplicar: boolean
  /** El texto de la lista, cuando el usuario confirmo el emparejamiento a mano. */
  aliasNuevo?: string
}

export interface Preview {
  cambios: CambioRevisable[]
  noReconocidos: NoReconocido[]
}

export const ETIQUETA_UNIDAD: Record<string, string> = {
  KG: 'Kg',
  LB: 'Lb',
  UNIDAD: 'C/u',
  PAQUETE: 'Paquete',
  BULTO: 'Bulto',
}

export const ETIQUETA_CONFIANZA: Record<string, string> = {
  alias: 'alias',
  exacto: 'exacto',
  contenido: 'parcial',
  difuso: 'dudoso',
  ninguno: '',
}
