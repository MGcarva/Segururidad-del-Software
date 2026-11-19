# Guía de estudio — "Informe de Seguridad y Calidad en el Desarrollo de Software: Auditoría Integral y Diagnóstico del Sistema Atlas"

Explicación lámina a lámina del PPT `Auditoría_de_Seguridad_y_Calidad_del_Sistema_Atlas.pptx`
(carpeta `ev2sguridad`), para que entiendas cada diapositiva antes de la defensa. El deck tiene 8
láminas y sigue casi exactamente los apartados que pide la pauta de EP4 (enfoque estratégico,
herramientas y justificación, ejecución, clasificación de defectos, reflexiones éticas/normativas,
conclusión).

---

## Lámina 1 — Portada

**Qué dice:** Título "Informe de Seguridad y Calidad en el Desarrollo de Software", subtítulo
"Auditoría Integral y Diagnóstico del Sistema Atlas". Tabla con asignatura, integrantes (Manuel
Carvajal, Martín Romero, Andrés Romero), docente (Cristian Medina) e institución (Duoc UC).

**Qué significa:** Es la carátula formal. No tiene contenido técnico que defender, pero fíjate que
el encuadre ya anticipa el tono de todo el deck: no es "aquí está el sistema", es **"auditoría"** —
o sea, el equipo se posiciona como evaluador externo del propio trabajo, no como el equipo que lo
construyó. Esa postura se repite explícitamente en la lámina 6.

---

## Lámina 2 — Enfoque Estratégico de las Pruebas

**Qué dice:** Un diagrama de círculos concéntricos (modelo de capas de riesgo) con tres niveles:
- **Riesgo Crítico** (centro, rojo): Autenticación, Control de Acceso, Datos Bancarios y Personales.
- **Riesgo Alto** (naranja): Validación de Entradas, Gestión de Documentos, Trazabilidad.
- **Riesgo Medio** (azul): Rendimiento, Usabilidad, Compatibilidad.

A la derecha, dos tarjetas: **Contexto del Negocio** (Atlas centraliza datos sensibles de pymes
chilenas) y **Enfoque Estratégico** (pruebas basadas en riesgo — *Risk-Based Testing* — priorizando
lo que causaría mayor daño reputacional y legal a CreaLab SpA).

Abajo, la frase de cierre: *"Una falla en validación no es solo un defecto de calidad; es la puerta
a una vulnerabilidad de seguridad y un potencial incumplimiento normativo."*

**Qué significa (para entenderlo, no solo repetirlo):**

- **Risk-Based Testing** es la idea de que no se puede (ni conviene) probar todo con la misma
  intensidad. Se invierte más esfuerzo donde el costo de una falla es más alto. Por eso el círculo
  central — autenticación y control de acceso — es lo más chico mirado en superficie, pero lo que
  concentra el mayor peso de las pruebas.
- Esto conecta directo con lo que ya ejecutamos en el libro `Casos_de_Prueba_Atlas_EV2.xlsx`: de
  los 85 casos, la mayor densidad de casos de prioridad **Alta** (65 de 85) está justamente en
  autenticación, control de acceso y datos sensibles — el mismo criterio que muestra este círculo.
- La frase de cierre es la idea más importante de la lámina: conecta **calidad** (un defecto de
  validación) con **seguridad** (una vulnerabilidad explotable) con **cumplimiento normativo**
  (una falla legal). Esa cadena — calidad → seguridad → ley — es el hilo conductor de todo el
  informe, y se repite en la lámina 7.
- "CreaLab SpA" es la empresa ficticia dueña de Atlas en el enunciado del caso semestral; las
  "pymes chilenas" son los clientes finales de Atlas (las empresas que se registran en el sistema).

**Si te preguntan en la defensa:** por qué priorizaron autenticación y datos bancarios sobre, por
ejemplo, usabilidad — la respuesta es exactamente el criterio de riesgo: una falla de usabilidad
molesta a un usuario; una falla de autenticación o de control de acceso puede filtrar datos de
terceros y generar responsabilidad legal bajo la Ley 21.719.

---

## Lámina 3 — Herramientas Seleccionadas y Justificación Técnica

**Qué dice:** Un pipeline de tres etapas ("Testing Ecosystem Pipeline"):

