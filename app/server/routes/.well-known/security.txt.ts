// El build no copia la carpeta oculta app/public/.well-known: se sirve desde aquí
export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return [
    'Contact: https://github.com/datacas/29n/security/advisories/new',
    'Expires: 2027-06-30T00:00:00.000Z',
    'Preferred-Languages: es, en',
    'Canonical: https://www.voto29n.com/.well-known/security.txt',
    ''
  ].join('\n')
})
