# Flujo de trabajo de la revisión metodológica

Separa el desarrollo metodológico de la publicación del sitio. El release 2.1.2 publicado no se toca.

```
main                       producción (Vercel activo). Protegida: solo PR con CI. Merge final solo con autorización expresa.
└─ methodology-integration rama de integración de toda la revisión. Vercel desactivado. CI activo en sus PR.
   ├─ methodology-fase0    scripts de auditoría, sensibilidad, migración 009 y protocolos
   └─ methodology-<tema>   una rama por issue o grupo de issues (p. ej. methodology-benchmark)
```

## Reglas
- Todas las ramas de trabajo parten de `methodology-integration` y sus PR tienen como destino **esa** rama, nunca `main`.
- El nombre debe empezar por `methodology-`: es lo que activa la exclusión de Vercel.
- Un PR hacia `methodology-integration` no cierra el issue: usar `Refs #N`, no `Closes #N`. Un issue se cierra cuando se cumplen **todos** sus criterios de aceptación y con confirmación.
- El PR final `methodology-integration` → `main` requiere autorización expresa y una revisión completa del conjunto.
- Los resultados, informes y juicios por ítem viven en `docs/methodology/local/` (ignorado con `.git/info/exclude`) y no se versionan.
- La migración 009 y las posteriores se aplican solo en BD local (desarrollo o pruebas), con backup previo. No hay migraciones contra Neon ni producción sin autorización.

## Vercel
`vercel.json` incluye:
```json
"git": { "deploymentEnabled": { "methodology-*": false } }
```
- Vercel evalúa los patrones con minimatch: `*` no cruza `/`, así que `methodology-*` cubre `methodology-fase0` y no `methodology/fase0`. Usar siempre guion, sin barras.
- Si una rama coincide con varias reglas y alguna es `true`, se despliega: no añadir reglas que solapen con `methodology-*`.
- `main` y el resto de ramas conservan su comportamiento. No se desconecta Vercel de GitHub ni se desactiva globalmente.
- La configuración debe existir en la rama **antes** de su primer push. Cualquier rama de trabajo nueva debe salir de `methodology-integration` para heredarla.
- Comprobación tras un push nuevo: `vercel ls` no debe mostrar un despliegue para el commit y `gh api repos/<repo>/commits/<sha>/status` no debe incluir el contexto `Vercel`.

## CI y protecciones
- `.github/workflows/ci.yml` se ejecuta en `pull_request` sin filtro de rama destino: los PR hacia `methodology-integration` ejecutan `test` y `secretos`.
- Las protecciones de `main` exigen `test` y `secretos`, no Vercel: ningún merge depende de un despliegue.
- `methodology-integration` no tiene reglas de protección propias; ver la decisión pendiente sobre protegerla.
