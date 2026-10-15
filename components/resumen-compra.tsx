'use client'

import { useState } from 'react'

/**
 * Copia texto al portapapeles.
 *
 * navigator.clipboard falla en algunos navegadores de Android y dentro de la app
 * instalada si la pagina no tiene el foco; en ese caso se usa el metodo viejo de
 * seleccionar un textarea, que funciona en todos lados.
 */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = texto
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, texto.length)
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    return ok
  }
}

/**
 * El texto como se ve en WhatsApp: lo que va entre asteriscos sale en negrita y
 * sin los asteriscos. Lo que se copia sigue llevandolos, que es lo que WhatsApp
 * convierte en negrita.
 */
function comoEnWhatsApp(texto: string) {
  return texto.split(/(\*[^*\n]+\*)/).map((trozo, i) =>
    /^\*[^*\n]+\*$/.test(trozo) ? (
      <strong key={i} className="font-semibold text-neutral-100">
        {trozo.slice(1, -1)}
      </strong>
    ) : (
      trozo
    ),
  )
}

interface Props {
  texto: string
  /** Si arranca mostrando el texto o solo los botones. */
  abierto?: boolean
}

/**
 * El resumen de la compra con sus botones: copiar para pegar en un mensaje, y
 * compartir, que en Android abre directo la lista de chats de WhatsApp.
 */
export function ResumenCompra({ texto, abierto = false }: Props) {
  const [estado, setEstado] = useState<'listo' | 'copiado' | 'error'>('listo')
  const [verTexto, setVerTexto] = useState(abierto)
  const puedeCompartir = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const alCopiar = async () => {
    const ok = await copiar(texto)
    setEstado(ok ? 'copiado' : 'error')
    if (ok) navigator.vibrate?.(15)
    setTimeout(() => setEstado('listo'), 2500)
  }

  const alCompartir = async () => {
    try {
      await navigator.share({ text: texto })
    } catch {
      // Cancelado por el usuario: no es un error.
    }
  }

  return (
    <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-amber-500">
          Resumen para mandar
        </p>
        <button
          onClick={() => setVerTexto((v) => !v)}
          className="min-h-[32px] font-mono text-[10px] uppercase tracking-wider text-neutral-500 underline underline-offset-2"
        >
          {verTexto ? 'Ocultar' : 'Ver cómo queda'}
        </button>
      </div>

      {verTexto && (
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-neutral-950 p-3 font-sans text-[13px] leading-relaxed text-neutral-300">
          {comoEnWhatsApp(texto)}
        </pre>
      )}

      <div className="mt-2 flex gap-2">
        <button
          onClick={alCopiar}
          className={`min-h-[44px] flex-1 rounded-lg font-mono text-[11px] font-bold uppercase tracking-wider ${
            estado === 'copiado'
              ? 'bg-green-500 text-neutral-950'
              : estado === 'error'
                ? 'bg-red-500 text-neutral-950'
                : 'bg-amber-400 text-neutral-950'
          }`}
        >
          {estado === 'copiado' ? 'Copiado ✓' : estado === 'error' ? 'No se pudo copiar' : 'Copiar resumen'}
        </button>
        {puedeCompartir && (
          <button
            onClick={alCompartir}
            className="min-h-[44px] rounded-lg border border-amber-700 px-4 font-mono text-[11px] uppercase tracking-wider text-amber-400"
          >
            Compartir
          </button>
        )}
      </div>

      {estado === 'error' && (
        <p className="mt-2 text-xs text-neutral-400">
          Toca «Ver cómo queda», mantén pulsado el texto y cópialo a mano.
        </p>
      )}
    </div>
  )
}
