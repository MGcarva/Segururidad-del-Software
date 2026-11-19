"""Genera el Informe Semestral - Iteracion 3 (EP5) en Word con el formato
exigido: titulos Arial 12, cuerpo Arial 11, interlineado 1,5, justificado."""
import os, json
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING, WD_BREAK, WD_COLOR_INDEX
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BASE = os.path.dirname(os.path.abspath(__file__))
G = os.path.join(BASE, "graficos")
EVI = os.path.join(BASE, "..", "evidencias")
OUT = os.path.join(BASE, "Informe_Semestral_Iteracion3_Atlas_EP5.docx")

doc = Document()
sec = doc.sections[0]
sec.page_height, sec.page_width = Cm(27.94), Cm(21.59)
for m in ("left_margin", "right_margin"):
    setattr(sec, m, Cm(2.5))
sec.top_margin = sec.bottom_margin = Cm(2.5)

# ------------------------------------------------------------------ estilos
def fuente(style, size, bold=False, color=None):
    style.font.name = "Arial"; style.font.size = Pt(size); style.font.bold = bold
    rpr = style.element.get_or_add_rPr()
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts"); rpr.append(rf)
    for a in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rf.set(qn(a), "Arial")
    if color is not None:
        style.font.color.rgb = color

normal = doc.styles["Normal"]
fuente(normal, 11)
pf = normal.paragraph_format
pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
pf.space_after = Pt(6)
for lvl in (1, 2, 3):
    st = doc.styles[f"Heading {lvl}"]
    fuente(st, 12, bold=True, color=RGBColor(0x1F, 0x3A, 0x5F))
    st.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    st.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    st.paragraph_format.space_before = Pt(12 if lvl == 1 else 8)
    st.paragraph_format.space_after = Pt(4)
    st.font.italic = False

def H(texto, nivel=1):
    return doc.add_heading(texto, level=nivel)

def P(texto="", negrita_inicio=None, completar=False):
    p = doc.add_paragraph()
    if negrita_inicio:
        r = p.add_run(negrita_inicio); r.bold = True
    r = p.add_run(texto)
    if completar:
        r.font.highlight_color = WD_COLOR_INDEX.YELLOW
    return p

def B(texto, negrita=None, nivel=0):
    p = doc.add_paragraph(style="List Bullet" if nivel == 0 else "List Bullet 2")
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    if negrita:
        r = p.add_run(negrita); r.bold = True
    p.add_run(texto)
    return p

def N(texto, negrita=None):
    p = doc.add_paragraph(style="List Number")
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    if negrita:
        r = p.add_run(negrita); r.bold = True
    p.add_run(texto)

def sombrear(celda, hexcolor):
    tcPr = celda._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), hexcolor)
    tcPr.append(shd)

def T(encabezados, filas, anchos=None, tam=9):
    t = doc.add_table(rows=1, cols=len(encabezados))
    t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(encabezados):
        c = t.rows[0].cells[i]; c.text = ""
        r = c.paragraphs[0].add_run(h); r.bold = True; r.font.size = Pt(tam); r.font.color.rgb = RGBColor(255, 255, 255)
        sombrear(c, "1F3A5F")
    for fila in filas:
        cells = t.add_row().cells
        for i, v in enumerate(fila):
            cells[i].text = ""
            par = cells[i].paragraphs[0]
            par.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
            par.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
            par.paragraph_format.space_after = Pt(0)
            r = par.add_run(str(v)); r.font.size = Pt(tam)
    for row in t.rows:
        for c in row.cells:
            for par in c.paragraphs:
                par.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
                par.paragraph_format.space_after = Pt(0)
    if anchos:
        for row in t.rows:
            for i, w in enumerate(anchos):
                row.cells[i].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t

FIG = [0]
def F(archivo, leyenda, ancho=16):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(os.path.join(G, archivo) if not os.path.isabs(archivo) else archivo, width=Cm(ancho))
    FIG[0] += 1
    c = doc.add_paragraph(); c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = c.add_run(f"Figura {FIG[0]}. {leyenda}"); r.italic = True; r.font.size = Pt(9)

def CODE(texto):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    pPr = p._p.get_or_add_pPr(); shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), "F2F2F2"); pPr.append(shd)
    r = p.add_run(texto); r.font.name = "Consolas"; r.font.size = Pt(8)
    r._element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas")

def salto():
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

# ------------------------------------------------------------------ datos medidos
tiempos = json.load(open(os.path.join(EVI, "pipeline", "pipeline-tiempos.json"), encoding="utf-8"))
t_total = sum(t["ms"] for t in tiempos) / 60000

# ================================================================== PORTADA
for _ in range(3):
    doc.add_paragraph()
def centrado(texto, tam=11, negrita=False, completar=False):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(texto); r.font.size = Pt(tam); r.bold = negrita
    if completar: r.font.highlight_color = WD_COLOR_INDEX.YELLOW
centrado("Evaluación Parcial N°5", 12, True)
centrado("Informe Semestral · Iteración 3", 12, True)
centrado("Optimizando el aseguramiento de la calidad y seguridad del software", 12)
doc.add_paragraph()
centrado("Sistema de Gestión Atlas · CreaLab SpA", 12, True)
centrado("ISY1102 · Seguridad y Calidad en el Desarrollo de Software", 11)
for _ in range(3):
    doc.add_paragraph()
centrado("Integrantes", 11, True)
centrado("Martín Romero Serrano")
centrado("Andrés Romero Madrid")
centrado("Manuel Gonzalo Carvajal")
doc.add_paragraph()
centrado("Carrera: [COMPLETAR]", completar=True)
centrado("Sección: [COMPLETAR]", completar=True)
centrado("Docente: Cristian Medina")
centrado("Fecha: 17 de noviembre de 2026")
centrado("Duoc UC", 11, True)
salto()

# ================================================================== INDICE
H("Índice")
for linea in [
    "1. Introducción y alcance de la iteración 3",
    "2. Puntos abordados en evaluaciones previas y ajustes según retroalimentación",
    "3. Enfoques y herramientas de prueba de seguridad",
    "4. Resultados de la ejecución de pruebas de seguridad",
    "5. Propuestas de mitigación de los defectos identificados",
    "6. Diagramas de integración de controles de seguridad automatizados",
    "7. Automatización de pruebas: diseño, ejecución y eficiencia",
    "8. Análisis del plan de mantenimiento del software",
    "9. Propuestas para preservar la calidad y los aspectos normativos y legales",
    "10. Conclusiones",
    "Anexo A. Inventario de evidencias y reproducibilidad",
    "Anexo B. Referencias",
]:
    p = doc.add_paragraph(linea); p.paragraph_format.space_after = Pt(0)
