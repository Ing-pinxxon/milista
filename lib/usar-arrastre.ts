'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Cuanto hay que mantener el dedo para que el recuadro se alce. */
const MS_PARA_ALZAR = 220
/** Si el dedo se mueve mas que esto antes de alzarse, era scroll y se cancela. */
const TOLERANCIA_PX = 8

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
  const inicio = useRef({ y: 0, indice: -1, alzado: false })
  const contenedor = useRef<HTMLElement | null>(null)

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
    inicio.current = { y: e.clientY, indice, alzado: false }
    const destino = e.currentTarget as HTMLElement

    temporizador.current = setTimeout(() => {
      inicio.current.alzado = true
      destino.setPointerCapture?.(e.pointerId)
      navigator.vibrate?.(10)
      setArrastre({ indice, desplazamiento: 0, destino: indice })
    }, MS_PARA_ALZAR)
  }

  const alMover = (e: React.PointerEvent) => {
    const { y, indice, alzado } = inicio.current
    if (indice < 0) return
    const delta = e.clientY - y

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
    const { indice, alzado } = inicio.current
    if (alzado && arrastre.destino != null && arrastre.destino !== indice) {
      onSoltar(indice, arrastre.destino)
    }
    inicio.current = { y: 0, indice: -1, alzado: false }
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
