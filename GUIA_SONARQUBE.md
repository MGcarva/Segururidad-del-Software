# Guía paso a paso: análisis estático de Atlas con SonarQube

Este documento explica, en el mismo orden en que se hizo, cómo se levantó SonarQube y se analizó
el código del proyecto Atlas (BACKEND + FRONTEND), siguiendo el procedimiento de la guía del curso
**"2.3.1 Obtención de evidencias y registro de resultados"**. Sirve para que puedas repetir el
proceso tú mismo y entender cada paso.

Requisitos previos: Docker Desktop corriendo, y estar parado en la carpeta raíz del proyecto
(`CodigoFuenteA/CodigoFuenteA`, la que contiene `BACKEND/` y `FRONTEND/`).

---

## 1. Levantar el servidor de SonarQube

```bash
docker run -d --name sonarqube -p 9000:9000 -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true sonarqube:community
```

- `-p 9000:9000`: expone la interfaz web en `http://localhost:9000`.
- `SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true`: evita que Elasticsearch (que usa SonarQube por dentro)
  falle por los chequeos de memoria virtual de Linux que Docker Desktop en Windows a veces no cumple.

El primer arranque tarda 1-2 minutos porque SonarQube inicializa su base de datos interna. Para
saber cuándo está listo:

```bash
curl -s http://localhost:9000/api/system/status
```

Vas a ver `"status":"STARTING"` varias veces hasta que cambie a `"status":"UP"`. Ahí ya puedes
entrar a `http://localhost:9000` en el navegador.

---

## 2. Primer login y cambio de contraseña

Usuario y contraseña por defecto: `admin` / `admin`. SonarQube obliga a cambiarla la primera vez.
Se puede hacer desde la UI (te lo pide solo) o por API:

```bash
curl -s -u "admin:$SONAR_ADMIN_PASS" -X POST "http://localhost:9000/api/users/change_password" \
  -d "login=admin&previousPassword=admin&password=TU_CLAVE_NUEVA"
```

En esta sesión se usó `Atlas#Sonar2026!qa` como clave nueva.

---

## 3. Generar un token de análisis

El scanner no usa la contraseña directamente, usa un token:

```bash
curl -s -u "admin:$SONAR_ADMIN_PASS" -X POST "http://localhost:9000/api/user_tokens/generate" \
  -d "name=atlas-scan-token"
```

La respuesta trae un `token` que empieza con `squ_...`. Guárdalo, lo vas a necesitar en el paso 5.
(Por seguridad, genera uno nuevo para ti en vez de reutilizar uno ya creado por otra persona.)

---

## 4. Crear el proyecto en SonarQube

```bash
TOKEN="squ_tu_token_aqui"
curl -s -u $TOKEN: -X POST "http://localhost:9000/api/projects/create" \
  -d "project=atlas-sistema-gestion&name=Sistema de Gestion Atlas"
```

(También se puede crear desde la UI con el botón "Create Project" → "Manually".)

---

## 5. Ejecutar el análisis (sonar-scanner)

Este es el paso que realmente lee tu código y lo manda a SonarQube. Se usa la imagen oficial del
scanner en Docker, para no tener que instalar nada en tu máquina.

**Importante (Windows/Git Bash):** si montas el volumen con `-v "$(pwd):/usr/src"`, Docker Desktop
a veces no traduce bien la ruta y el scanner no encuentra tus carpetas. Usa la ruta de Windows
completa en su lugar:

```bash
docker run --rm \
  -e SONAR_HOST_URL="http://host.docker.internal:9000" \
  -e SONAR_TOKEN="squ_tu_token_aqui" \
  -v "C:\ruta\completa\a\CodigoFuenteA\CodigoFuenteA:/usr/src" \
  sonarsource/sonar-scanner-cli \
  -Dsonar.projectKey=atlas-sistema-gestion \
  -Dsonar.projectName="Sistema de Gestion Atlas" \
  -Dsonar.sources=BACKEND/src,FRONTEND/src \
  -Dsonar.exclusions="**/node_modules/**,**/dist/**,**/build/**" \
  -Dsonar.sourceEncoding=UTF-8
```

- `host.docker.internal` es como el contenedor del scanner le habla al contenedor de SonarQube
  (ambos corren en Docker Desktop en la misma máquina).
