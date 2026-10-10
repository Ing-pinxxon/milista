'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { destinoPorCentros } from './recorrido'

/** Cuanto hay que mantener el dedo para que el recuadro se alce. */
const MS_PARA_ALZAR = 220
/** Si el dedo se mueve mas que esto antes de alzarse, era scroll y se cancela. */
const TOLERANCIA_PX = 8
/**
 * Franja en los bordes donde la lista se desplaza sola. Era de 72 px y con el
 * dedo quieto cerca del borde seguia desplazando: el renglon se pasaba cinco o
 * seis puestos de donde se queria soltar.
 */
const BORDE_AUTOSCROLL_PX = 44
/** Pixeles por fotograma en el borde mismo; menos hacia adentro de la franja. */
const VELOCIDAD_AUTOSCROLL = 9

interface Medidas {
  /** Centro de cada renglon, en coordenadas del contenido (no de la pantalla). */
  centros: number[]
  /** Cuanto ocupa el renglon alzado contando el espacio hasta el siguiente. */
  hueco: number
}

interface Gesto {
  indice: number
  alzado: boolean
  /** Si el dedo se ha movido desde que se alzo: sin esto el autoscroll arranca solo. */
  movido: boolean
  x0: number
  y0: number
  scroll0: number
  medidas: Medidas | null
  destino: number
}

const SIN_GESTO: Gesto = {
  indice: -1,
  alzado: false,
  movido: false,
  x0: 0,
  y0: 0,
  scroll0: 0,
  medidas: null,
  destino: -1,
}

interface Vista {
  indice: number | null
  desplazamiento: number
  destino: number | null
  hueco: number
}

const SIN_VISTA: Vista = { indice: null, desplazamiento: 0, destino: null, hueco: 0 }

/** El ancestro desplazable mas cercano: es quien hay que mover en el autoscroll. */
function buscarMarco(desde: HTMLElement | null): HTMLElement | null {
  let el = desde?.parentElement ?? null
  while (el) {
    const overflow = getComputedStyle(el).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) return el
    el = el.parentElement
  }
  return null
}

/**
 * Reordenar renglones manteniendolos pulsados y arrastrandolos.
 *
 * Solo se arrastran los `arrastrables` primeros renglones, y el destino nunca
 * sale de ellos: en la lista de compras lo de abajo (lo ya comprado, las notas)
 * no tiene puesto en el recorrido, y soltar algo ahi lo hacia rebotar.
 */