salto()

# ================================================================== 1
H("1. Introducción y alcance de la iteración 3")
P("Este informe corresponde a la tercera y última iteración del caso semestral sobre el Sistema de Gestión Atlas, "
  "plataforma web de CreaLab SpA (React + Express + PostgreSQL) que permite a pymes chilenas gestionar clientes, "
  "contratos y documentos, administrar usuarios y roles internos, auditar acciones y cumplir la normativa de "
  "protección de datos. En las iteraciones anteriores el equipo diseñó el plan de pruebas, ejecutó 85 casos con "
  "trazabilidad completa al ERS y emitió un diagnóstico bajo el mandato de «diagnóstico sin alteración».")
P("En esta iteración el alcance cambia de diagnosticar a asegurar de forma continua. Se ejecutaron pruebas de "
  "seguridad con herramientas reales (OWASP ZAP, Semgrep, SonarQube, npm audit, Gitleaks), se automatizaron las "
  "pruebas funcionales, de seguridad, E2E y de carga, se implementaron y verificaron las mitigaciones de los "
  "defectos de mayor riesgo y se diseñó un pipeline CI/CD DevSecOps junto con un plan de mantenimiento que "
  "preserva la calidad, la seguridad y el cumplimiento normativo en las futuras iteraciones del software.")
P("Todas las cifras de este documento provienen de ejecuciones reales realizadas el 17 de noviembre de 2026 sobre "
  "el entorno Docker del caso. Los reportes originales (logs, JSON, HTML y capturas) se encuentran en la carpeta "
  "ev3/evidencias del proyecto y se listan en el Anexo A. Cuando una cifra es una estimación y no una medición, "
  "se indica explícitamente.", "Criterio de evidencia. ")
T(["Indicador", "Antes (código original)", "Después (iteración 3)"], [
    ["Pruebas automatizadas de API aprobadas", "13 de 26 (50%)", "27 de 27 (100%)"],
    ["Vulnerabilidades de seguridad confirmadas abiertas", "17 (2 críticas, 10 altas, 5 medias)", "0 (4 riesgos residuales aceptados)"],
    ["OWASP ZAP: alertas Altas y Medias", "6", "2 (riesgos aceptados documentados)"],
    ["SonarQube: vulnerabilidades / Security Rating", "4 / E", "1 / B"],
    ["npm audit, dependencias de producción backend", "7 (1 crítica, 4 altas)", "0"],
    ["Pruebas unitarias (Jest) / cobertura módulos de seguridad", "8 / no medida", "29 / 89,9% de líneas"],
    ["Tiempo de un ciclo de regresión de seguridad", "≈ 318 min (manual, estimado)", "≈ 2,2 min (automatizado, medido)"],
], anchos=[7, 4.5, 4.5])

# ================================================================== 2
H("2. Puntos abordados en evaluaciones previas y ajustes según retroalimentación")
P("La Tabla 2 resume lo construido en las iteraciones anteriores y cómo se ajustó en esta iteración. La columna de "
  "retroalimentación del docente debe completarse con los comentarios textuales recibidos en AVA para las "
  "evaluaciones parciales previas.")
T(["Iteración", "Entregable previo", "Retroalimentación del docente", "Ajuste aplicado en la iteración 3"], [
    ["EP1/EP2 – Plan", "Criterios de calidad, seguridad y normativa; plan de pruebas basado en riesgo (Risk-Based Testing).",
     "[COMPLETAR con feedback textual]",
     "Se mantiene el enfoque por riesgo: los 27 casos automatizados priorizan autenticación, control de acceso y datos sensibles (capa crítica)."],
    ["EP3 – Ejecución", "85 casos con trazabilidad 100% al ERS; 48 incidentes (4 críticos, 21 altos).",
     "[COMPLETAR con feedback textual]",
     "Los incidentes de control de acceso se convirtieron en pruebas automatizadas de regresión (SEC-08 a SEC-14) que hoy corren en cada cambio."],
    ["EP3 – Herramientas", "ZAP, k6 y SonarQube recomendados pero no ejecutados (sustitutos declarados).",
     "[COMPLETAR con feedback textual]",
     "Ahora se ejecutan realmente: OWASP ZAP (baseline + API activa), k6, SonarQube, Semgrep y Gitleaks, con reportes adjuntos."],
    ["EP4 – Presentación", "Auditoría con mandato «diagnóstico sin alteración» y receta de remediación en 3 pasos.",
     "[COMPLETAR con feedback textual]",
     "Se ejecutaron los 3 pasos: remediación de Críticos y Altos, integración de SAST en CI/CD y matriz de cumplimiento legal (secciones 5, 6 y 9)."],
], anchos=[2.4, 4.4, 3.6, 5.6])
for c in doc.tables[-1].columns[2].cells[1:]:
    for r in c.paragraphs[0].runs:
        r.font.highlight_color = WD_COLOR_INDEX.YELLOW

# ================================================================== 3
H("3. Enfoques y herramientas de prueba de seguridad")
H("3.1 Enfoques según el conocimiento previo del sistema", 2)
P("Las pruebas de penetración se clasifican según cuánta información tiene el evaluador. En Atlas se combinaron los "
  "tres enfoques porque cada uno descubre una clase distinta de vulnerabilidad:")
T(["Enfoque", "Qué simula", "Cómo se aplicó en Atlas", "Hallazgo real que permitió detectar"], [
    ["Caja negra", "Atacante externo sin credenciales ni código.",
     "OWASP ZAP baseline sobre el frontend sin autenticación.",
     "Ausencia de CSP y anti-clickjacking; versión de nginx expuesta."],
    ["Caja gris", "Usuario legítimo con acceso limitado (amenaza interna).",
     "Suite de API con dos empresas de prueba (A y B) y un editor; ZAP API scan autenticado.",
     "IDOR: la empresa A modificaba usuarios y creaba contratos de la empresa B; auditoría expuesta entre empresas."],
    ["Caja blanca", "Revisión con acceso total al código fuente.",
     "SAST (Semgrep, SonarQube), SCA (npm audit) y búsqueda de secretos (Gitleaks).",
     "Contraseña de PostgreSQL embebida en db.js; secreto JWT publicado en README y .env."],
], anchos=[2.2, 3.5, 5, 5.3])
H("3.2 Metodología de ejecución", 2)
P("Se siguió la metodología de seis fases revisada en la unidad 3, dentro de un entorno de laboratorio propio "
  "(contenedores Docker locales), lo que constituye la autorización explícita y el límite de alcance exigidos por el "
  "marco legal y ético del pentesting:")
