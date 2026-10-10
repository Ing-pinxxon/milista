'use client'

/**
 * Guarda el recorrido en el servidor sin que una peticion pise a otra.
 *
 * Al arrastrar varias veces seguidas salen varias peticiones. Si se mandaran
 * todas a la vez, una vieja que llegara tarde dejaria guardado un orden anterior
 * y la lista "se devolveria" sola. Por eso va una sola a la vez, se espera medio
 * segundo a que se termine de acomodar, y siempre se manda la ultima.
 */
export function crearGuardadorDeRecorrido(alFallar: () => void) {
  let pendiente: string[] | null = null
  let enVuelo: string[] | null = null
  let temporizador: ReturnType<typeof setTimeout> | null = null

  const programarEnvio = (ms: number) => {
    if (temporizador) clearTimeout(temporizador)
    temporizador = setTimeout(enviar, ms)
  }

  async function enviar(): Promise<void> {
    temporizador = null
    if (enVuelo || !pendiente) return
    const ruta = pendiente
    pendiente = null
    enVuelo = ruta
    let fallo = false
    try {
      const r = await fetch('/api/productos/orden', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ruta }),
        // Que llegue aunque se cierre la app justo despues de soltar.
        keepalive: true,
      })
      fallo = !r.ok
    } catch {
      fallo = true
    }
    enVuelo = null
    if (fallo) {
      // Se reintenta, pero con lo mas nuevo si mientras tanto hubo otro cambio.
      pendiente = pendiente ?? ruta
      alFallar()
      programarEnvio(4000)
    } else if (pendiente) {
      // Hubo otro cambio mientras esta iba en camino.
      programarEnvio(0)
    }
  }

  return {
    /** Anota el recorrido nuevo; se manda en cuanto se deje de mover. */
    programar(ruta: string[]) {
      pendiente = ruta
      programarEnvio(500)
    },
    /** Lo que todavia no esta guardado, para no pisarlo al recargar el catalogo. */
    sinGuardar(): string[] | null {
      return pendiente ?? enVuelo
    },
    /** Manda ya lo pendiente: al cerrar o esconder la app. */
    ahora() {
      if (pendiente && !enVuelo) {
        if (temporizador) clearTimeout(temporizador)
        void enviar()
      }
    },
  }
}