export function usarArrastre({
  cantidad,
  arrastrables,
  onSoltar,
}: {
  cantidad: number
  arrastrables: number
  onSoltar: (desde: number, hasta: number) => void
}) {
  const [vista, setVista] = useState<Vista>(SIN_VISTA)
  // Un fotograma sin transiciones al soltar: si no, los renglones que estaban
  // corridos se animan desde la posicion vieja y parece que saltan otros.
  const [soltando, setSoltando] = useState(false)

  const filas = useRef<(HTMLElement | null)[]>([])
  const gesto = useRef<Gesto>(SIN_GESTO)
  const contenedor = useRef<HTMLElement | null>(null)
  const marco = useRef<HTMLElement | null>(null)
  const punteroY = useRef(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animacion = useRef<number | null>(null)
  const suprimirClick = useRef(false)

  // Lo ultimo de las props, para que los manejadores nunca usen valores viejos.
  const actual = useRef({ cantidad, arrastrables, onSoltar })
  actual.current = { cantidad, arrastrables, onSoltar }

  const cancelarEspera = () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
  }

  const pararAutoscroll = () => {
    if (animacion.current) cancelAnimationFrame(animacion.current)
    animacion.current = null
  }

  /** Mide donde esta cada renglon, en coordenadas del contenido. */
  const medir = (indice: number): Medidas => {
    const m = marco.current
    const base = m ? m.getBoundingClientRect().top - m.scrollTop : 0
    const cajas = Array.from({ length: actual.current.cantidad }, (_, i) => {
      const r = filas.current[i]?.getBoundingClientRect()
      return r ? { top: r.top - base, alto: r.height } : { top: 0, alto: 0 }
    })
    const espacio =
      cajas.length > 1 ? Math.max(0, cajas[1].top - (cajas[0].top + cajas[0].alto)) : 0
    return {
      centros: cajas.map((c) => c.top + c.alto / 2),
      hueco: cajas[indice].alto + espacio,
    }
  }

  /** Recalcula desplazamiento y destino con el dedo y el scroll actuales. */
  const actualizar = () => {
    const g = gesto.current
    if (!g.alzado || !g.medidas) return
    const corrido = (marco.current?.scrollTop ?? 0) - g.scroll0
    const delta = punteroY.current - g.y0 + corrido
    const destino = destinoPorCentros(
      g.medidas.centros,
      g.indice,
      g.medidas.centros[g.indice] + delta,
      actual.current.arrastrables,
    )
    g.destino = destino
    setVista({ indice: g.indice, desplazamiento: delta, destino, hueco: g.medidas.hueco })
  }

  const terminar = (aplicar: boolean) => {
    cancelarEspera()
    pararAutoscroll()
    const g = gesto.current
    gesto.current = SIN_GESTO
    if (g.alzado) {
      // El navegador puede mandar un clic al soltar: no debe chulear ni quitar nada.
      suprimirClick.current = true
      setTimeout(() => (suprimirClick.current = false), 400)
      if (aplicar && g.destino >= 0 && g.destino !== g.indice) {
        actual.current.onSoltar(g.indice, g.destino)
      }
      setSoltando(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setSoltando(false)))
    }
    setVista(SIN_VISTA)
  }

  const alPulsar = (e: React.PointerEvent, indice: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (indice >= actual.current.arrastrables) return
    // Escribir el precio no debe alzar el renglon.
    if ((e.target as HTMLElement).closest('input, textarea, select, [data-sin-arrastre]')) return

    const elemento = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    gesto.current = { ...SIN_GESTO, indice, x0: e.clientX, y0: e.clientY }
    punteroY.current = e.clientY

    cancelarEspera()
    temporizador.current = setTimeout(() => {
      const g = gesto.current
      if (g.indice !== indice) return
      marco.current = buscarMarco(contenedor.current)
      // Se mide ANTES de cambiar nada en pantalla.
      g.medidas = medir(indice)
      g.alzado = true
      g.y0 = punteroY.current
      g.scroll0 = marco.current?.scrollTop ?? 0
      g.destino = indice
      try {
        elemento.setPointerCapture(pointerId)
      } catch {
        // Si el puntero ya no existe, el gesto termina con el siguiente evento.
      }
      navigator.vibrate?.(10)
      setVista({ indice, desplazamiento: 0, destino: indice, hueco: g.medidas.hueco })
    }, MS_PARA_ALZAR)
  }

  const alMover = (e: React.PointerEvent) => {
    const g = gesto.current
    if (g.indice < 0) return
    punteroY.current = e.clientY
    if (!g.alzado) {
      // Todavia no se alza: si el dedo se va, era scroll.
      if (Math.abs(e.clientY - g.y0) > TOLERANCIA_PX || Math.abs(e.clientX - g.x0) > TOLERANCIA_PX) {
        cancelarEspera()
        gesto.current = SIN_GESTO
      }
      return
    }
    g.movido = true
    actualizar()
  }

  // Mientras hay un renglon alzado, el navegador no debe desplazar la lista.
  // Va conectado desde el principio y no al alzar: conectado tarde, el navegador
  // alcanzaba a quedarse con el gesto, cancelaba el arrastre y el renglon caia
  // a medio camino.
  const bloquear = useCallback((e: TouchEvent) => {
    if (gesto.current.alzado) e.preventDefault()
  }, [])

  const refContenedor = useCallback(
    (el: HTMLElement | null) => {
      contenedor.current?.removeEventListener('touchmove', bloquear)
      contenedor.current = el
      el?.addEventListener('touchmove', bloquear, { passive: false })
    },
    [bloquear],
  )

  /** Al llegar al borde la lista se desplaza sola, mas despacio hacia adentro. */
  useEffect(() => {
    if (vista.indice == null) return
    const paso = () => {
      const el = marco.current
      const g = gesto.current
      if (el && g.alzado && g.movido) {
        const caja = el.getBoundingClientRect()
        const y = punteroY.current
        const arriba = (caja.top + BORDE_AUTOSCROLL_PX - y) / BORDE_AUTOSCROLL_PX
        const abajo = (y - (caja.bottom - BORDE_AUTOSCROLL_PX)) / BORDE_AUTOSCROLL_PX
        const fuerza = Math.min(1, Math.max(arriba, abajo))
        if (fuerza > 0) {
          const dy = Math.max(1, VELOCIDAD_AUTOSCROLL * fuerza * fuerza) * (arriba > 0 ? -1 : 1)
          const antes = el.scrollTop
          el.scrollTop += dy
          if (el.scrollTop !== antes) actualizar()
        }
      }
      animacion.current = requestAnimationFrame(paso)
    }
    animacion.current = requestAnimationFrame(paso)
    return pararAutoscroll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista.indice])

  useEffect(
    () => () => {
      cancelarEspera()
      pararAutoscroll()
      contenedor.current?.removeEventListener('touchmove', bloquear)
    },
    [bloquear],
  )

  /** Cuanto se corre un renglon para dejarle sitio al que se arrastra. */
  const desplazamientoDe = (i: number): number => {
    const { indice: d, destino: t, hueco } = vista
    if (d == null || t == null || i === d || i >= arrastrables) return 0
    if (t > d && i > d && i <= t) return -hueco
    if (t < d && i >= t && i < d) return hueco
    return 0
  }

  /** Todo lo que necesita un renglon: medidas, gesto y estilo. */
  const propsDe = (i: number) => {
    const alzado = vista.indice === i
    const dy = alzado ? vista.desplazamiento : desplazamientoDe(i)
    return {
      ref: (el: HTMLElement | null) => {
        filas.current[i] = el
      },
      onPointerDown: (e: React.PointerEvent) => alPulsar(e, i),
      onPointerMove: alMover,
      onPointerUp: () => terminar(true),
      // Si el navegador cancela el gesto no se aplica nada: aplicarlo a medias
      // dejaba el renglon donde no se queria.
      onPointerCancel: () => terminar(false),
      onClickCapture: (e: React.MouseEvent) => {
        if (suprimirClick.current) {
          e.preventDefault()
          e.stopPropagation()
          suprimirClick.current = false
        }
      },
      onContextMenu: (e: React.MouseEvent) => {
        if (gesto.current.indice >= 0) e.preventDefault()
      },
      'data-fila': i,
      style: {
        transform: alzado ? `translateY(${dy}px) scale(1.02)` : dy ? `translateY(${dy}px)` : undefined,
        transition: alzado || soltando ? 'none' : 'transform 160ms ease',
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none',
        position: alzado ? ('relative' as const) : undefined,
        zIndex: alzado ? 10 : undefined,
      } as React.CSSProperties,
    }
  }

  return {
    /** Indice del renglon alzado, o null. */
    alzado: vista.indice,
    refContenedor,
    propsDe,
  }
}
