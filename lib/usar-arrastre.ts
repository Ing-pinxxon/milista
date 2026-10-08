'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Cuanto hay que mantener el dedo para que el recuadro se alce. */
const MS_PARA_ALZAR = 220
/** Si el dedo se mueve mas que esto antes de alzarse, era scroll y se cancela. */
const TOLERANCIA_PX = 8
/** Franja en los bordes donde la lista empieza a desplazarse sola. */
const BORDE_AUTOSCROLL_PX = 72
/** Pixeles por fotograma al desplazarse sola, en el borde mismo. */
const VELOCIDAD_AUTOSCROLL = 12

export interface Arrastre {
  /** Indice del renglon alzado, o null. */
  indice: number | null
  /** Cuanto se ha desplazado en pixeles. */
  desplazamiento: number
  /** Donde caeria si se soltara ahora. */
  destino: number | null
}

const SIN_ARRASTRE: Arrastre = { indice: null, desplazamiento: 0, destino: null }

/**
 * Reordenar renglones manteniendolos presionados y arrastrandolos.
 *
 * Se mantiene pulsado, el recuadro se alza, y se arrastra hasta donde va. Se usa
 * Pointer Events para que funcione igual con el dedo y con el raton, y mientras
 * se arrastra se bloquea el scroll de la lista con un listener no pasivo: si no,
 * el navegador se lleva el gesto y la pagina se desplaza en vez del renglon.
 */
