// @ts-ignore: sin tipos instalados
import compression from 'compression'

/**
 * Comprime con gzip las respuestas de texto (HTML, JSON, JS, CSS) de más de 1 KB.
 * Los datos de una encuesta pesan unos 850 KB sin comprimir y se envían a cada visitante.
 */
const compress = compression({ threshold: 1024 })

export default defineEventHandler((event) => {
  return new Promise<void>((resolve, reject) => {
    compress(event.node.req, event.node.res, (err: unknown) => (err ? reject(err) : resolve()))
  })
})