for neg, txt in [
    ("Reconocimiento: ", "lectura del ERS, del README y del contrato OpenAPI (/openapi.json) para mapear 9 recursos y 38 operaciones."),
    ("Escaneo: ", "ZAP Spider y escaneo pasivo; npm audit y Gitleaks sobre el repositorio."),
    ("Enumeración: ", "identificación de endpoints protegidos y no protegidos, roles (administrador, editor) y relación empresa-usuario."),
    ("Explotación controlada: ", "payloads de inyección SQL, JWT con firma alterada, fuerza bruta, accesos cruzados entre empresas y escaneo activo de ZAP."),
    ("Post-explotación: ", "evaluación del impacto, por ejemplo la persistencia de los payloads de ZAP en la base de datos (Figura 1) y el secuestro de cuentas mediante vínculos cruzados."),
    ("Documentación: ", "reporte por hallazgo con severidad, evidencia, mitigación y prueba de verificación (secciones 4 y 5)."),
]:
    N(txt, neg)
H("3.3 Herramientas empleadas y su función en la detección de vulnerabilidades", 2)
T(["Herramienta", "Tipo", "Función en la detección", "Ejemplo pertinente en Atlas"], [
    ["OWASP ZAP 2.x (baseline y API scan)", "DAST", "Ataca la aplicación en ejecución: inyección, cabeceras, errores, configuración CORS.",
     "Detectó errores 500 con mensajes internos de PostgreSQL y CORS abierto (Access-Control-Allow-Origin: *)."],
    ["Semgrep (p/javascript, nodejsscan, expressjs, secrets)", "SAST", "Busca patrones inseguros en el código sin ejecutarlo.",
     "Marcó la descarga de contratos como posible XSS: el archivo subido no se validaba."],
    ["SonarQube Community", "SAST + calidad", "Vulnerabilidades, bugs, code smells y Security Rating con quality gate.",
     "Credencial PostgreSQL embebida (S6698, BLOCKER) y CORS permisivo (S5122)."],
    ["npm audit", "SCA", "Compara las dependencias con bases de CVE públicas.",
     "proxy-addr crítica; jws (verificación HMAC); express y path-to-regexp (ReDoS)."],
    ["Gitleaks", "Secretos", "Busca credenciales y llaves en archivos y en el historial git.",
     "JWT_SECRET en .env y README; credenciales de SonarQube en una guía."],
    ["Suite node:test + fetch (27 casos)", "Pruebas de seguridad funcionales", "Verifica controles de negocio que ningún escáner conoce: aislamiento entre empresas y roles.",
     "Probó IDOR, fuerza bruta, política de contraseñas y revocación de token."],
    ["k6", "Carga y estrés", "Mide la degradación bajo concurrencia; la disponibilidad también es seguridad.",
     "Encontró el punto de quiebre por falta de paginación (p95 de 15 s con 13 mil clientes)."],
], anchos=[3.4, 2.2, 5, 5.4])
P("Ninguna herramienta por sí sola habría encontrado todo. Los escáneres automáticos (ZAP, Semgrep) no detectaron "
  "los IDOR porque no conocen la regla de negocio «una empresa no ve datos de otra», y las pruebas de negocio no "
  "detectan CVE en dependencias. Por eso el enfoque es complementario: SAST encuentra el problema en el código, "
  "DAST demuestra cómo se comporta expuesto, y las pruebas de negocio verifican lo que solo el equipo sabe que "
  "debe cumplirse.", "Lección clave. ")

# ================================================================== 4
H("4. Resultados de la ejecución de pruebas de seguridad")
H("4.1 Hallazgos confirmados", 2)
P("La Tabla 5 consolida los hallazgos confirmados en la línea base, antes de cualquier corrección. La severidad usa "
  "la escala de la iteración anterior (Crítico, Alto, Medio, Bajo), considerando impacto en el negocio, facilidad "
  "de explotación y exposición legal.")
hall = [
    ["H-01", "IDOR: modificar usuarios de otra empresa (PUT /usuarios/:id) y cambiar su contraseña", "API suite SEC-11", "A01 / CWE-639", "Crítico", "200 OK: cuenta ajena tomada"],
    ["H-02", "Vincular a la empresa propia un usuario de otra empresa (secuestro de cuenta)", "API suite SEC-14", "A01 / CWE-639", "Crítico", "201 Created"],
    ["H-03", "Crear contratos sobre clientes de otra empresa", "API suite SEC-10 (ex CP-034)", "A01 / CWE-639", "Alto", "201 Created"],
    ["H-04", "Auditoría visible entre empresas", "API suite SEC-13", "A01 / CWE-200", "Alto", "3 registros de B visibles para A"],
    ["H-05", "Eliminar usuarios de otra empresa sin verificar pertenencia", "API suite SEC-12", "A01 / CWE-639", "Alto", "500: solo lo impidió una FK"],
    ["H-06", "Sin límite de intentos de login (fuerza bruta)", "API suite SEC-06", "A07 / CWE-307", "Alto", "8 de 8 intentos con 401, sin bloqueo"],
    ["H-07", "Política de contraseñas no aplicada en el backend", "API suite SEC-07", "A07 / CWE-521", "Alto", "Aceptó la contraseña «123»"],
    ["H-08", "Credencial de PostgreSQL embebida y secreto JWT por defecto («inseguro»)", "SonarQube S6698 / revisión", "A07 / CWE-798", "Alto", "db.js:6, authz.js:3"],
    ["H-09", "Secreto JWT publicado en README y .env versionable", "Gitleaks", "A02 / CWE-312", "Alto", "3 archivos"],
    ["H-10", "Cualquier tenant crea, modifica o borra roles globales", "ZAP API scan + SEC-20", "A01 / CWE-285", "Alto", "ZAP creó ~80 roles globales"],
    ["H-11", "Inserción arbitraria en la bitácora de auditoría (POST /auditoria)", "ZAP (evidencia en bitácora)", "A09 / CWE-117", "Alto", "Entradas falsas visibles"],
    ["H-12", "Errores internos expuestos (mensajes de PostgreSQL)", "ZAP 90022 + SEC-17", "A05 / CWE-209", "Medio", "«invalid input syntax for type bigint»"],
    ["H-13", "Sin validación de entradas en el servidor (payloads persistidos)", "ZAP + SEC-19", "A03 / CWE-20", "Medio", "Figura 1"],
    ["H-14", "CORS abierto a cualquier origen", "ZAP 10098 + SEC-18", "A05 / CWE-942", "Medio", "Access-Control-Allow-Origin: *"],
    ["H-15", "Faltan cabeceras de seguridad (API y frontend) y se revela tecnología", "ZAP 10020/10021/10038/10037", "A05 / CWE-693", "Medio", "9 alertas en el frontend"],
    ["H-16", "Subida de archivos sin validar tipo ni tamaño", "Semgrep express_xss", "A04 / CWE-434", "Medio", "contracts.js"],
    ["H-17", "Dependencias con CVE conocidas en producción", "npm audit", "A06 / CWE-1104", "Alto", "1 crítica, 4 altas"],
]
T(["ID", "Hallazgo", "Detectado con", "OWASP / CWE", "Severidad", "Evidencia"], hall, anchos=[1.1, 5.2, 2.8, 2.2, 1.6, 3.1], tam=8)
P("Resumen: 17 hallazgos confirmados (2 críticos, 10 altos, 5 medios). Los dos críticos y cuatro de los altos "
  "corresponden a control de acceso roto (OWASP A01), que es exactamente la capa central del modelo de riesgo "
  "definido en la primera iteración.")
