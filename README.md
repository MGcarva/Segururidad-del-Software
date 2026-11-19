# Sistema de Gestión Atlas · Seguridad y Calidad del Software (ISY1102)

[![DevSecOps Atlas](https://github.com/MGcarva/Segururidad-del-Software/actions/workflows/devsecops.yml/badge.svg)](https://github.com/MGcarva/Segururidad-del-Software/actions/workflows/devsecops.yml)

Caso semestral A de la asignatura ISY1102 (Duoc UC): Atlas es una plataforma web (React + Express +
PostgreSQL) de CreaLab SpA para que pymes chilenas gestionen clientes, contratos y documentos, con roles,
auditoría y cumplimiento de la normativa de protección de datos.

**Equipo:** Martín Romero Serrano · Andrés Romero Madrid · Manuel Gonzalo Carvajal · **Docente:** Cristian Medina

Este repositorio contiene el código del sistema y el trabajo de las tres iteraciones del caso. La
**Evaluación Parcial 5 (iteración 3, 11%)** es un encargo grupal con defensa individual de 10 minutos más
5 de preguntas.

---

## Estado de la Evaluación 3

### ✅ Lo que tenemos

| Requisito del encargo (EP5) | Dónde está | Estado |
|---|---|---|
| Ejecutar y documentar pruebas de seguridad | `ev3/evidencias/` (ZAP, Semgrep, SonarQube, npm audit, Gitleaks) | ✅ Ejecutadas antes y después |
| Identificar vulnerabilidades | Informe §4: 17 hallazgos (2 críticos, 10 altos, 5 medios) y 2 falsos positivos verificados | ✅ |
| Opciones de mitigación | Informe §5 y código corregido en `BACKEND/` y `FRONTEND/nginx.conf` | ✅ Implementadas y verificadas |
| Automatización de pruebas funcionales y normativas | `ev3/automatizacion/` (API, E2E Selenium, Selenium IDE, k6, ZAP) + `BACKEND/tests/` | ✅ |
| Diagramas con controles de seguridad automatizados | `ev3/informe/graficos/D1..D3` y `.github/workflows/devsecops.yml` | ✅ |
| Plan de mantenimiento (calidad, seguridad y normativa) | Informe §8 y §9 | ✅ |
| Informe Word/PDF con formato (Arial 12/11, interlineado 1,5, justificado) | `ev3/informe/Informe_Semestral_Iteracion3_Atlas_EP5.docx` / `.pdf` | ⚠️ Faltan datos (ver abajo) |
| Presentación para la defensa | Deck en claude.ai, con guion en las notas del orador (ver «Lo que falta») | ⚠️ Falta compartir y exportar |
| Guía de defensa (reparto y preguntas probables) | `ev3/GUION_DEFENSA_EV3.md` | ✅ |

### Resultados principales (medidos el 17-11-2026)

| Indicador | Código original | Después de la iteración 3 |
|---|---|---|
| Suite API de seguridad y funcional | 13 de 26 aprobadas | **27 de 27** aprobadas |
| OWASP ZAP: alertas Altas y Medias | 6 | 2 (riesgos aceptados y documentados) |
| SonarQube: vulnerabilidades / Security Rating | 4 / E | 1 / B |
| npm audit, dependencias de producción del backend | 7 (1 crítica) | 0 |
| Gitleaks: secretos en archivos versionables | 5 | 0 |
| Pruebas unitarias Jest / cobertura de módulos de seguridad | 8 / no medida | 29 / 89,9% |
| Ciclo de regresión de seguridad | ≈ 318 min manual (estimado) | ≈ 2,2 min automatizado (medido) |

### ⏳ Lo que falta para la evaluación

**Obligatorio antes de entregar:**
- [ ] **Informe:** completar *Carrera* y *Sección* en la portada (resaltados en amarillo).
- [ ] **Informe:** pegar el feedback textual del docente de las evaluaciones anteriores en la tabla de la
      sección 2 (resaltado en amarillo). Luego regenerar el PDF (Word → Guardar como PDF).
- [ ] **Presentación:** compartirla con el equipo desde el menú *Compartir* (hoy es privada), revisar cada
      lámina en pantalla completa (no se pudo previsualizar renderizada) y descargarla como .pptx para AVA.
- [ ] **GitHub Actions:** confirmar que el workflow `DevSecOps Atlas` termine en verde y sacar una captura
      para la defensa (evidencia ejecutada, 24% de la rúbrica). Si falla, revisar el log del job.
- [ ] **Subir a AVA:** informe (Word o PDF) + presentación + material de apoyo.
- [ ] **Ensayar la defensa:** la nota es individual, así que cada integrante debe poder explicar cualquier
      lámina (`ev3/GUION_DEFENSA_EV3.md`).

**Configuración opcional del repositorio** (suma a la demostración del pipeline):
- [ ] *Settings → Environments*: crear `staging` con un revisor obligatorio (etapa 7, aprobación manual).
- [ ] *Settings → Secrets*: `SONAR_TOKEN` y `SONAR_HOST_URL` (por ejemplo SonarCloud) para activar el
      quality gate de SonarQube en CI. Sin ellos ese paso se omite.

**Pendientes técnicos declarados en el plan de mantenimiento** (no bloquean la nota; se presentan como trabajo futuro):
- [ ] Paginación en `GET /clientes` (H-18: con 13 mil clientes la p95 sube a 15 s).
- [ ] Accesibilidad automatizada con axe-core en la suite E2E (adultos mayores, WCAG 2.1 AA).
- [ ] Limitador de login y revocación de JWT en Redis antes de escalar a varias réplicas.
- [ ] Actualizar vite 6 → 7 y tailwind 3 → 4 (11 CVE solo de build); CSP con nonces; fuentes locales (SRI).
- [ ] Corregir 24 promesas sin `await` (SonarQube S9383).
- [ ] Forzar el cambio de contraseña de las cuentas semilla (`admin/admin`, `editor/editor`).
- [ ] Repetir la prueba de estrés en un runner dedicado: la línea base tiene una sola corrida.

---

## Estructura del repositorio

```
├─ BACKEND/                  API Express (código corregido en la iteración 3) + tests Jest
├─ FRONTEND/                 React + nginx (cabeceras de seguridad nuevas)
├─ .github/
│  ├─ workflows/devsecops.yml   Pipeline CI/CD DevSecOps de 7 etapas
│  └─ dependabot.yml            Actualización semanal de dependencias
├─ ev3/                      Evaluación 3
│  ├─ antes/                    Copia del código original (línea base)
│  ├─ automatizacion/           api/ · e2e/ (Selenium + POM) · selenium-ide/ · carga/ (k6) · zap/ (gate)
│  │                            pipeline-local.sh (mismas etapas que el workflow)
│  ├─ evidencias/               antes/ · despues/ · pipeline/ (logs, JSON, HTML, capturas)
│  ├─ informe/                  Informe EP5 (.docx/.pdf), gráficos, diagramas y sus scripts
│  └─ GUION_DEFENSA_EV3.md
├─ documentos/               Entregables de las iteraciones 1 y 2
├─ ev2sguridad/              Material del curso y presentación EV2
├─ .env.example              Plantilla de variables (el .env real no se versiona)
└─ docker-compose.yml
```

## Pipeline DevSecOps

| Etapa | Herramientas | Gate (bloquea si…) | Criterio normativo |
|---|---|---|---|
| 1 Fuente | Gitleaks (historial git) | hay secretos | Ley 21.663 · ISO 27001 A.8.24 |
| 2 Build | npm ci, ESLint, Jest | un test falla o la cobertura es < 80% | ISO/IEC 25010 |
| 3 SAST/SCA | Semgrep, SonarQube, npm audit | hay un ERROR o una CVE High/Critical en producción | OWASP Top 10 · ISO 27001 A.8.28 |
| 4 Integración | Docker Compose, 27 casos API, 5 E2E Selenium | hay fuga entre empresas (IDOR) o un caso falla | Ley 21.719 |
| 5 DAST | OWASP ZAP baseline + API scan + gate | hay una alerta Alta o una Media no aceptada | OWASP ASVS · Ley 21.663 |
| 6 No funcional | k6 (main y nocturno) | p95 > 300 ms o errores > 1% | NFR-PERF-1 |
| 7 Despliegue | Environment `staging` | falta la aprobación de un revisor | Trazabilidad |

## Cómo ejecutar

### 1. Configurar y levantar

```bash
cp .env.example .env
# Generar el secreto JWT y pegarlo en JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
docker compose up -d --build
```

- Frontend: `http://localhost:3350` · Backend: `http://localhost:4450` · PostgreSQL: `localhost:15432`, base `atlas`, usuario y contraseña `postgres`
- Cuentas semilla: `admin/admin` (administrador) y `editor/editor` (editor)
- El backend **no arranca** si falta `JWT_SECRET` (mínimo 32 caracteres) o `DATABASE_URL`. Es intencional (fail-safe).

### 2. Pruebas

```bash
node --test --test-reporter=spec ev3/automatizacion/api/atlas-api.test.mjs   # 27 casos API (~2 s)
cd BACKEND && npx jest --coverage                                           # 29 unitarias
cd ev3/automatizacion/e2e && npm ci && npm test                             # 5 E2E (Chrome headless)
bash ev3/automatizacion/pipeline-local.sh                                   # pipeline completo en local
```

Selenium IDE: abrir `ev3/automatizacion/selenium-ide/atlas-login.side` en la extensión del navegador.

### 3. Regenerar informe y gráficos

```bash
python ev3/informe/graficos.py && python ev3/informe/diagramas.py && python ev3/informe/build_informe.py
```
