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

/** Escotilla de escape: si esta puesta, gana sin discusion. */
const FORZADA_AGRUPADA = 'MILISTA_DATABASE_URL'
const FORZADA_DIRECTA = 'MILISTA_DATABASE_URL_UNPOOLED'

/**
 * @typedef {object} Conexiones
 * @property {string} agrupada
 * @property {string} directa
 * @property {string} nombreAgrupada  Variable de la que salio la agrupada.
 * @property {string} nombreDirecta   Variable de la que salio la directa.
 * @property {boolean} ambiguo        Hay URLs apuntando a mas de una base.
 * @property {string[]} candidatas    Nombres de todas las variables encontradas.
 */

function hostDe(url) {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function tienePooler(url) {
  return hostDe(url).includes('-pooler')
}

/** El host sin el sufijo del pooler, para saber si dos URLs son la misma base. */
function baseDe(url) {
  return hostDe(url).replace('-pooler', '')
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

  const forzadaAgrupada = urls.find((u) => u.nombre === FORZADA_AGRUPADA)
  const forzadaDirecta = urls.find((u) => u.nombre === FORZADA_DIRECTA)

  // La directa: primero por nombre explicito, si no la que no pase por el pooler.
  const directa =
    forzadaDirecta ??
    forzadaAgrupada ??
    urls.find((u) => NOMBRE_DIRECTA.test(u.nombre)) ??
    urls.find((u) => !tienePooler(u.valor))

  // La agrupada: primero por host, luego por nombre canonico, y si no la primera
  // que no sea la directa.
  const agrupada =
    forzadaAgrupada ??
    urls.find((u) => tienePooler(u.valor)) ??
    urls.find((u) => NOMBRE_AGRUPADA.test(u.nombre) && !NOMBRE_DIRECTA.test(u.nombre)) ??
    urls.find((u) => u.nombre !== directa?.nombre) ??
    urls[0]

  // Con una sola URL (Postgres normal sin pooler, como el de desarrollo) la misma
  // sirve para las dos cosas.
  const ganadoraAgrupada = agrupada ?? directa ?? urls[0]
  const ganadoraDirecta = directa ?? agrupada ?? urls[0]

  // Si hay URLs apuntando a bases distintas, casi siempre son variables huerfanas
  // de una conexion anterior. Elegir en silencio seria escribir los precios en la
  // base equivocada, asi que se marca y quien llame avisa.
  const bases = new Set(urls.map((u) => baseDe(u.valor)).filter(Boolean))
  const ambiguo = !forzadaAgrupada && bases.size > 1

  return {
    agrupada: ganadoraAgrupada.valor,
    directa: ganadoraDirecta.valor,
    nombreAgrupada: ganadoraAgrupada.nombre,
    nombreDirecta: ganadoraDirecta.nombre,
    ambiguo,
    candidatas: urls.map((u) => u.nombre),
  }
}

/**
 * Deja constancia de que variable se uso, y avisa si el entorno tiene mas de una
 * base. Sin esto, conectarse a la base equivocada no deja rastro en ningun log.
 *
 * @param {Conexiones} conexiones
 * @param {(msg: string) => void} [avisar]
 */
export function advertirSiAmbiguo(conexiones, avisar = console.warn) {
  if (!conexiones.ambiguo) return
  avisar(
    `AVISO: hay variables de Postgres apuntando a bases distintas (${conexiones.candidatas.join(', ')}). ` +
      `Estoy usando ${conexiones.nombreAgrupada}. Si no es la que quieres, borra las que sobran ` +
      `en Vercel (Settings → Environment Variables) y vuelve a conectar la base, ` +
      `o define ${FORZADA_AGRUPADA} para no dejarlo a la suerte.`,
  )
}
