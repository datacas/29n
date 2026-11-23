#!/usr/bin/env bash
# Protege la rama principal: nadie puede hacer push directo (ni los administradores), solo se entra por pull request
# con las comprobaciones de CI en verde. Se ejecuta UNA vez, con el repositorio ya creado y la rama principal subida.
#
#   scripts/github/protect_branch.sh datacas/29n [main] [aprobaciones]
#
# aprobaciones: número de revisiones exigidas (por defecto 0: basta con abrir un PR y que pase la CI; si trabaja más
# de una persona, ponga 1). Con 1 aprobación, quien abre el PR no puede aprobárselo a sí mismo.
set -euo pipefail
REPO="${1:?uso: $0 <propietario/repositorio> [rama] [aprobaciones]}"
BRANCH="${2:-main}"
APPROVALS="${3:-0}"
gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" --input - <<JSON
{
  "required_status_checks": { "strict": true, "contexts": ["test", "secretos"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": ${APPROVALS},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
echo "Rama ${BRANCH} de ${REPO} protegida: solo pull requests, con CI en verde, sin push directo ni force-push."