1. **Entorno y Código (Cimientos):** Docker (entorno de pruebas replicable) + SonarQube & ESLint
   (análisis estático / SAST, prevención temprana de bugs).
2. **Funcional e Integración (APIs y Datos):** Postman/Newman (validación de requerimientos y
   reglas de negocio vía API) + psql (inspección de integridad de datos en PostgreSQL).
3. **Seguridad y No Funcional (Estrés y UX):** OWASP ZAP (análisis dinámico / DAST, simulación de
   ataques web) + k6/JMeter (inyección de carga y concurrencia) + Lighthouse/axe (auditoría de
   accesibilidad y UX).

**Qué significa:**

- Esto es literalmente un mapa de **SAST vs. DAST vs. pruebas funcionales vs. pruebas no
  funcionales**, ordenado como un pipeline real de integración continua (de hecho dice
  "Testing Ecosystem Pipeline" porque así se vería en un pipeline CI/CD real: primero analizas el
  código sin ejecutarlo, después pruebas que funcione, después pruebas que resista carga y
  ataques).
- **SAST (SonarQube/ESLint)** = análisis **estático**: lee el código fuente sin ejecutarlo. Esto es
  justo lo que acabamos de ejecutar de verdad contra Atlas (ver `GUIA_SONARQUBE.md` y
  `Evidencia_SonarQube_Atlas.docx`): 10 bugs, 4 vulnerabilidades, 9 code smells, y el hallazgo
  crítico de la contraseña de PostgreSQL embebida en `db.js`.
- **DAST (OWASP ZAP)** = análisis **dinámico**: ataca la aplicación corriendo, sin ver el código
  fuente — simula lo que haría un atacante externo. Es complementario a SAST, no competencia: SAST
  encuentra el problema en el código (`db.js:6`), DAST encontraría el problema en cómo se comporta
  el sistema expuesto (por ejemplo, si ese secreto permite login no autorizado).
- `psql` para "inspección de integridad de datos" es justo lo que se usó para confirmar en la
  ejecución real que `PUT /empresa-usuarios/:id` y `PUT /clientes/:id` sobrescriben campos con NULL
  (los hallazgos CP-020/CP-026/CP-056).
- Nota: en la ejecución real que hicimos, **ZAP, k6 y JMeter no estaban instalados** en el entorno
  de prueba, así que se usaron sustitutos reales y declarados (un script Node/axios para carga en
  vez de k6; Lighthouse sí se usó real). Si te preguntan por qué la lámina dice "OWASP ZAP" pero la
  ejecución documentada usa otra cosa, la respuesta honesta es esa: ZAP es la herramienta
  recomendada y justificada técnicamente, pero no estaba disponible en el entorno de laboratorio de
  este ciclo, así que se sustituyó de forma declarada.

**Si te preguntan:** "¿por qué Docker está en la categoría de herramientas de seguridad?" —
porque un entorno replicable es un prerrequisito de **reproducibilidad** de pruebas: si no puedes
levantar el mismo entorno dos veces, no puedes confirmar que un hallazgo es real y no un artefacto
de tu máquina. No es una herramienta de ataque, es una herramienta de rigor metodológico.

---

## Lámina 4 — Ejecución de Pruebas Funcionales y de Integración

**Qué dice:** Un donut gigante con "100%" — "Cobertura de la ERS: Ni un solo requerimiento sin
evaluar." A la derecha, tres bloques encadenados: **Casos RF** (validación extremo a extremo
React→Express→PostgreSQL) → **Reglas de Negocio (RB)** (verificación de lógica crítica, ej.
aislamiento de datos entre empresas) → **Trazabilidad Completa** (conexión directa entre
requerimiento, caso de prueba y evidencia). Abajo: "Técnicas aplicadas: Partición de equivalencia,
valores límite y tablas de decisión."

**Qué significa:**

- El 100% de cobertura ERS es literal y verificable: el libro `Casos_de_Prueba_Atlas_EV2.xlsx`
  tiene una hoja **Trazabilidad** que mapea cada uno de los 47 elementos del ERS (17 RF + 20 NFR +
  5 RB + 5 de interfaces/arquitectura) y las 15 obligaciones normativas a al menos un caso de
  prueba. Si alguien pide "muéstrame dónde está probado el RF-3.2", esa hoja es la respuesta.
