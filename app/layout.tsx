import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RegistrarSW } from '@/components/registrar-sw'

export const metadata: Metadata = {
  title: 'Mi lista — precios de abastos',
  description: 'Precios del dia, lista de WhatsApp y historico.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Mi lista' },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  // Que el contenido pueda llegar debajo de la barra de gestos.
  viewportFit: 'cover',
  // Sin esto, tocar un input hace zoom en Android y descuadra la pantalla.
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  )
}
