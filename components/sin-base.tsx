import { CargarCatalogo } from './cargar-catalogo'

/** Pantalla de arranque cuando la base todavia no esta lista. */
export function SinBaseDeDatos({ motivo }: { motivo: 'vacia' | 'sin-conexion' }) {
  if (motivo === 'vacia') {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Casi lista</h1>
        <p className="mt-3 text-neutral-400">
          La base está conectada y las tablas creadas. Falta cargar el catálogo: los 112
          productos con su unidad, su margen y el precio que tienen hoy.
        </p>

        <div className="mt-8">
          <CargarCatalogo />
        </div>

        <p className="mt-4 text-sm text-neutral-500">
          Te va a pedir la clave (<span className="font-mono">CLAVE_ESCRITURA</span>). Se puede
          repetir sin problema: no duplica nada.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Falta conectar la base</h1>
      <p className="mt-3 text-neutral-400">
        La app no encontró ninguna conexión de Postgres. En Vercel: <b>Storage</b> → tu base →{' '}
        <b>Connect Project</b>, y vuelve a desplegar.
      </p>

      <div className="mt-8">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          En local
        </p>
        <pre className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900 p-3 font-mono text-sm text-neutral-300">
          cp .env.example .env{'\n'}npx prisma migrate deploy
        </pre>
      </div>

      <p className="mt-8 text-sm text-neutral-500">Los pasos completos están en el README.</p>
    </main>
  )
}
