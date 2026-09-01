/** Pantalla de arranque cuando la base todavia no esta lista. */
export function SinBaseDeDatos({ motivo }: { motivo: 'vacia' | 'sin-conexion' }) {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Falta conectar la base</h1>
      <p className="mt-3 text-neutral-400">
        {motivo === 'vacia'
          ? 'La base responde pero no tiene productos todavía. Falta correr el seed.'
          : 'La app no pudo conectarse a Postgres. Revisa DATABASE_URL.'}
      </p>

      <div className="mt-8 space-y-4 font-mono text-sm">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-neutral-500">1. Variables</p>
          <pre className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-neutral-300">
            DATABASE_URL=postgresql://…{'\n'}CLAVE_ESCRITURA=…
          </pre>
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wider text-neutral-500">
            2. Crear las tablas y cargar los productos
          </p>
          <pre className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-neutral-300">
            npx prisma migrate deploy{'\n'}npx prisma db seed
          </pre>
        </div>
      </div>

      <p className="mt-8 text-sm text-neutral-500">Los pasos completos están en el README.</p>
    </main>
  )
}