- "Aislamiento de datos entre empresas" como ejemplo de regla de negocio es clave: es justo el tipo
  de falla que encontramos real (CP-034): un usuario de una empresa podía crear/modificar contratos
  de clientes de **otra** empresa. Ese hallazgo es Crítico precisamente porque rompe esta regla de
  negocio que la lámina presenta como ejemplo central.
- Las tres técnicas mencionadas (partición de equivalencia, valores límite, tablas de decisión) son
  técnicas de **diseño de casos de prueba de caja negra** — no miran el código, diseñan casos a
  partir de los requerimientos. Por ejemplo: la política de contraseñas de 12 caracteres se probó
  con valores límite (11, 12 y 13 caracteres) para confirmar el borde exacto.

---

## Lámina 5 — Pruebas No Funcionales y de Seguridad

**Qué dice:** Tres columnas:
- **Seguridad (OWASP Top 10):** evaluación contra SQLi, XSS, CSRF e IDOR; verificación de TLS y
  cifrado bcrypt.
- **Rendimiento y Carga:** carga normal = 50 usuarios virtuales (<300ms p95); estrés máximo = 200
  usuarios concurrentes sin degradación mayor.
- **Usabilidad y Accesibilidad:** foco en el adulto mayor; umbral SUS ≥ 68; WCAG 2.1 AA.

**Qué significa:**

- Estos números (50 VU / 300ms, 200 usuarios, SUS ≥ 68) son exactamente los mismos supuestos
  (S-01, S-09) que definimos en la hoja Resumen del libro de pruebas EV2 — no son inventados para
  el PPT, vienen directo del diseño de pruebas.
- En la ejecución real, el rendimiento **no cumplió**: medimos p95 de 661ms a 3,7 segundos bajo
  carga (muy por sobre los 300ms), y un LCP móvil de ~7,7s contra un umbral de 2s. Esto es
  importante tenerlo presente: la lámina presenta el *criterio* de evaluación, no dice que se haya
  aprobado — si preguntan "¿y cumplió?", la respuesta honesta es que no, y ese es uno de los
  hallazgos Altos del informe.
- "Foco principal en el adulto mayor" no es un detalle menor: es un requisito de accesibilidad
  explícito del ERS de Atlas, y por eso un hallazgo aparentemente chico como "contraste insuficiente
  en el login" se trata como un hallazgo real de usabilidad y no solo estético — para un adulto
  mayor con baja visión, ese contraste es una barrera de acceso real.

---

## Lámina 6 — Clasificación y Criticidad de Incidentes

**Qué dice:** Una pirámide de 4 niveles (Crítico/Alto/Medio/Bajo) con la definición de cada uno:
- **Crítico:** impide el funcionamiento esencial o expone datos sensibles, remediación inmediata.
- **Alto:** afecta funcionalidades clave, degrada fuertemente seguridad o experiencia.
- **Medio:** fallos en flujos secundarios, existen workarounds.
- **Bajo:** defectos estéticos o menores sin impacto operativo.

A la derecha, una tarjeta: **"Mandato: Diagnóstico Sin Alteración"** — actuamos estrictamente como
auditores independientes: diagnosticamos vulnerabilidades, clasificamos incidentes y damos
recomendaciones estratégicas, **sin alterar una sola línea del código fuente**.

**Qué significa:**

- Esta escala de severidad (Crítico/Alto/Medio/Bajo) es exactamente la que se usó para los 48
  incidentes registrados en la hoja Incidentes del Excel EV2 (4 Crítica / 21 Alta / 18 Media / 5
  Baja a la fecha). Si te preguntan un ejemplo de cada nivel, puedes usar los reales: Crítico = la
  contraseña embebida en `db.js` (INC-048) o el bug de integridad que permite modificar contratos
  de otra empresa (CP-034); Alto = ausencia de límite de intentos de login; Medio = canal de tiempo
  que permite enumerar usuarios; Bajo = mensajes de validación poco claros.
- El "Mandato: Diagnóstico Sin Alteración" es la restricción más importante de todo este ciclo de
  evaluación (EV2): está escrita también, casi palabra por palabra, en la hoja Resumen del Excel de
  pruebas ("No se corrige el código fuente"). Es clave entenderla bien porque explica por qué,
  aunque encontramos 4 hallazgos Críticos, el equipo no los corrigió en este ciclo — y eso **no es
  un error**, es el alcance definido de la evaluación. La corrección queda como trabajo pendiente
  documentado, no como algo que se "olvidó" hacer.

