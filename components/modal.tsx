'use client'

interface Props {
  titulo: string
  onCerrar: () => void
  children: React.ReactNode
  pie?: React.ReactNode
}

/** Hoja a pantalla completa que sube desde abajo, como las del sistema. */
export function Modal({ titulo, onCerrar, children, pie }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex animate-slide-up flex-col bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h2 className="text-lg font-bold tracking-tight">{titulo}</h2>
        <button
          onClick={onCerrar}
          className="-mr-2 min-h-[44px] px-2 font-mono text-[11px] uppercase tracking-wider text-neutral-400"
        >
          Cerrar
        </button>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {pie && (
        <div className="border-t border-neutral-800 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{pie}</div>
      )}
    </div>
  )
}
