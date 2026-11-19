# Guía de defensa · EP5 (Iteración 3)

Defensa de 10 minutos + 5 de preguntas. **La nota es individual**: cada integrante debe poder explicar
cualquier lámina, no solo la suya. El guion completo de cada lámina está en las notas del orador de la
presentación.

## Reparto sugerido (~3 min por persona)

| Bloque | Láminas | Criterio de la rúbrica | Peso |
|---|---|---|---|
| Integrante 1 | 1 Portada · 2 Resumen · 3 Enfoques · 4 Herramientas · 5 Hallazgos | Enfoques y herramientas de seguridad | 30% |
| Integrante 2 | 6 Evidencia ZAP · 7 Pipeline · 8 Arquitectura · 9 Automatización · 10 Antes/después | Diagramas (14%) + evidencias ejecutadas (24%) | 38% |
| Integrante 3 | 11 Eficiencia · 12 Rendimiento · 13 Mantenimiento · 14 Normativa · 15 Cierre | Plan de mantenimiento (20%) + recursos visuales (12%) | 32% |

## Cifras que hay que saber de memoria

- 17 hallazgos confirmados: 2 críticos, 10 altos, 5 medios. Los 2 críticos son IDOR (OWASP A01).
- Suite API: 13 de 26 aprobadas antes → 27 de 27 después (se agregó SEC-21, de la bitácora).
- SonarQube: 4 → 1 vulnerabilidades, Security Rating E → B.
- npm audit, producción del backend: 7 → 0. Frontend: 22 → 11, todas de build y 0 en producción.
- Jest: 29 pruebas, 89,9% de cobertura en los módulos de seguridad.
- Ciclo de regresión: 318 min manual (**estimado**) → 2,2 min automatizado (**medido**).
- k6: 0% de errores con 200 usuarios; con 13 mil clientes la p95 sube a 15 s (falta paginación).

## Preguntas probables y respuesta corta

**¿Diferencia entre SAST y DAST?** SAST (Semgrep, SonarQube) lee el código sin ejecutarlo; DAST (ZAP)
ataca la aplicación corriendo sin ver el código. Se complementan.

**¿Por qué ZAP no encontró los IDOR?** Porque no conoce la regla de negocio «una empresa no ve datos de
otra». Por eso escribimos pruebas de negocio en caja gris con dos empresas de prueba.

**¿Qué es un falso positivo y tuvieron alguno?** Una alerta que no es explotable. ZAP reportó dos SQL
Injection: verificamos con curl que las consultas están parametrizadas y que la respuesta no cambia.

**¿Por qué ahora sí modificaron el código si en EV2 no?** EV2 tenía el mandato de diagnosticar sin
alterar. EP5 pide mitigar y preservar la calidad. Guardamos el código original en `ev3/antes` para
demostrar el antes y el después.

**¿Qué pasa si alguien reintroduce un IDOR?** La prueba SEC-1x falla en la etapa 4 y el pipeline bloquea
el merge (Fail Fast).

**¿El rendimiento empeoró con las mitigaciones?** En carga, los rangos se superponen (225–289 ms frente a
292–380 ms) y ninguna mitigación toca los endpoints medidos. En estrés salió más lento, pero la base
tiene una sola corrida, así que no lo afirmamos y quedó como medición pendiente. Honestidad ante todo.

**¿Por qué el pipeline tardó 20 minutos?** El equipo tenía la CPU al 100%. Cada herramienta por separado
tarda entre 2 y 60 s, y en GitHub Actions las etapas 2 y 3 corren en paralelo.

**¿Qué es un riesgo aceptado?** Un riesgo que no se corrige ahora, con justificación, responsable y fecha
de revisión. Está versionado en `zap-riesgos-aceptados.json` y el gate solo lo tolera mientras figure ahí.

**¿Qué ley aplica y desde cuándo?** La Ley 21.719 de datos personales rige desde el 1 de diciembre de
2026 y crea la Agencia de Protección de Datos. La Ley 21.663, Ley Marco de Ciberseguridad, exige
medidas de seguridad y reporte de incidentes. ISO 27001 e ISO 25010 son los estándares técnicos.

**¿RTO y RPO?** RPO de 15 min (cuántos datos se pueden perder) y RTO de 2 h (cuánto puede estar caído),
con restauración probada cada mes.

## Demostración en vivo (si la piden)

```bash
docker compose up -d --build
node --test --test-reporter=spec ev3/automatizacion/api/atlas-api.test.mjs   # 27/27 en ~2 s
cd ev3/automatizacion/e2e && npm test                                       # 5 E2E con Selenium
bash ev3/automatizacion/pipeline-local.sh                                   # pipeline completo
```
Selenium IDE: abrir `ev3/automatizacion/selenium-ide/atlas-login.side` en la extensión y ejecutar la suite.
