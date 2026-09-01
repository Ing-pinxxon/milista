# Mi lista — precios de abastos

App para manejar los precios diarios de un negocio de abastos en Bogotá: se busca
un producto y se ve el precio de venta, se pega la lista que llega por WhatsApp y
la app la interpreta, y cada precio queda guardado con su fecha para poder ver
cómo se movió en el tiempo.

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL · PWA.

---

## Qué hace

**Buscar.** 112 productos, búsqueda instantánea, el precio de venta en grande.
Funciona sin señal: el catálogo queda cacheado en el celular.

**Pegar la lista del día.** Se pega el texto tal como llega y la app lo interpreta:

| Lo que llega | Cómo lo entiende |
|---|---|
| `Guayaba sale 4000kg ✅` | costo $4.000 por kilo |
| `Papaya sale 3000libra ✅` | libra → kilo, costo $6.000 |
| `Tomate parejo 3000kg y grueso 4000kg ✅` | dos productos, «grueso» hereda «Tomate» |
| `Criolla ❌` | sin existencia, **sin borrar el precio** |
| `Coliseros 2200kg ✅ vender 3200` | costo $2.200, venta fijada en $3.200 |
| `Granadilla 1666 C/u` | por unidad, sin convertir a kilo |
| `Papá criolla 4000kg` | empareja con «Criolla» pese a la tilde |
| `criolla 1/2 roba pareja 4800kg` | ignora la fracción, empareja «Criolla pareja» |

Si el producto está marcado en `Lb` y el texto no dice «kg», asume libra y
multiplica por dos. **Todos los precios se guardan por kilo.**

**Revisar antes de aplicar.** Muestra antes → después con flecha arriba/abajo, se
puede desmarcar cambio por cambio, y lo que no reconoció queda aparte para crearlo
o asignarlo a un producto existente.

**Aprender.** Cuando se asigna una línea a mano, ese texto se guarda como alias del
producto y la próxima vez empareja solo.

**Recalcular con el margen propio.** Cada producto tiene el suyo (la mayoría 1.30;
habichuela y alverja 1.25; curuba y arándanos 1.20; coliseros 1.4545…). La venta se
redondea hacia arriba al múltiplo de 50.

**Histórico y exportación.** Gráfica de costo y venta en el tiempo por producto,
CSV con las columnas de la hoja de cálculo, y un botón que copia las dos columnas
(compra y venta) en el orden exacto de las filas para pegarlas encima.

---

## Correr en local

Hace falta Node 20+ y un PostgreSQL.

```bash
npm install
cp .env.example .env          # y llena las tres variables
npx prisma migrate deploy     # crea las tablas
npx prisma db seed            # carga los 112 productos
npm run dev
```

```bash
npm test                      # tests del parser y del resolutor de conexiones
```

## Variables de entorno

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a Postgres. En Vercel la inyecta la base; en local la pones tú. |
| `DATABASE_URL_UNPOOLED` | Conexión directa, solo para migraciones. En local, la misma que la anterior. |
| `CLAVE_ESCRITURA` | Clave para cambiar precios. **Obligatoria**: sin ella la app queda de solo lectura. |
| `NEXT_PUBLIC_APP_URL` | URL pública. Opcional. |

Consultar precios es público; cambiarlos pide la clave una vez y deja una cookie de
un año.

**Sobre los nombres de las variables:** Vercel permite un prefijo al conectar la base,
así que pueden quedar como `DATABASE_URL`, `POSTGRES_URL`, `STORAGE_URL` o cualquier
otra cosa. La app no depende del nombre: recorre las variables, se queda con las que
son una URL de Postgres y distingue la agrupada de la directa por el propio host. No
tienes que renombrar nada.

---

## Desplegar en Vercel

La app necesita un Postgres. Vercel te lo da desde su propio panel: «Vercel Postgres»
como producto propio se retiró en diciembre de 2024 y ahora se provisiona **Neon** desde
el Marketplace, sin salir de Vercel.