---

## Lámina 7 — Reflexiones sobre Calidad, Seguridad y Cumplimiento

**Qué dice:** Dos columnas conectadas por líneas: **Estándares Técnicos** (ISO/IEC 25010 para
mantenibilidad/confiabilidad; ISO/IEC 27001 & OWASP para controles de acceso y criptografía) frente
a **Marco Legal Chileno** (Ley 19.628 y Ley 21.719 — protección de datos personales y bancarios;
Ley 21.663 — Ley Marco de Ciberseguridad, exige trazabilidad inmutable y auditoría). Frase de
cierre: *"La calidad del código es la primera línea de defensa legal para CreaLab SpA y las pymes
usuarias."*

**Qué significa:**

- Esta lámina responde directamente al apartado "Análisis ético y normativo de los resultados" que
  pide la pauta de EP3/EP4 — es el mismo tipo de contenido que desarrollamos en el documento
  `Punto7_Analisis_Etico_Normativo_Atlas.docx`, solo que resumido en formato visual.
- La idea central: un estándar técnico (ISO 27001, por ejemplo) no es solo "buena práctica", es la
  forma concreta de cumplir una obligación legal (Ley 21.719). Si el código no implementa control
  de acceso correcto (estándar técnico), la empresa incumple la ley de protección de datos (marco
  legal) — por eso las líneas conectan una columna con la otra.
- La Ley 21.663 (Ley Marco de Ciberseguridad) es la más reciente y la menos conocida de las tres —
  exige específicamente **trazabilidad inmutable y auditoría**, que es justo lo que se evaluó en el
  módulo "Auditoría" del libro de pruebas (CP-044 a CP-046, CP-081, CP-084): si alguien borra o
  falsifica un registro de auditoría, se incumple esta ley directamente, no solo una buena práctica.

---

## Lámina 8 — Conclusión y Receta de Remediación

**Qué dice:** **Diagnóstico Final:** "ESTADO: REQUIERE REMEDIACIÓN PREVIA" — se detectaron
incidentes críticos en validación de entradas y control de acceso; el sistema soporta la carga
esperada pero los vacíos de seguridad impiden garantizar la protección de datos exigida por la
normativa. **Recomendaciones para Producción** (numeradas): 1) remediación inmediata de incidentes
Críticos y Altos (foco en control de acceso y saneamiento de entradas); 2) integrar SonarQube en el
pipeline CI/CD; 3) auditoría legal final de cumplimiento frente a la Ley 21.719 antes del despliegue
comercial.

**Qué significa:**

- Es el cierre lógico de todo el diagnóstico: no dice "el sistema está roto", dice algo más preciso
  y defendible — "no está listo para producción **todavía**", con una ruta concreta de 3 pasos para
  llegar a estarlo. Esa es la diferencia entre una auditoría útil y una lista de quejas.
- El punto 2 (integrar SonarQube al CI/CD) es literalmente lo que acabamos de hacer manualmente en
  esta sesión (correr SonarQube una vez, a mano) — la recomendación de la lámina es automatizarlo
  para que corra en cada cambio de código, no solo una vez antes de la entrega.
- El punto 3 (auditoría legal) reconoce honestamente un límite del propio equipo: ellos (nosotros)
  evaluamos la calidad y seguridad **técnica**, pero el cumplimiento legal definitivo de la Ley
  21.719 lo debe confirmar una auditoría legal formal, no un informe técnico de estudiantes de
  software. Es una admisión de alcance, no una debilidad del informe.

---

## Resumen para memorizar en una frase por lámina

1. Portada — quiénes somos y qué evaluamos.
2. Pruebas priorizadas por riesgo: lo crítico (auth/datos) primero.
3. Pipeline de herramientas: SAST → funcional/datos → DAST/carga/UX.
4. 100% del ERS cubierto, con trazabilidad completa requerimiento↔caso↔evidencia.
5. Seguridad OWASP + rendimiento (50/200 usuarios) + accesibilidad centrada en adulto mayor.
6. Incidentes clasificados en 4 niveles; auditamos sin tocar el código.
7. Un estándar técnico incumplido es una ley incumplida.
8. No apto para producción todavía; 3 pasos concretos para llegar a estarlo.