F(os.path.join(EVI, "antes", "ZAP_payloads_persistidos_en_BD.png"),
  "Post-explotación: los payloads del escaneo activo de ZAP quedaron almacenados en la tabla de clientes (H-13). "
  "React los muestra como texto, pero la integridad de los datos quedó comprometida.", 15)
H("4.2 Falsos positivos verificados manualmente", 2)
P("Parte del trabajo de un analista es descartar alertas que no son reales. Se verificaron manualmente dos alertas "
  "«SQL Injection» de ZAP:")
B("POST /roles (riesgo Alto, confianza Baja): el error 500 lo causaba la restricción UNIQUE del nombre del rol, no "
  "una inyección. La consulta está parametrizada ($1). Se reprodujo con curl: el valor x' se insertó como texto literal.")
B("POST /empresas (riesgo Alto, confianza Media, aparece después de las correcciones): ZAP comparó las respuestas a "
  "«AND 1=1» y «AND 1=2». Ambas responden 400 por correo inválido, igual que cualquier otro valor; no hay "
  "diferencia explotable.")
P("También se clasificaron como falsos positivos 20 alertas de Gitleaks sobre identificadores de issues de SonarQube "
  "exportados a JSON. Quedaron excluidas en .gitleaks.toml con su justificación.")
H("4.3 Resultados por herramienta: antes y después", 2)
F("01_hallazgos_antes_despues.png", "Hallazgos por herramienta antes y después de la mitigación (datos de ev3/evidencias).")
T(["Herramienta", "Antes", "Después", "Comentario"], [
    ["OWASP ZAP baseline (frontend)", "3 Medias, 6 Bajas", "2 Medias aceptadas, 1 Baja", "CSP, X-Frame-Options, nosniff, Permissions-Policy y server_tokens corregidos."],
    ["OWASP ZAP API scan (backend)", "1 Alta (FP), 2 Medias, 5 Bajas", "0 Altas, 0 Medias, 1 Baja", "Quality gate: RECHAZADO antes, APROBADO después."],
    ["SonarQube", "4 vulnerabilidades, Security E", "1 vulnerabilidad, Security B", "La restante es la CSP desactivada solo en /docs y solo fuera de producción."],
    ["Semgrep", "1 ERROR", "0 bloqueantes", "Dos supresiones documentadas con justificación técnica en el código."],
    ["npm audit backend (producción)", "7 (1 crítica, 4 altas, 2 moderadas)", "0", "npm audit fix + helmet 8; total con desarrollo: 45 → 41."],
    ["npm audit frontend (total)", "22 (15 altas)", "11 altas, 0 en producción", "Las 11 restantes son herramientas de compilación (vite, tailwind) que requieren cambio de versión mayor."],
    ["Gitleaks (archivos versionables)", "5 secretos reales", "0", ".env fuera del repositorio, secreto JWT rotado, README y guía saneados."],
], anchos=[3.6, 3.3, 3.3, 5.8])

# ================================================================== 5
H("5. Propuestas de mitigación de los defectos identificados")
P("A diferencia de la iteración anterior, los hallazgos Críticos y Altos se corrigieron en el código. Cada "
  "mitigación quedó respaldada por al menos una prueba automatizada que falla con el código original y aprueba con el "
  "corregido. Así la corrección queda protegida contra regresiones futuras. La copia del código original se "
  "conserva en ev3/antes para la comparación.")