1. **Add New → Project** e importa este repositorio. Vercel detecta Next.js solo.
2. **Storage → Create Database → Neon**, y conéctala al proyecto. Las variables de
   conexión quedan puestas solas.
3. **Settings → Environment Variables → `CLAVE_ESCRITURA`**, una frase larga. Es la que
   te va a pedir la app para cambiar precios.
4. **Redeploy.** El build aplica las migraciones y crea las tablas.
5. Abre la URL. Sale **«Casi lista»** con un botón para cargar los 112 productos: lo
   tocas, pones la clave, y ya queda funcionando. Se puede repetir sin duplicar nada.
6. En Android: Chrome → ⋮ → **Instalar aplicación**.

### Cómo se aplican las migraciones

El `package.json` trae un script `vercel-build`, que Vercel ejecuta en lugar de `build`
cuando existe:

```
node scripts/preparar-env.mjs && prisma generate && prisma migrate deploy && next build
```

No hay que configurar nada en el panel. Si `migrate deploy` falla, `next build` no corre,
el despliegue se marca como fallido y **la versión anterior sigue en línea**. Si por lo
que sea Vercel no tomara el script, pon ese mismo comando en Settings → Build Command.

Hacen falta dos conexiones distintas y por eso el `datasource` tiene `directUrl`: las
consultas de la app van por la **agrupada** (PgBouncer), porque cada invocación
serverless abre una conexión nueva y sin pooler se agota Postgres; las migraciones van
por la **directa**, porque el DDL no funciona a través de un pooler en modo transacción.

En el plan gratuito de Neon la base se duerme cuando no se usa, así que la primera
consulta del día tarda un segundo de más. No es un error.

## Instalar en el celular (Android)

Abre la URL en Chrome → menú (⋮) → **Instalar aplicación**. Queda con su icono en
la pantalla de inicio y abre sin barra de navegador. El catálogo queda guardado,
así que se pueden consultar precios en la plaza sin señal; para pegar la lista sí
hace falta conexión.

---

## Estructura

```
app/
  page.tsx                     buscador
  historico/[slug]/page.tsx    gráfica del precio en el tiempo
  api/
    productos/                 GET catálogo · POST crear · PATCH editar
    actualizacion/             POST preview (no escribe)
    actualizacion/aplicar/     POST aplica los cambios confirmados
    export/csv/                CSV para la hoja de cálculo
    sesion/                    entrega la cookie a cambio de la clave
    setup/                     carga el catálogo tras el primer despliegue
components/                    interfaz
lib/
  parser.ts                    interpreta la lista. Función pura, con tests
  normalizar.ts                limpieza de texto y aliases
  precios.ts                   redondeo a 50, margen, formato de pesos
  consultas.ts                 catálogo con el precio vigente
  conexion.mjs                 encuentra la base sin depender del nombre de la variable
  productos.ts                 los 112 productos con su unidad y su precio
  seed.ts                      carga el catálogo. La usan el CLI y /api/setup
scripts/
  preparar-env.mjs             deja el .env que el CLI de Prisma espera, en el build
prisma/
  schema.prisma                Producto · Precio · Actualizacion
  seed.ts                      envoltorio de `prisma db seed`
```

### Cómo está modelado

El precio **nunca se sobreescribe**: cada cambio inserta un registro nuevo en
`Precio` con su fecha. El precio vigente de un producto es simplemente el más
reciente. De ahí sale el histórico sin trabajo extra, y las correcciones a mano
también quedan registradas.

Cada lista que se aplica se guarda entera en `Actualizacion.textoOriginal`, tal
como llegó, y los precios que produjo apuntan a ella. Si un día un precio quedó
raro, se puede ver de qué lista salió.

`Producto.orden` conserva el orden de la hoja de cálculo: el botón «copiar
columnas» depende de él para que las filas peguen alineadas.
