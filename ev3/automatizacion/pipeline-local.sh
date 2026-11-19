#!/usr/bin/env bash
# Ejecuta localmente las mismas etapas y quality gates del pipeline
# .github/workflows/devsecops.yml, midiendo el tiempo de cada una.
# Requiere: Docker en ejecucion, Node 20+, Atlas levantado (docker compose up -d).
#
#   bash ev3/automatizacion/pipeline-local.sh
# Resultado: ev3/evidencias/pipeline/pipeline-tiempos.json y un log por etapa.
set -uo pipefail
cd "$(dirname "$0")/../.."
RAIZ="$PWD"
OUT="ev3/evidencias/pipeline"
mkdir -p "$OUT/zap"
export MSYS_NO_PATHCONV=1
if command -v cygpath >/dev/null; then WIN() { cygpath -w "$1"; }; else WIN() { echo "$1"; }; fi

declare -a NOMBRES TIEMPOS ESTADOS
etapa() {  # etapa "<nombre>" <comando...>
  local nombre="$1"; shift
  local log="$OUT/$(echo "$nombre" | tr ' /·' '___' | tr -s '_').log"
  printf "▶ %-45s" "$nombre"
  local t0=$(date +%s%3N)
  if "$@" >"$log" 2>&1; then estado="OK"; else estado="FALLA"; fi
  local ms=$(( $(date +%s%3N) - t0 ))
  printf "%-6s %7s s\n" "$estado" "$(awk -v m="$ms" 'BEGIN{printf "%.1f", m/1000}')"
  NOMBRES+=("$nombre"); TIEMPOS+=("$ms"); ESTADOS+=("$estado")
  if [ "$estado" = "FALLA" ]; then
    echo "  ✖ Gate bloqueante: pipeline detenido (Fail Fast). Ver $log"; resumen; exit 1
  fi
}
resumen() {
  { echo "["; for i in "${!NOMBRES[@]}"; do
      sep=$([ "$i" -lt $(( ${#NOMBRES[@]} - 1 )) ] && echo "," || echo "")
      echo "  {\"etapa\": \"${NOMBRES[$i]}\", \"ms\": ${TIEMPOS[$i]}, \"estado\": \"${ESTADOS[$i]}\"}$sep"
    done; echo "]"; } > "$OUT/pipeline-tiempos.json"
}

TOKEN() { curl -s -X POST localhost:4450/autenticacion/login -H 'Content-Type: application/json' \
  -d '{"nombre_usuario":"admin","password":"admin"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token'; }

echo "Pipeline DevSecOps Atlas (ejecucion local) - $(date '+%Y-%m-%d %H:%M')"
etapa "1 Secretos Gitleaks" docker run --rm -v "$(WIN "$RAIZ"):/repo" zricethezav/gitleaks:latest dir /repo \
  --no-banner --redact -c /repo/ev3/automatizacion/gitleaks-local.toml
etapa "2a Lint frontend ESLint" npm run lint --prefix FRONTEND
etapa "2b Unitarias Jest + cobertura 80" bash -c 'cd BACKEND && npx jest --ci --coverage --coverageThreshold="{\"global\":{\"lines\":80}}"'
etapa "3a SAST Semgrep (bloquea ERROR)" docker run --rm -v "$(WIN "$RAIZ"):/src" -w /src semgrep/semgrep semgrep scan \
  --config p/javascript --config p/nodejsscan --config p/expressjs --config p/secrets --severity ERROR --error --metrics=off BACKEND/src FRONTEND/src
etapa "3b SCA npm audit prod (bloquea High)" bash -c 'npm audit --prefix BACKEND --omit=dev --audit-level=high && npm audit --prefix FRONTEND --omit=dev --audit-level=high'
etapa "4a API funcional + seguridad" node --test --test-reporter=spec ev3/automatizacion/api/atlas-api.test.mjs
etapa "4b E2E Selenium" bash -c 'cd ev3/automatizacion/e2e && SHOTS_DIR=../../evidencias/pipeline/e2e node --test --test-reporter=spec atlas-e2e.test.mjs'
etapa "5a DAST ZAP baseline frontend" docker run --rm --network atlas-network -v "$(WIN "$RAIZ/$OUT/zap"):/zap/wrk:rw" \
  zaproxy/zap-stable zap-baseline.py -t http://atlas-frontend:80 -J zap-baseline-frontend.json -r zap-baseline-frontend.html -I
TK=$(TOKEN)
etapa "5b DAST ZAP API scan backend" docker run --rm --network atlas-network -v "$(WIN "$RAIZ/$OUT/zap"):/zap/wrk:rw" \
  zaproxy/zap-stable zap-api-scan.py -t http://atlas-backend:4000/openapi.json -f openapi -O http://atlas-backend:4000 \
  -J zap-api-backend.json -r zap-api-backend.html -I \
  -z "-config replacer.full_list(0).description=auth -config replacer.full_list(0).enabled=true -config replacer.full_list(0).matchtype=REQ_HEADER -config replacer.full_list(0).matchstr=Authorization -config replacer.full_list(0).regex=false -config replacer.full_list(0).replacement=Bearer\ $TK"
etapa "5c Gate ZAP (Alto/Medio no aceptado)" node ev3/automatizacion/zap/zap-gate.mjs "$OUT/zap/zap-baseline-frontend.json" "$OUT/zap/zap-api-backend.json"
etapa "6 Carga y estres k6" docker run --rm --network atlas-network -v "$(WIN "$RAIZ/ev3/automatizacion/carga"):/scripts" \
  grafana/k6 run --quiet /scripts/atlas-carga.k6.js
resumen
echo "✔ Pipeline completo. Tiempos en $OUT/pipeline-tiempos.json"
