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
cp .env.example .env          # y llena DATABASE_URL y CLAVE_ESCRITURA
npx prisma migrate deploy     # crea las tablas
npx prisma db seed            # carga los 112 productos
npm run dev
```

```bash
npm test                      # los tests del parser
```

## Variables de entorno

| Variable | Para qué | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL. **Obligatoria.** | `postgresql://user:clave@host:5432/milista` |
| `CLAVE_ESCRITURA` | Clave para poder cambiar precios. **Obligatoria.** Sin ella la app queda de solo lectura. | una frase larga |
| `NEXT_PUBLIC_APP_URL` | URL pública. Opcional. | `https://milista.up.railway.app` |

Consultar precios es público; cambiarlos pide la clave una vez y deja una cookie
de un año.

---

## Desplegar en Railway (recomendado)

Railway da la app y la base de datos en el mismo proyecto, que es lo más simple.

1. **New Project → Deploy from GitHub repo** y elige este repositorio.
2. **New → Database → Add PostgreSQL.** Railway crea `DATABASE_URL` sola.
3. En el servicio de la app, **Variables**:
   - `DATABASE_URL` → referencia la del Postgres (`${{Postgres.DATABASE_URL}}`).
   - `CLAVE_ESCRITURA` → tu clave.
4. **Settings → Deploy → Start Command**:
   ```
   npx prisma migrate deploy && npm start
   ```
   Así cada despliegue aplica las migraciones pendientes antes de arrancar.
5. Primer despliegue: una sola vez, carga los productos.
   ```
   railway run npx prisma db seed
   ```
6. **Settings → Networking → Generate Domain** para tener la URL.

## Desplegar en Vercel

Vercel corre la app pero **no incluye base de datos**: hay que traer un Postgres
aparte (Neon, Supabase, o el mismo Postgres de Railway).

1. Crea el Postgres donde prefieras y copia su cadena de conexión.
2. **Import Project** desde GitHub. Vercel detecta Next.js solo.
3. **Environment Variables**: `DATABASE_URL` y `CLAVE_ESCRITURA`.
4. El `build` del `package.json` ya corre `prisma generate`, que es lo que Vercel
   necesita para que el cliente de Prisma exista en la función.
5. Las migraciones y el seed se corren **desde tu máquina** apuntando al mismo
   Postgres, porque el build de Vercel no debería tocar la base:
   ```bash
   DATABASE_URL="la-misma-de-produccion" npx prisma migrate deploy
   DATABASE_URL="la-misma-de-produccion" npx prisma db seed
   ```

Si la app abre y dice «Falta conectar la base», es que faltó el paso 5.

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
components/                    interfaz
lib/
  parser.ts                    interpreta la lista. Función pura, con tests
  normalizar.ts                limpieza de texto y aliases
  precios.ts                   redondeo a 50, margen, formato de pesos
  consultas.ts                 catálogo con el precio vigente
prisma/
  schema.prisma                Producto · Precio · Actualizacion
  seed.ts                      los 112 productos con su margen
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