T(["ID", "Mitigación implementada", "Archivo", "Verificación"], [
    ["H-01, H-05", "Antes de modificar o eliminar, se verifica que el usuario pertenezca a la empresa del token (404 si no). La contraseña solo se cambia si se envía.", "routes/users.js", "SEC-11, SEC-12 ✔"],
    ["H-02", "Rechazo (409) de vincular un usuario que ya pertenece a otra empresa.", "routes/empresa_usuarios.js", "SEC-14 ✔"],
    ["H-03", "Validación de que el cliente pertenezca a la empresa en POST y PUT de contratos.", "routes/contracts.js", "SEC-10 ✔"],
    ["H-04", "La consulta de auditoría filtra por usuarios de la empresa del token.", "routes/audit.js", "SEC-13 ✔"],
    ["H-06", "Limitador de login: 5 fallos por IP y usuario en 15 min → 429 con Retry-After; los fallos se auditan.", "middleware/loginLimiter.js", "SEC-06 ✔, 4 pruebas unitarias"],
    ["H-07", "Política de 12 o más caracteres con mayúscula, minúscula, número y símbolo en registro, alta y edición.", "utils/validation.js", "SEC-07 ✔, 6 casos de valores límite"],
    ["H-08", "Sin credenciales en el código: DATABASE_URL y JWT_SECRET obligatorios (fail-safe). JWT con algoritmo fijo HS256.", "db.js, middleware/authz.js", "SEC-04, unitarias (alg «none» rechazado)"],
    ["H-09", ".env en .gitignore, .env.example sin valores, secreto JWT rotado, README y guía saneados.", ".gitignore, README.md", "Gitleaks: 0"],
    ["H-10", "Catálogo de roles de solo lectura (403 en POST, PUT y DELETE).", "routes/roles.js", "SEC-20 ✔"],
    ["H-11", "Bitácora de solo anexión: POST /auditoria deshabilitado (405); solo el sistema escribe.", "routes/audit.js", "SEC-21 ✔"],
    ["H-12", "Errores 500 genéricos con ID de correlación; el detalle queda solo en el log. Manejador global para JSON, multipart y bytes nulos.", "utils/validation.js, app.js", "SEC-17 ✔, ZAP sin errores 500"],
    ["H-13", "Validación de nombre, correo y teléfono en el servidor.", "routes/clients.js", "SEC-19 ✔"],
    ["H-14", "CORS restringido al origen del frontend (variable CORS_ORIGINS).", "app.js", "SEC-18 ✔"],
    ["H-15", "helmet (HSTS, CSP, nosniff, sin X-Powered-By) en la API y cabeceras de seguridad en nginx.", "app.js, FRONTEND/nginx.conf", "SEC-15, SEC-16 ✔, ZAP"],
    ["H-16", "Subida limitada a 5 MB y a PDF verificado por firma binaria (%PDF-).", "routes/contracts.js", "Prueba manual: .exe renombrado → 400"],
    ["H-17", "npm audit fix y actualización de la imagen a Node 22 LTS; proceso como usuario sin privilegios.", "package-lock.json, Dockerfile", "npm audit prod: 0"],
], anchos=[1.8, 7.6, 3.4, 3.2], tam=8)
F("02_suite_api.png", "Resultado de la suite automatizada de API antes y después de las mitigaciones.", 14)
H("5.1 Riesgos residuales aceptados", 2)
P("Un riesgo que no se corrige debe quedar formalmente aceptado, con justificación, responsable y fecha de revisión. "
  "Los riesgos aceptados están versionados en ev3/automatizacion/zap/zap-riesgos-aceptados.json, y el quality gate "
  "solo los deja pasar mientras figuren en ese archivo.")
T(["Riesgo", "Justificación", "Mitigación compensatoria", "Revisión"], [
    ["CSP con style-src 'unsafe-inline' (ZAP 10055)", "MUI/Emotion inyecta estilos en ejecución.", "script-src restringido a 'self'; React escapa la salida.", "31-03-2027: migrar a nonces"],
    ["Hojas de Google Fonts sin SRI (ZAP 90003)", "El contenido es dinámico y no admite hash.", "CSP limita font-src y style-src a los dominios de Google.", "31-03-2027: alojar fuentes localmente"],
    ["CSP desactivada en /docs (SonarQube S5728)", "Swagger UI requiere scripts propios.", "/docs no se publica cuando NODE_ENV=production.", "Revisión trimestral"],
    ["11 CVE en herramientas de build del frontend", "Requieren vite 6 → 7 y tailwind 3 → 4 (cambios mayores).", "No llegan a la imagen de producción (solo nginx y archivos estáticos).", "Próximo sprint perfectivo"],
], anchos=[4, 4, 4.8, 3.2], tam=8)

# ================================================================== 6
H("6. Diagramas de integración de controles de seguridad automatizados")
P("La Figura 4 muestra el pipeline CI/CD diseñado e implementado en .github/workflows/devsecops.yml. Aplica "
  "Shift-Left, porque los controles empiezan en el commit, y Fail Fast, porque las etapas rápidas y baratas van "
  "primero y cada etapa tiene un quality gate que detiene el pipeline. Cada gate está asociado al criterio "
  "normativo o legal que verifica, de modo que el pipeline produce evidencia continua de cumplimiento y no solo de "
  "funcionamiento.")
F("D1_pipeline_devsecops.png", "Pipeline DevSecOps: etapas, herramientas, condiciones de bloqueo y criterio normativo verificado.")
T(["Control automatizado", "Riesgo que previene", "Criterio normativo / legal", "Evidencia que genera"], [
    ["Gitleaks sobre el historial git", "Filtración de credenciales", "Ley 21.663 (deber de medidas de ciberseguridad); ISO/IEC 27001 A.8.24 (criptografía) y A.5.17 (información de autenticación)", "Reporte SARIF"],
    ["Jest con cobertura ≥ 80%", "Regresiones en controles de seguridad", "ISO/IEC 25010 (mantenibilidad, capacidad de prueba)", "JUnit + LCOV"],
    ["Semgrep + SonarQube", "Código inseguro (inyección, secretos, XSS)", "OWASP Top 10 2021; ISO/IEC 27001 A.8.28 (codificación segura)", "SARIF + Quality Gate"],
    ["npm audit + Dependabot", "Componentes con CVE conocidas", "OWASP A06; ISO/IEC 27001 A.8.8 (gestión de vulnerabilidades técnicas)", "JSON de auditoría, PR automáticos"],
    ["Suite API (IDOR, roles, auditoría)", "Acceso a datos personales de otra empresa", "Ley 19.628 / Ley 21.719 (seguridad y confidencialidad del tratamiento)", "JUnit por caso"],
    ["OWASP ZAP + gate", "Vulnerabilidades explotables en ejecución", "OWASP ASVS; Ley 21.663", "Reportes HTML y JSON"],
    ["k6", "Indisponibilidad del servicio", "NFR-PERF-1; ISO/IEC 25010 (eficiencia de desempeño)", "Resumen JSON con p95"],
    ["Aprobación manual en staging", "Cambios no revisados en producción", "Segregación de funciones; trazabilidad (imagen = SHA)", "Registro del environment"],
], anchos=[3.6, 3.4, 5.6, 3.4], tam=8)
P("La Figura 5 complementa la vista del proceso con la vista de ejecución: los controles que quedaron "
  "implementados en cada capa del sistema, siguiendo el principio de defensa en profundidad.")
F("D2_arquitectura_controles.png", "Arquitectura de Atlas con controles de seguridad en ejecución.")

