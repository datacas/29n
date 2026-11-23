// Vibración muy breve al elegir una respuesta. Solo en móviles que la admiten (Android: Chrome y Firefox, iOS no la ofrece).
// No vibra si la persona pidió menos movimiento. Nunca lanza error: es un detalle, no una función.
export function useHaptic() {
  return function tap(ms = 8) {
    try {
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      navigator.vibrate(ms)
    } catch { /* sin vibración */ }
  }
}
