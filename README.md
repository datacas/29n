# 29N

Herramienta de afinidad electoral para las elecciones generales del 29 de noviembre de 2026. La persona contesta preguntas y ve con qué
programa coincide más. **Cada porcentaje se apoya en una cita literal del programa, con su página.** No recomienda voto.

- Web pública: _(pendiente de dominio)_
- Cómo funciona, de dónde salen los datos y límites: [`/metodologia`](app/pages/metodologia.vue)
- Guía con la que se asigna la intensidad (±1 o ±2) de cada posición: [`docs/guia-intensidad.md`](docs/guia-intensidad.md)
- Informe de neutralidad: [`docs/neutrality-review-2026-11-23.md`](docs/neutrality-review-2026-11-23.md)

## Qué hay en este repositorio

| Carpeta | Contenido |
|---|---|
| `app/` | La web (Nuxt 3): encuesta, resultados, programas y metodología |
| `app/public/data/` | La encuesta publicada, en ficheros estáticos, con su manifiesto y su huella SHA-256 |
| `app/public/programas/` | Los 19 programas electorales. Los que pesaban más de 3 MB se han aligerado (imágenes reducidas) con el mismo texto y las mismas páginas |
| `docs/` | Decisiones de revisión editorial, taxonomía de temas, guías e informes |
| `scripts/` | Construcción de versiones, exportación de datos y análisis |
| `db/` | Esquema de la base de datos de trabajo (local) y de estadísticas (Neon) |

## Comprobar que los datos no se han manipulado

Cada versión publicada es **inmutable** y lleva la huella SHA-256 de su manifiesto completo.

```bash
npm ci
npm run data:verify
```

El script recalcula la huella, comprueba que lo que usa la encuesta coincide con el manifiesto y que cada partido tiene su programa.
Cada cita de los resultados enlaza con la página exacta del PDF original en `app/public/programas/`.

## Desarrollo

```bash
npm ci
npm run dev            # panel de administración y base de datos locales (ver docker-compose.yml)
npx vitest run         # pruebas
npm run build:public   # build que se despliega: sin panel de administración y sin base de datos de trabajo
```

El trabajo editorial (revisar posiciones, construir y publicar versiones) se hace en local con PostgreSQL.
Al publicar una versión se exporta a ficheros estáticos con `npm run data:export` y se sube con un pull request.

## Despliegue (Vercel + Neon)

1. **Neon**: crear una base y ejecutar `db/neon/001_usage_events.sql` y `db/neon/002_contribution_tallies.sql` en su consola SQL. Copiar la cadena de conexión **agrupada (pooled)**.
2. **Vercel**: importar este repositorio. Variables de entorno (Production y Preview):
   - `NUXT_DATABASE_URL`: la cadena pooled de Neon.
   - `NUXT_STATS_RELEASE_IDS`: el `release_id` publicado (lo imprime `npm run data:export`).
   - `NUXT_PUBLIC_KOFI_URL` (opcional): enlace de «Invítame a un café». Por defecto `https://ko-fi.com/datacas`; vacío lo oculta.
3. Cada pull request genera una vista previa. La rama principal está protegida: solo se entra por pull request con la CI en verde.

## Cambios

Todo cambio entra por pull request. **Una versión publicada no se edita**: si cambia una posición o una pregunta, se publica una versión nueva.

## Licencia

- **Código**: [MIT](LICENSE).
- **Datos y documentos** (preguntas, posiciones, guías e informes): [CC BY 4.0](LICENSE-DATA.md). Úsalos como quieras, también para cobrar, **citando el original**.
- **Programas electorales**: son de cada partido y quedan fuera de estas licencias.