# ================================================================== 7
H("7. Automatización de pruebas: diseño, ejecución y eficiencia")
H("7.1 Herramientas y diseño de los casos", 2)
T(["Nivel (pirámide)", "Herramienta", "Casos", "Técnica de diseño", "Ubicación"], [
    ["Unitario", "Jest 30", "29", "Valores límite (contraseña de 11, 12 y 13 caracteres), partición de equivalencia (correos válidos e inyecciones)", "BACKEND/tests/"],
    ["Integración / API", "node:test + fetch", "27 (6 FUN + 21 SEC)", "Tabla de decisión rol × acción × empresa; datos aislados por ejecución (dos empresas nuevas)", "ev3/automatizacion/api/"],
    ["E2E", "Selenium WebDriver (Chrome headless) + Page Object Model", "5", "Flujos críticos del usuario: login, error, ruta protegida, navegación, logout", "ev3/automatizacion/e2e/"],
    ["E2E (grabación)", "Selenium IDE (.side)", "3", "Grabación y aserciones con esperas dinámicas", "ev3/automatizacion/selenium-ide/"],
    ["No funcional", "k6", "2 escenarios", "Carga constante (50 VU) y rampa de estrés (hasta 200 VU) con umbrales", "ev3/automatizacion/carga/"],
    ["Seguridad dinámica", "OWASP ZAP + gate", "2 escaneos", "Escaneo pasivo y activo autenticado guiado por OpenAPI", "ev3/automatizacion/zap/"],
], anchos=[2.4, 3.4, 2.2, 5.4, 3], tam=8)
P("Se aplicaron las buenas prácticas de la unidad 3.3. El patrón Page Object Model aísla los selectores, así que "
  "un cambio de interfaz solo toca un archivo. Se usaron selectores data-testid estables en lugar de XPath frágiles, "
  "datos de prueba generados en cada ejecución para que la suite sea repetible e independiente del estado de la "
  "base, y cada caso referencia su requisito (RF o NFR) y su categoría OWASP para mantener la trazabilidad.")
H("7.2 Evidencias de ejecución", 2)
P("Extracto real del log de la suite de API después de las mitigaciones (ev3/evidencias/despues/api-tests.log):")
CODE("""✔ SEC-06 Bloqueo por fuerza bruta: el login se limita tras intentos fallidos (122ms)
✔ SEC-10 IDOR: no se puede crear un contrato sobre un cliente de otra empresa (6ms)
✔ SEC-11 IDOR: no se puede modificar un usuario de otra empresa (5ms)
✔ SEC-13 El registro de auditoria esta aislado por empresa (Ley 21.719) (5ms)
✔ SEC-17 Los errores no exponen detalles internos de la base de datos (17ms)
✔ SEC-21 Nadie puede insertar entradas arbitrarias en la auditoria (Ley 21.663)
ℹ tests 27   ℹ pass 27   ℹ fail 0   ℹ duration_ms 1889""")
P("Mismo caso con el código original (ev3/evidencias/antes/api-tests.log):")
CODE("""✖ SEC-11 IDOR: no se puede modificar un usuario de otra empresa
  AssertionError: usuario ajeno modificado (status 200)
✖ SEC-06 Bloqueo por fuerza bruta: no hubo bloqueo; estados: 401,401,401,401,401,401,401,401
ℹ tests 26   ℹ pass 13   ℹ fail 13""")
F(os.path.join(EVI, "despues", "e2e", "E2E-04_listado_clientes.png"),
  "Captura generada automáticamente por la prueba E2E-04 (Selenium, Chrome headless) después de iniciar sesión.", 14)
P("El pipeline completo se ejecutó de punta a punta en local con el script ev3/automatizacion/pipeline-local.sh, "
  "que reproduce las mismas etapas y gates del workflow de GitHub Actions. Todas las etapas aprobaron. Los "
  f"tiempos de la Figura 7 ({t_total:.1f} minutos en total) se midieron en un equipo de desarrollo con la CPU al "
  "100% (varios contenedores en paralelo), por lo que están inflados: las mismas herramientas ejecutadas por "
  "separado tardaron entre 2 y 60 segundos cada una (Anexo A). La etapa de k6 del pipeline corrió sobre la base semilla y obtuvo una p95 de 104 ms con 50 usuarios, por lo que su gate aprobó; la comparación con volumen equivalente está en la sección 7.4.")
F("06_pipeline_tiempos.png", "Tiempo por etapa de la ejecución real del pipeline completo (todas las etapas en estado OK).")
H("7.3 Eficiencia: impacto en tiempo y recursos", 2)
F("03_tiempo_manual_vs_auto.png", "Tiempo por ciclo de pruebas, manual (estimado) frente a automatizado (medido).")
P("El tiempo manual es una estimación del equipo basada en la ejecución manual de la iteración anterior (85 casos "
  "con curl, Postman y navegador): 4 minutos por caso de API, incluida la preparación de datos, y 3 minutos por "
  "flujo E2E. El tiempo automatizado es el medido en este ciclo. Con estos supuestos, un ciclo completo de "
  "regresión de seguridad pasa de unas 5 horas de trabajo de una persona a unos 2,2 minutos de máquina. Eso hace "
  "viable ejecutarlo en cada commit en lugar de una vez por entrega.", "Interpretación. ")
B("Detección temprana: los 13 defectos de la línea base habrían bloqueado el merge en la etapa 4, antes de llegar a producción.", "Calidad: ")
B("Consistencia: la misma prueba se ejecuta igual cada vez; una persona omite pasos al repetir 27 casos.", "Calidad: ")
B("Una prueba de carga con 50 a 200 usuarios simultáneos no es reproducible manualmente: sin k6 el NFR-PERF-1 no se puede verificar.", "Recursos: ")
B("El escaneo nocturno detecta CVE nuevas sin intervención humana y sin cambios de código.", "Recursos: ")
H("7.4 Resultados de rendimiento (k6)", 2)
F("04_rendimiento_k6.png", "Latencia p95 por corrida con un volumen de datos equivalente (unos 85 KB por iteración).", 14)
P("Con un volumen de datos equivalente, ambas versiones atienden 50 usuarios con 0% de errores y una p95 cercana "
  "al umbral de 300 ms. La versión corregida tuvo una p95 entre 292 y 380 ms en tres corridas y la original entre "
  "225 y 289 ms en dos. Ninguna mitigación modificó los endpoints medidos, y los rangos de ambas versiones se superponen, "
  "por lo que en carga la diferencia es compatible con la variación entre corridas de un equipo compartido. En "
  "estrés (200 usuarios) no hubo errores, pero la p95 fue de 732 ms antes y de 861 a 898 ms después. Con una sola "
  "corrida base no es posible atribuir esa diferencia a ruido, así que el plan de mantenimiento incluye repetir la "
  "medición en un runner dedicado de CI. En ambos casos el NFR-PERF-1 queda al límite y debe monitorearse.")
