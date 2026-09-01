'use client'

import { useEffect } from 'react'

/** Registra el service worker que hace que la app sirva sin senal. */
export function RegistrarSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app sigue funcionando, solo pierde el modo offline.
    })
  }, [])
  return null
}
