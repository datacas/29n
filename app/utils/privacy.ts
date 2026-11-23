/**
 * ¿Ha pedido el navegador que no se le rastree? «No rastrear» (en sus tres variantes) o el control global de privacidad.
 * La usan las visitas, el registro de uso y la aportación anónima a las estadísticas.
 */
export function privacyOptOut(): boolean {
  if (typeof navigator === 'undefined') return true
  const nav = navigator as any
  const dnt = nav.doNotTrack === '1' || (globalThis as any).doNotTrack === '1' || nav.msDoNotTrack === '1'
  return dnt || nav.globalPrivacyControl === true
}