F("05_quiebre_volumen.png", "Prueba de estrés por volumen: GET /clientes devuelve todos los registros sin paginar.", 14)
P("El hallazgo de rendimiento más importante es estructural. Con unos 13 mil clientes, cada respuesta de "
  "GET /clientes pesa 8,5 MB y la p95 sube a 15 segundos. La causa es que el endpoint no pagina. Se registra como "
  "mantenimiento perfectivo prioritario (sección 8), porque un atacante puede aprovechar este comportamiento para "
  "degradar el servicio (OWASP API4: consumo de recursos sin restricción).", "Punto de quiebre (H-18, Alto). ")

# ================================================================== 8
H("8. Análisis del plan de mantenimiento del software")
P("El objetivo del plan es que la calidad, la seguridad y el cumplimiento logrados en esta iteración no se "
  "degraden con el tiempo. El principio rector es que todo cambio, cualquiera sea su tipo, entra a producción "
  "solo a través del pipeline DevSecOps (Figura 11).")
F("D3_ciclo_mantenimiento.png", "Ciclo de mantenimiento y aseguramiento continuo de Atlas.", 13)
H("8.1 Tipos de mantenimiento y su impacto", 2)
T(["Tipo", "Acciones concretas para Atlas", "Impacto en calidad", "Impacto en seguridad", "Impacto normativo"], [
    ["Correctivo", "Corregir defectos con una prueba de regresión que reproduzca el defecto antes del parche. Pendiente: 24 promesas sin await (SonarQube S9383).", "Confiabilidad (ISO 25010)", "Evita que un bug reabra una vulnerabilidad", "Trazabilidad del incidente"],
    ["Adaptativo", "Ajustar a cambios del entorno: Node LTS, PostgreSQL 15 → 17, nuevas exigencias de la Ley 21.719.", "Compatibilidad", "Sin soporte = sin parches", "Adecuación a la Ley 21.719 (vigente desde el 01-12-2026)"],
    ["Perfectivo", "Paginación en GET /clientes (H-18); vite 7 y tailwind 4; nonces en la CSP; fuentes locales (SRI).", "Eficiencia de desempeño", "Elimina riesgos aceptados y DoS", "Cierra observaciones de auditoría"],
    ["Preventivo", "Dependabot semanal, escaneo nocturno, rotación del JWT_SECRET cada 90 días, limitador con Redis si se escala a varias réplicas.", "Mantenibilidad", "Reduce la ventana de exposición a CVE", "Ley 21.663: medidas permanentes"],
], anchos=[2, 5.4, 2.6, 3, 3], tam=8)
H("8.2 Gestión de vulnerabilidades con acuerdos de nivel de servicio", 2)
T(["Severidad", "Ejemplo en Atlas", "Plazo de corrección", "Acción si se excede"], [
    ["Crítica", "IDOR, credencial expuesta", "48 horas", "Bloqueo de despliegues y escalamiento al responsable"],
    ["Alta", "CVE alta en dependencia de producción", "7 días", "Revisión en el comité semanal"],
    ["Media", "Cabecera de seguridad faltante", "30 días", "Aceptación formal del riesgo o corrección"],
    ["Baja", "Mejora informativa", "Siguiente versión", "Backlog"],
], anchos=[2.2, 5, 3.3, 5.5])
P("Si un incidente compromete datos personales, el plan de respuesta incluye evaluar la notificación a la Agencia "
  "de Protección de Datos Personales y a los titulares afectados según la Ley 21.719, y el reporte de incidentes "
  "que exige la Ley 21.663 cuando corresponda. Los logs con ID de correlación implementados en esta iteración "
  "permiten reconstruir el incidente sin exponer detalles al usuario.")
H("8.3 Continuidad operativa: RTO y RPO", 2)
P("Como Atlas almacena contratos y datos bancarios de clientes, se proponen como objetivos un RPO de 15 minutos "
  "(respaldos incrementales de PostgreSQL con WAL) y un RTO de 2 horas (restauración desde imagen versionada por "
  "SHA más el respaldo). La restauración se valida mensualmente con un pg_dump y conteo de filas, igual que en la "
  "iteración anterior. La prueba de estrés de esta iteración demostró que el servicio se recupera sin "
  "intervención después de 200 usuarios simultáneos.")
H("8.4 Métricas de seguimiento", 2)
T(["Métrica", "Línea base (EV3)", "Meta", "Fuente"], [
    ["Tiempo de pipeline (commit → artefacto)", "≈ 4 min por herramienta aislada; 30 min en equipo sobrecargado", "< 15 min en CI", "GitHub Actions"],
    ["Tasa de éxito de builds", "100% en la ejecución final", "≥ 95%", "Historial del workflow"],
    ["Cobertura de módulos de seguridad", "89,9% de líneas", "≥ 80% (gate)", "Jest / LCOV"],
    ["Vulnerabilidades Altas o Críticas abiertas", "0", "0 por más de 7 días", "ZAP, npm audit, SonarQube"],
    ["MTTR de vulnerabilidad", "No medido (primer ciclo)", "< 48 h críticas", "Issues + PR"],
    ["p95 con 50 usuarios", "292–380 ms", "< 300 ms", "k6"],
], anchos=[4.6, 4.6, 3.2, 3.6], tam=8)
H("8.5 Evaluación crítica del plan", 2)
P("El plan es sólido en lo que la máquina puede verificar: secretos, dependencias, código, control de acceso y "
  "configuración. Tiene tres limitaciones que deben reconocerse:")
B("Los escáneres no detectaron los IDOR. Este tipo de falla solo se previene escribiendo una prueba de negocio por "
  "cada nuevo endpoint, así que la revisión de pull requests debe exigirla (definición de terminado).")
B("El limitador de login y la lista de revocación de tokens viven en la memoria del proceso. Con más de una "
  "réplica deben migrar a un almacén compartido (Redis); de lo contrario el control se debilita.")
B("El cumplimiento legal no se automatiza por completo: la evaluación de impacto y las bases de licitud del "
  "tratamiento requieren revisión legal periódica, que el pipeline solo puede recordar, no reemplazar.")

