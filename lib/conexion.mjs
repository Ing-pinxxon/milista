/**
 * Encuentra las conexiones de Postgres entre las variables de entorno.
 *
 * Vercel deja elegir un prefijo al conectar una base, asi que las variables
 * pueden llamarse DATABASE_URL, POSTGRES_URL, STORAGE_URL o cualquier cosa con
 * un prefijo delante. Por eso se identifican por su VALOR y no por su nombre:
 * lo que importa es que sean una URL de Postgres.
 *
 * Neon entrega dos conexiones distintas y las dos hacen falta:
 * - la agrupada (PgBouncer) para las consultas de la app, porque cada invocacion
 *   serverless abre una conexion nueva y sin pooler se agota Postgres;
 * - la directa para las migraciones, porque el DDL no funciona a traves de un
 *   pooler en modo transaccion.
 * En el host de la agrupada, Neon pone "-pooler".
 */

const ES_POSTGRES = /^postgres(ql)?:\/\//i
const NOMBRE_DIRECTA = /UNPOOLED|NON_POOLING|NONPOOLING|DIRECT/i
const NOMBRE_AGRUPADA = /^(DATABASE_URL|POSTGRES_PRISMA_URL)$/i

/** @typedef {{ agrupada: string, directa: string }} Conexiones */

function tienePooler(url) {
  try {
    return new URL(url).hostname.includes('-pooler')
  } catch {
    return false
  }
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {Conexiones}
 */
export function resolverConexiones(env = process.env) {
  // Ordenado por nombre para que el resultado no dependa del orden del entorno.
  const urls = Object.entries(env)
    .filter(([, v]) => typeof v === 'string' && ES_POSTGRES.test(v))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nombre, valor]) => ({ nombre, valor: /** @type {string} */ (valor) }))

  if (urls.length === 0) {
    throw new Error(
      'No encontre ninguna conexion de Postgres en las variables de entorno. ' +
        'Revisa que la base este conectada al proyecto (en Vercel: Storage → Connect Project).',
    )
  }

  // La directa: primero por nombre explicito, si no la que no pase por el pooler.
  const directa =
    urls.find((u) => NOMBRE_DIRECTA.test(u.nombre)) ?? urls.find((u) => !tienePooler(u.valor))

  // La agrupada: primero por host, luego por nombre canonico, y si no la primera
  // que no sea la directa.
  const agrupada =
    urls.find((u) => tienePooler(u.valor)) ??
    urls.find((u) => NOMBRE_AGRUPADA.test(u.nombre) && !NOMBRE_DIRECTA.test(u.nombre)) ??
    urls.find((u) => u.nombre !== directa?.nombre) ??
    urls[0]

  // Con una sola URL (Postgres normal sin pooler, como el de desarrollo) la misma
  // sirve para las dos cosas.
  return {
    agrupada: (agrupada ?? directa ?? urls[0]).valor,
    directa: (directa ?? agrupada ?? urls[0]).valor,
  }
}
