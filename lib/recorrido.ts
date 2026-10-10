/**
 * El recorrido por la plaza: el UNICO orden de los productos.
 *
 * Todo lo que se ordena sale de aqui (la lista de compras, el editor del
 * recorrido, las sugerencias) y todo arrastre lo edita a el. Nada mas lo toca.
 *
 * Antes habia dos ordenes que peleaban entre si: el de cada lista (lo que se
 * arrastraba ahi no llegaba al recorrido) y el del recorrido (al guardarlo, la
 * lista se reacomodaba y deshacia lo arrastrado). Ademas, cerrar una lista
 * reescribia los puestos de lo comprado encima del recorrido. Con un solo orden
 * no hay nada que se desajuste solo.
 */

/** Mueve un elemento de una posicion a otra, conservando el resto del orden. */
export function moverItem<T>(items: T[], desde: number, hasta: number): T[] {
  if (desde === hasta || desde < 0 || desde >= items.length) return items
  const copia = [...items]
  const [movido] = copia.splice(desde, 1)
  copia.splice(Math.max(0, Math.min(hasta, copia.length)), 0, movido)
  return copia
}

export interface ProductoOrdenable {
  id: string
  /** Puesto en la hoja de calculo: desempata lo que nunca se ha ordenado. */
  orden: number
  /** Puesto en el recorrido. null si nunca se ha ordenado. */
  ordenCompra: number | null
}

/**
 * Compara dos productos por su puesto en el recorrido.
 *
 * Es un orden total aunque haya puestos repetidos (datos viejos de cuando
 * cerrar una lista los pisaba): se desempata por la hoja y luego por id, para
 * que dos pantallas nunca muestren el mismo recorrido en ordenes distintos.
 */
export function compararRecorrido(a: ProductoOrdenable, b: ProductoOrdenable): number {
  const oa = a.ordenCompra
  const ob = b.ordenCompra
  if (oa != null && ob == null) return -1
  if (oa == null && ob != null) return 1
  if (oa != null && ob != null && oa !== ob) return oa - ob
  if (a.orden !== b.orden) return a.orden - b.orden
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** El recorrido completo: los ids de todos los productos, en orden. */
export function rutaDe(productos: ProductoOrdenable[]): string[] {
  return [...productos].sort(compararRecorrido).map((p) => p.id)
}

/** El puesto de cada producto en el recorrido. Sin repetidos, por construccion. */
export function rangosDe(ruta: string[]): Map<string, number> {
  return new Map(ruta.map((id, i) => [id, i]))
}

/**
 * Mueve un producto dentro de lo que se esta viendo y devuelve el recorrido nuevo.
 *
 * `vista` es lo que hay en pantalla (un subconjunto del recorrido, en su orden):
 * la lista de compras solo muestra unos pocos productos, el editor muestra todos.
 * El producto se coloca justo delante del que le queda debajo en pantalla (o
 * justo detras del de arriba, si queda de ultimo), asi que en pantalla queda
 * exactamente donde se solto.
 *
 * Garantia, que es lo que se pedia: NINGUN otro producto cambia de orden
 * relativo. Ni los que se ven ni los que no.
 */
export function moverEnRuta(
  ruta: string[],
  vista: string[],
  desde: number,
  hasta: number,
): string[] {
  if (desde === hasta || desde < 0 || desde >= vista.length) return ruta
  const id = vista[desde]
  if (!ruta.includes(id)) return ruta

  const nuevaVista = moverItem(vista, desde, hasta)
  const puesto = nuevaVista.indexOf(id)
  const siguiente = nuevaVista[puesto + 1]
  const anterior = nuevaVista[puesto - 1]

  const sin = ruta.filter((x) => x !== id)
  if (siguiente != null) {
    const i = sin.indexOf(siguiente)
    return [...sin.slice(0, i), id, ...sin.slice(i)]
  }
  if (anterior != null) {
    const i = sin.indexOf(anterior)
    return [...sin.slice(0, i + 1), id, ...sin.slice(i + 1)]
  }
  return ruta
}

/** Lo minimo de un renglon de la lista para saber donde se muestra. */
export interface RenglonDeLista {
  productoId: string | null
  comprado: boolean
  costo: number | null
}

/** Un renglon ya resuelto: chuleado y, si es producto, con precio. */
export function renglonListo(r: RenglonDeLista): boolean {
  if (!r.comprado) return false
  return r.productoId ? r.costo != null : true
}

export interface OrdenDeLista {
  /** Indices de los renglones, en el orden en que se muestran. */
  indices: number[]
  /** Cuantos de los primeros se pueden arrastrar. Los demas no. */
  arrastrables: number
}

/**
 * En que orden se muestran los renglones de una lista.
 *
 * Los productos van en el orden del recorrido; las notas sueltas (que no son
 * productos y no tienen puesto en el recorrido) van despues, en el orden en que
 * se anotaron. Comprando, lo ya resuelto baja al final con la misma regla.
 *
 * Solo se arrastran los productos pendientes: son los unicos con puesto en el
 * recorrido y los unicos que tiene sentido acomodar. Por eso van todos juntos
 * al principio: asi el arrastre nunca cruza a una zona donde el renglon
 * rebotaria.
 */
export function ordenDeLista(
  items: RenglonDeLista[],
  rangos: Map<string, number>,
  separarListos: boolean,
): OrdenDeLista {
  const rango = (i: number) => rangos.get(items[i].productoId as string) ?? Number.MAX_SAFE_INTEGER
  const porRecorrido = (xs: number[]) => [...xs].sort((a, b) => rango(a) - rango(b) || a - b)

  const todos = items.map((_, i) => i)
  const pendiente = (i: number) => !separarListos || !renglonListo(items[i])
  const producto = (i: number) => items[i].productoId != null

  const productosPendientes = porRecorrido(todos.filter((i) => producto(i) && pendiente(i)))
  const notasPendientes = todos.filter((i) => !producto(i) && pendiente(i))
  const productosListos = porRecorrido(todos.filter((i) => producto(i) && !pendiente(i)))
  const notasListas = todos.filter((i) => !producto(i) && !pendiente(i))

  return {
    indices: [...productosPendientes, ...notasPendientes, ...productosListos, ...notasListas],
    arrastrables: productosPendientes.length,
  }
}

/**
 * A que puesto cae un renglon arrastrado.
 *
 * Se decide con los centros reales de cada renglon, medidos al alzarlo. Antes
 * se sumaban los altos de los renglones sin contar el espacio entre ellos, y
 * cada 6 o 7 renglones el error llegaba a un puesto entero: el renglon caia uno
 * mas alla de donde se soltaba.
 *
 * La regla es la misma subiendo que bajando: el renglon toma el puesto de otro
 * cuando su centro ALCANZA el centro de ese otro. Soltarlo con el centro justo
 * encima de un renglon lo deja en el puesto de ese renglon, en las dos
 * direcciones. (Una primera version contaba "centros estrictamente por encima"
 * y, bajando, ese empate lo dejaba siempre un puesto corto.)
 */
export function destinoPorCentros(
  centros: number[],
  desde: number,
  centroArrastrado: number,
  arrastrables: number,
): number {
  if (desde < 0 || desde >= arrastrables) return desde
  let destino = desde
  if (centroArrastrado > centros[desde]) {
    for (let j = desde + 1; j < arrastrables; j++) {
      if (centros[j] <= centroArrastrado) destino = j
    }
  } else if (centroArrastrado < centros[desde]) {
    for (let j = desde - 1; j >= 0; j--) {
      if (centros[j] >= centroArrastrado) destino = j
    }
  }
  return destino
}