# ================================================================== 9
H("9. Propuestas para preservar la calidad y los aspectos normativos y legales")
T(["Obligación", "Fuente", "Control implementado en Atlas", "Cómo se preserva en futuras iteraciones"], [
    ["Confidencialidad y seguridad de los datos personales", "Ley 19.628 y Ley 21.719", "Aislamiento por empresa en cada consulta, auditoría por empresa, contraseñas bcrypt y política robusta", "Pruebas SEC-09 a SEC-14 obligatorias en CI; un endpoint nuevo sin prueba de aislamiento no pasa la revisión"],
    ["Trazabilidad e integridad del registro de auditoría", "Ley 21.663; ISO 27001 A.8.15", "Bitácora de solo anexión, logins fallidos registrados", "SEC-21 en CI; propuesta: tabla con permisos INSERT-only a nivel de base de datos"],
    ["Gestión de vulnerabilidades técnicas", "ISO 27001 A.8.8; Ley 21.663", "npm audit, Dependabot, escaneo nocturno, SLA por severidad", "Gate de SCA bloqueante y revisión mensual de riesgos aceptados"],
    ["Protección de credenciales", "ISO 27001 A.5.17 y A.8.24", "Secretos por entorno, fail-safe, Gitleaks", "Rotación cada 90 días; gestor de secretos (GitHub Secrets o Vault)"],
    ["Calidad del producto", "ISO/IEC 25010", "Cobertura ≥ 80%, ESLint, SonarQube", "Quality gate de SonarQube sin regresión del Security Rating"],
    ["Accesibilidad para adultos mayores", "ERS (NFR-USAB) y WCAG 2.1 AA", "Pendiente de automatizar", "Agregar axe-core a la suite E2E (mantenimiento perfectivo)"],
], anchos=[3.6, 2.8, 4.8, 4.8], tam=8)
P("Además se proponen tres prácticas de proceso:")
B("Definición de terminado con seguridad: ninguna historia se cierra sin pruebas de aislamiento y de rol, sin un pipeline en verde y sin revisión de un segundo integrante.")
B("Revisión trimestral de cumplimiento: contrastar la matriz anterior con cambios regulatorios (reglamentos de la Ley 21.719 y de la ANCI) y actualizar los casos de prueba.")
B("Capacitación: el 95% de los incidentes involucra error humano; el equipo debe conocer OWASP Top 10 y el manejo de secretos.")

# ================================================================== 10
H("10. Conclusiones")
P("La tercera iteración cerró el ciclo que empezó con la planificación: los defectos diagnosticados se convirtieron "
  "en pruebas automatizadas, se corrigieron en el código y quedaron protegidos por un pipeline que impide que "
  "reaparezcan. La suite de seguridad pasó de 50% a 100% de aprobación, ZAP dejó de reportar alertas Altas o Medias "
  "no aceptadas, SonarQube subió el Security Rating de E a B y las dependencias de producción quedaron sin CVE "
  "conocidas.")
P("El aprendizaje central es que la calidad, la seguridad y el cumplimiento normativo no son tres actividades "
  "separadas. Una falla de control de acceso (calidad) expone datos de otra empresa (seguridad) e incumple la "
  "Ley 21.719 (normativa). La automatización permite verificar las tres en cada cambio y no solo una vez por "
  "semestre, lo que convierte el cumplimiento en una propiedad continua del software.")
P("Quedan como trabajo pendiente la paginación de GET /clientes (H-18), la automatización de accesibilidad y la "
  "migración de los controles en memoria a un almacén compartido antes de escalar horizontalmente. Todo está "
  "registrado en el plan de mantenimiento con su responsable y plazo.")

# ================================================================== ANEXOS
H("Anexo A. Inventario de evidencias y reproducibilidad")
T(["Evidencia", "Ruta en el proyecto"], [
    ["Código original (línea base)", "ev3/antes/"],
    ["Logs y JUnit de la suite API (antes y después)", "ev3/evidencias/{antes,despues}/api-tests.log, api-junit.xml"],
    ["Reportes OWASP ZAP HTML y JSON + gate", "ev3/evidencias/{antes,despues}/zap/"],
    ["SonarQube: medidas e issues", "ev3/evidencias/{antes,despues}/sonar-*.json"],
    ["Semgrep, Gitleaks y npm audit", "ev3/evidencias/{antes,despues}/"],
    ["k6 (resúmenes, repeticiones y prueba de volumen)", "ev3/evidencias/{antes,despues}/k6*"],
    ["Capturas E2E automáticas", "ev3/evidencias/{antes,despues}/e2e/"],
    ["Ejecución completa del pipeline", "ev3/evidencias/pipeline/, pipeline-consola.log"],
    ["Workflow CI/CD y Dependabot", ".github/workflows/devsecops.yml, .github/dependabot.yml"],
], anchos=[7, 9])
P("Tiempos medidos de cada herramienta ejecutada por separado: suite API 1,9 s; Jest 1,7 s; E2E 5,5 a 13 s; "
  "Gitleaks 2 s; Semgrep 14 a 24 s; npm audit 7 a 9 s por proyecto; ZAP baseline 38 a 51 s; ZAP API scan 57 a 63 s; "
  "k6 86 s; SonarQube 213 s por proyecto.")
P("Reproducción: docker compose up -d --build y luego bash ev3/automatizacion/pipeline-local.sh.")
H("Anexo B. Referencias")
for ref in [
    "OWASP Foundation. OWASP Top 10:2021 y OWASP API Security Top 10:2023.",
    "OWASP Foundation. Application Security Verification Standard (ASVS) 4.0.3.",
    "ISO/IEC 27001:2022. Information security management systems – Annex A.",
    "ISO/IEC 25010:2023. Systems and software Quality Requirements and Evaluation (SQuaRE).",
    "ISO/IEC/IEEE 29119-4. Software testing – Test techniques.",
    "Ley N° 19.628 sobre protección de la vida privada, y Ley N° 21.719 que regula la protección y el tratamiento de los datos personales y crea la Agencia de Protección de Datos Personales (Chile).",
    "Ley N° 21.663, Ley Marco de Ciberseguridad (Chile).",
    "Duoc UC. Material de la unidad 3, ISY1102: 3.1.1 a 3.4.1.",
]:
    B(ref)

doc.save(OUT)
print("Informe generado:", OUT)
