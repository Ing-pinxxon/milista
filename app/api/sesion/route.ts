import { COOKIE_SESION, DURACION_SESION, tokenParaClave } from '@/lib/auth'
import { cookies } from 'next/headers'

/** Cambia la clave compartida por una cookie de sesion larga. */
export async function POST(req: Request) {
  const { clave } = (await req.json()) as { clave?: string }
  const token = clave ? tokenParaClave(clave) : null

  if (!token) return Response.json({ error: 'Clave incorrecta.' }, { status: 401 })

  cookies().set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACION_SESION,
  })

  return Response.json({ ok: true })
}

export async function DELETE() {
  cookies().delete(COOKIE_SESION)
  return Response.json({ ok: true })
}
