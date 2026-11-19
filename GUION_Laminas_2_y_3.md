# Guion de presentación — Láminas 2 y 3

Texto para decir en voz alta, no para leer literal de la pantalla. Apóyate en lo que el público ya
está viendo en la lámina; no repitas cada palabra que aparece escrita, explica el *por qué* detrás
de cada una. Duración orientativa: ~60-75 segundos por lámina (quedan ~8-9 min para que tu equipo
cubra las 8 láminas en los 10 min de defensa).

---

## Transición desde la lámina 1 (portada)

> "Antes de entrar al detalle técnico, quiero explicar **cómo decidimos qué probar primero**,
> porque Atlas tiene decenas de funcionalidades y no todas pesan lo mismo si fallan."

---

## LÁMINA 2 — Enfoque Estratégico de las Pruebas

**(Señala el círculo mientras hablas)**

> "No probamos todo con la misma intensidad. Usamos lo que se llama **pruebas basadas en riesgo**,
> *Risk-Based Testing*: priorizamos lo que, si falla, le causa el mayor daño a CreaLab SpA y a las
> pymes que usan Atlas.
>
> Por eso el centro del círculo —en rojo— es autenticación y control de acceso, junto con los datos
> bancarios y personales. Eso es **riesgo crítico**: si falla, no es un bug cualquiera, es una
> filtración de datos de terceros con consecuencias legales reales.
>
> Un nivel más afuera, en naranja, está el **riesgo alto**: validación de entradas, gestión de
> documentos, trazabilidad. Y en el anillo exterior, azul, el **riesgo medio**: rendimiento,
> usabilidad, compatibilidad — cosas que afectan la experiencia, pero que si fallan no comprometen
> datos de nadie.
>
> ¿Por qué importa esto? Porque Atlas centraliza datos sensibles de pymes chilenas — ese es el
> contexto de negocio real. Entonces la pregunta que guio todo nuestro diseño de pruebas no fue
> '¿qué es fácil de probar?', fue **'¿qué es lo que más duele si falla?'**.
>
> Y la idea que más quiero que se les quede: **una falla de validación no es solo un defecto de
> calidad. Es la puerta de entrada a una vulnerabilidad de seguridad, y potencialmente a un
> incumplimiento normativo.** Esa cadena —calidad, seguridad, ley— es el hilo que conecta todo
> este informe, y la vamos a retomar más adelante."

**(Transición a lámina 3)**

> "Entonces, ya definido qué priorizar, la siguiente pregunta es: ¿con qué herramientas lo
> probamos?"

---

## LÁMINA 3 — Herramientas Seleccionadas y Justificación Técnica

**(Señala el pipeline de izquierda a derecha mientras hablas)**

> "Armamos esto como un pipeline, de izquierda a derecha, igual que correría en un proceso real de
> integración continua.
>
> **Primero, la base: entorno y código.** Usamos Docker para levantar el mismo entorno de pruebas
> las veces que sea necesario, de forma idéntica — esto es clave porque si no puedes reproducir el
> entorno, no puedes confirmar que un hallazgo es real y no un error de configuración de tu propia
> máquina. Y sobre ese entorno corrimos **SonarQube y ESLint**, que son análisis **estático** de
> código: leen el código fuente sin ejecutarlo, buscando bugs y vulnerabilidades antes de que el
> programa siquiera corra. Esto es prevención temprana: más barato corregir algo aquí que en
> producción.
>
> **Segundo, lo funcional y de integración.** Con Postman y Newman probamos las APIs directamente
> —que los endpoints cumplan las reglas de negocio—, y con `psql` entramos directo a la base de
> datos PostgreSQL para confirmar que lo que la API dice que guardó, realmente se guardó bien y
> completo.
>
> **Y tercero, seguridad y no funcional.** OWASP ZAP hace lo contrario a |SonarQube: es análisis
> **dinámico**, ataca la aplicación mientras está corriendo, simulando lo que haría un atacante
> real, sin mirar el código fuente. k6 y JMeter inyectan carga y concurrencia para ver si el
> sistema aguanta muchos usuarios a la vez. Y Lighthouse y axe auditan accesibilidad y experiencia
> de usuario.
>
> La idea de fondo de esta lámina es que **estático y dinámico se complementan, no compiten**:
> el análisis estático te dice dónde está el problema en el código; el dinámico te dice cómo se
> comporta ese problema cuando el sistema ya está expuesto a internet. Por eso no elegimos una sola
> herramienta, elegimos un ecosistema que cubre el ciclo completo."

**(Transición a lámina 4, si te toca seguir, o cede la palabra)**

> "Con ese enfoque y ese set de herramientas, pasamos a la ejecución misma — eso lo explica
> [nombre del compañero que sigue]."

---

## Notas rápidas por si hay preguntas después de estas dos láminas

- **"¿Por qué no probaron todo igual?"** → Costo y tiempo limitados; priorizar por riesgo es
  estándar de la industria (Risk-Based Testing), no un atajo.
- **"¿Usaron realmente OWASP ZAP / k6 / JMeter?"** → Fueron las herramientas **recomendadas y
  justificadas técnicamente** para este enfoque. En la ejecución del ciclo de pruebas, algunas no
  estaban disponibles en el entorno de laboratorio y se usaron sustitutos reales y declarados
  (por ejemplo, un script de carga con Node/axios en lugar de k6); Lighthouse sí se ejecutó tal
  cual. Es una respuesta honesta, no hay que esconderla si preguntan.
- **"¿Qué diferencia hay entre SAST y DAST en una frase?"** → SAST lee el código sin correrlo
  (SonarQube); DAST ataca el sistema corriendo sin ver el código (ZAP).