export function usarArrastre(
  cantidad: number,
  onSoltar: (desde: number, hasta: number) => void,
) {
  const [arrastre, setArrastre] = useState<Arrastre>(SIN_ARRASTRE)
  const filas = useRef<(HTMLElement | null)[]>([])
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inicio = useRef({ y: 0, indice: -1, alzado: false, scroll: 0 })
  const contenedor = useRef<HTMLElement | null>(null)
  // El ancestro que de verdad hace scroll (el cuerpo del modal), no la lista.
  const marco = useRef<HTMLElement | null>(null)
  const punteroY = useRef(0)
  const animacion = useRef<number | null>(null)

  /** El ancestro desplazable mas cercano, que es quien hay que mover. */
  const buscarMarco = (desde: HTMLElement | null): HTMLElement | null => {
    let el = desde?.parentElement ?? null
    while (el) {
      const overflow = getComputedStyle(el).overflowY
      if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) return el
      el = el.parentElement
    }
    return null
  }

  const registrarFila = useCallback((i: number, el: HTMLElement | null) => {
    filas.current[i] = el
  }, [])

  const cancelarEspera = () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
  }

  /** A que indice corresponde el desplazamiento actual. */
  const calcularDestino = useCallback((desde: number, delta: number): number => {
    const alturas = filas.current.map((el) => el?.getBoundingClientRect().height ?? 0)
    let destino = desde
    let acumulado = 0

    if (delta > 0) {
      for (let i = desde + 1; i < cantidad; i++) {
        acumulado += alturas[i] ?? 0
        if (delta > acumulado - (alturas[i] ?? 0) / 2) destino = i
      }
    } else {
      for (let i = desde - 1; i >= 0; i--) {
        acumulado += alturas[i] ?? 0
        if (-delta > acumulado - (alturas[i] ?? 0) / 2) destino = i
      }
    }
    return destino
  }, [cantidad])

  const alPulsar = (e: React.PointerEvent, indice: number) => {
    // Solo el boton principal: un clic derecho no debe alzar nada.
    if (e.button !== 0) return
    marco.current = marco.current ?? buscarMarco(contenedor.current)
    inicio.current = {
      y: e.clientY,
      indice,
      alzado: false,
      scroll: marco.current?.scrollTop ?? 0,
    }
    punteroY.current = e.clientY
    const destino = e.currentTarget as HTMLElement

    temporizador.current = setTimeout(() => {
      inicio.current.alzado = true
      destino.setPointerCapture?.(e.pointerId)
      navigator.vibrate?.(10)
      setArrastre({ indice, desplazamiento: 0, destino: indice })
    }, MS_PARA_ALZAR)
  }

  const alMover = (e: React.PointerEvent) => {
    const { y, indice, alzado, scroll } = inicio.current
    if (indice < 0) return
    punteroY.current = e.clientY
    // Lo que se ha desplazado la lista cuenta como movimiento del renglon.
    const corrido = (marco.current?.scrollTop ?? 0) - scroll
    const delta = e.clientY - y + corrido

    // Todavia no se alza: si el dedo se va, era scroll.
    if (!alzado) {
      if (Math.abs(delta) > TOLERANCIA_PX) {
        cancelarEspera()
        inicio.current.indice = -1
      }
      return
    }

    setArrastre({ indice, desplazamiento: delta, destino: calcularDestino(indice, delta) })
  }

  const alSoltar = () => {
    cancelarEspera()
    if (animacion.current) cancelAnimationFrame(animacion.current)
    animacion.current = null
    const { indice, alzado } = inicio.current
    if (alzado && arrastre.destino != null && arrastre.destino !== indice) {
      onSoltar(indice, arrastre.destino)
    }
    inicio.current = { y: 0, indice: -1, alzado: false, scroll: 0 }
    setArrastre(SIN_ARRASTRE)
  }

  // Mientras se arrastra, el navegador no debe desplazar la lista.
  useEffect(() => {
    const el = contenedor.current
    if (!el || arrastre.indice == null) return
    const bloquear = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchmove', bloquear, { passive: false })
    return () => el.removeEventListener('touchmove', bloquear)
  }, [arrastre.indice])

  /**
   * Al llegar a los bordes la lista se desplaza sola.
   *
   * Sin esto, mover un producto del puesto 60 al 3 es imposible: el dedo llega
   * al borde de la pantalla y ahi se acaba el gesto.
   */
  useEffect(() => {
    if (arrastre.indice == null) return
    const el = marco.current
    if (!el) return

    const paso = () => {
      const caja = el.getBoundingClientRect()
      const desdeArriba = punteroY.current - caja.top
      const desdeAbajo = caja.bottom - punteroY.current
      let dy = 0

      if (desdeArriba < BORDE_AUTOSCROLL_PX) {
        dy = -VELOCIDAD_AUTOSCROLL * (1 - Math.max(0, desdeArriba) / BORDE_AUTOSCROLL_PX)
      } else if (desdeAbajo < BORDE_AUTOSCROLL_PX) {
        dy = VELOCIDAD_AUTOSCROLL * (1 - Math.max(0, desdeAbajo) / BORDE_AUTOSCROLL_PX)
      }

      if (dy !== 0) {
        const antes = el.scrollTop
        el.scrollTop += dy
        // Al desplazarse la lista, el renglon alzado tiene que seguir al dedo.
        if (el.scrollTop !== antes) {
          const { y, indice, scroll } = inicio.current
          const corrido = el.scrollTop - scroll
          const nuevoDelta = punteroY.current - y + corrido
          setArrastre({ indice, desplazamiento: nuevoDelta, destino: calcularDestino(indice, nuevoDelta) })
        }
      }
      animacion.current = requestAnimationFrame(paso)
    }

    animacion.current = requestAnimationFrame(paso)
    return () => {
      if (animacion.current) cancelAnimationFrame(animacion.current)
      animacion.current = null
    }
  }, [arrastre.indice, calcularDestino])

  useEffect(() => cancelarEspera, [])

  /**
   * Cuanto hay que correr un renglon para dejarle sitio al que se arrastra.
   */
  const desplazamientoDe = (i: number): number => {
    const { indice, destino } = arrastre
    if (indice == null || destino == null || i === indice) return 0
    const alto = filas.current[indice]?.getBoundingClientRect().height ?? 0
    if (destino > indice && i > indice && i <= destino) return -alto
    if (destino < indice && i >= destino && i < indice) return alto
    return 0
  }

  return {
    arrastre,
    registrarFila,
    refContenedor: contenedor,
    desplazamientoDe,
    manejadores: (indice: number) => ({
      onPointerDown: (e: React.PointerEvent) => alPulsar(e, indice),
      onPointerMove: alMover,
      onPointerUp: alSoltar,
      onPointerCancel: alSoltar,
    }),
  }
}