- `sonar.sources` apunta solo al código fuente real (`src`), no a `node_modules` ni carpetas
  compiladas — si no, el análisis tarda mucho más y mide código que no es tuyo.

Si todo sale bien, termina con una línea como:

```
INFO  ANALYSIS SUCCESSFUL, you can find the results at: http://host.docker.internal:9000/dashboard?id=atlas-sistema-gestion
```

El análisis se sube como una tarea en segundo plano. Para confirmar que SonarQube ya terminó de
procesarlo (el link de "More about the report processing" de la salida anterior te da el `id`):

```bash
curl -s -u $TOKEN: "http://localhost:9000/api/ce/task?id=EL_ID_DE_LA_TAREA"
```

Cuando el campo `"status"` diga `"SUCCESS"`, los resultados ya están listos para ver.

---

## 6. Ver los resultados en la interfaz web

Entra a `http://localhost:9000/dashboard?id=atlas-sistema-gestion` (con tu usuario `admin`).

- **Overview**: resumen con Security / Reliability / Maintainability (cada uno con una nota de A a
  E), % de duplicación y si pasó el Quality Gate.
- **Issues** (menú izquierdo): la lista completa de hallazgos. Se puede filtrar por **Type**
  (Bug / Vulnerability / Code Smell) y por **Severity** (Blocker, Critical, Major, Minor, Info).
  Cada hallazgo muestra el archivo, la línea exacta, el mensaje y la regla que lo detectó.

También se puede consultar todo por API, sin entrar al navegador (es lo que se usó para generar
el reporte formal):

```bash
curl -s -u $TOKEN: "http://localhost:9000/api/measures/component?component=atlas-sistema-gestion&metricKeys=bugs,vulnerabilities,code_smells,security_rating,reliability_rating,duplicated_lines_density,ncloc"
curl -s -u $TOKEN: "http://localhost:9000/api/issues/search?componentKeys=atlas-sistema-gestion&ps=100"
```

SonarQube Community **no tiene botón de "descargar PDF"** (esa función es de las ediciones de
pago). Por eso la evidencia "exportada" es: estos JSON de la API + capturas de pantalla reales del
navegador.

---

## 7. Registrar la evidencia (lo que pide la guía del curso)

Por cada hallazgo que importa, se documentó:

1. **Dónde está**: archivo y línea exacta (SonarQube te lo da directo).
2. **Severidad**: Blocker / Critical / Major / Minor.
3. **Categoría**: a qué norma u OWASP/CWE corresponde (si la regla no lo indica, se busca el CWE
   asociado a la regla en la pestaña "Why is this an issue?" de cada hallazgo).
4. **Acción correctiva propuesta**: qué habría que cambiar para solucionarlo (sin aplicarlo, porque
   esta evaluación prohíbe modificar código fuente).
5. **Responsable**: quién queda a cargo de esa corrección en el backlog del equipo.

Esto se volcó en la hoja **Incidentes** del archivo `Casos_de_Prueba_Atlas_EV2.xlsx` (columna por
columna: ID incidente, Caso, Severidad, Pasos para reproducir, Evidencia, CWE/OWASP, Responsable,
Acción correctiva).

---

## 8. Apagar SonarQube cuando termines

El contenedor queda corriendo y consumiendo memoria hasta que lo detengas:

```bash
docker stop sonarqube
```

Para volver a levantarlo más tarde (sin perder el análisis ya hecho, porque los datos quedan en el
contenedor):

```bash
docker start sonarqube
```

Si en cambio quieres borrarlo por completo y partir de cero la próxima vez:

```bash
docker rm -f sonarqube
```

---

## Resumen de lo que se obtuvo en esta corrida

| Métrica | Valor |
|---|---|
| Bugs | 10 |
| Vulnerabilidades | 4 |
| Code Smells | 9 |
| Security Rating | E |
| Reliability Rating | C |
| Duplicación | 15,5% |

El hallazgo más grave: una contraseña de PostgreSQL embebida como valor de respaldo en
`BACKEND/src/db.js` línea 6 (regla `secrets:S6698`, severidad Blocker) — un secreto comiteado al
código fuente.
