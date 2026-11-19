"""Diagramas EV3: (1) pipeline DevSecOps con controles automatizados y su
criterio normativo, (2) arquitectura de Atlas con los controles de seguridad
en ejecucion, (3) ciclo de mantenimiento continuo. Ejecutar con python."""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Polygon

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "graficos")
os.makedirs(OUT, exist_ok=True)
plt.rcParams["font.family"] = "Arial"

SURF, TXT, TXT2, LINE = "#fcfcfb", "#0b0b0b", "#52514e", "#9a9893"
AZUL, AZUL_T = "#2a78d6", "#e6effa"
NAR, NAR_T = "#eb6834", "#fdece4"
VERDE, VERDE_T = "#1baf7a", "#e3f5ee"
VIO, VIO_T = "#6250d6", "#ecebfa"
GRIS_T = "#f0efec"


def caja(ax, x, y, w, h, titulo, cuerpo=None, borde=AZUL, fondo=AZUL_T, tsize=10.5, bsize=8.6):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.12",
                                linewidth=1.4, edgecolor=borde, facecolor=fondo))
    if cuerpo:
        ax.text(x + w / 2, y + h - 0.22, titulo, ha="center", va="top", fontsize=tsize, fontweight="bold", color=TXT)
        ax.text(x + w / 2, y + h - 0.62, cuerpo, ha="center", va="top", fontsize=bsize, color=TXT, linespacing=1.35)
    else:
        ax.text(x + w / 2, y + h / 2, titulo, ha="center", va="center", fontsize=tsize, fontweight="bold", color=TXT)


def flecha(ax, x1, y1, x2, y2, color=LINE, estilo="-|>", ls="-", rad=0.0, lw=1.4):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=estilo, mutation_scale=13, color=color,
                                 linewidth=lw, linestyle=ls, connectionstyle=f"arc3,rad={rad}"))


def rombo(ax, cx, cy, r=0.28, color=NAR):
    ax.add_patch(Polygon([(cx, cy + r), (cx + r, cy), (cx, cy - r), (cx - r, cy)], closed=True,
                         facecolor=color, edgecolor=SURF, linewidth=1.5, zorder=4))
    ax.text(cx, cy, "G", ha="center", va="center", fontsize=8, fontweight="bold", color="white", zorder=5)


def lienzo(w, h):
    fig, ax = plt.subplots(figsize=(w, h))
    fig.patch.set_facecolor(SURF); ax.set_facecolor(SURF)
    ax.set_xlim(0, w); ax.set_ylim(0, h); ax.axis("off")
    return fig, ax


# =====================================================================================
# 1. Pipeline DevSecOps
# =====================================================================================
etapas = [
    ("1 Fuente", "Commit / Pull Request\nGitleaks (secretos)", "Secretos en el\nhistorial = bloqueo",
     "Ley 21.663\nISO 27001 A.8.24"),
    ("2 Build", "npm ci (lockfile)\nESLint · Jest\ncobertura ≥ 80%", "Test fallido o\ncobertura < 80%",
     "ISO/IEC 25010\nMantenibilidad"),
    ("3 SAST / SCA", "Semgrep · SonarQube\nnpm audit (prod)", "ERROR Semgrep,\nHigh/Critical en deps",
     "OWASP Top 10\nISO 27001 A.8.28"),
    ("4 Integración", "Docker Compose\n27 casos API seg.\n5 flujos E2E Selenium", "Fuga entre empresas\n(IDOR) = bloqueo",
     "Ley 21.719\n(aislamiento de datos)"),
    ("5 DAST", "OWASP ZAP baseline\nZAP API scan\n(autenticado)", "Alto o Medio\nno aceptado",
     "OWASP ASVS\nLey 21.663"),
    ("6 No funcional", "k6 carga 50 VU\nestrés 200 VU", "p95 > 300 ms\nerrores > 1%",
     "NFR-PERF-1\nISO 25010 eficiencia"),
    ("7 Despliegue", "Staging con\naprobación manual\nimagen = SHA commit", "Revisor distinto\nal autor",
     "Trazabilidad\nsegregación funciones"),
]
fig, ax = lienzo(19, 7.2)
ax.text(0.3, 6.95, "Pipeline CI/CD DevSecOps de Atlas: controles de seguridad automatizados por etapa",
        fontsize=15, fontweight="bold", color=TXT, va="top")
ax.text(0.3, 6.5, "Shift-Left + Fail Fast: cada etapa tiene un quality gate (G); si falla, el pipeline se detiene "
        "y el desarrollador recibe el reporte en minutos.", fontsize=10.5, color=TXT2, va="top")
w, gap, x0 = 2.25, 0.36, 0.3
for i, (t, herr, gate, norma) in enumerate(etapas):
    x = x0 + i * (w + gap)
    caja(ax, x, 4.0, w, 1.75, t, herr, borde=AZUL, fondo=AZUL_T)
    caja(ax, x, 2.4, w, 1.25, "Gate", gate, borde=NAR, fondo=NAR_T, tsize=9, bsize=8.4)
    caja(ax, x, 0.85, w, 1.25, "Criterio", norma, borde=VIO, fondo=VIO_T, tsize=9, bsize=8.4)
    flecha(ax, x + w / 2, 4.0, x + w / 2, 3.67, color=NAR)
    flecha(ax, x + w / 2, 2.4, x + w / 2, 2.1, color=VIO, estilo="-", ls=":")
    if i < len(etapas) - 1:
        flecha(ax, x + w + 0.02, 4.9, x + w + gap - 0.02, 4.9, color=TXT2)
        rombo(ax, x + w + gap / 2, 4.9, r=0.17)
# retroalimentacion
xa, xb = x0 + w / 2, x0 + 6 * (w + gap) + w / 2
ax.plot([xb, xb], [0.85, 0.42], color=NAR, lw=1.3, ls="--")
ax.plot([xb, xa], [0.42, 0.42], color=NAR, lw=1.3, ls="--")
flecha(ax, xa, 0.42, xa, 0.83, color=NAR, ls="--")
ax.text((xa + xb) / 2, 0.15, "Retroalimentación: un gate fallido devuelve el reporte (SARIF, JUnit, HTML de ZAP) "
        "al desarrollador y bloquea el merge", ha="center", fontsize=9.5, color=NAR)
# leyenda
for k, (col, fon, lab) in enumerate([(AZUL, AZUL_T, "Etapa y herramientas"), (NAR, NAR_T, "Condición de bloqueo"),
                                       (VIO, VIO_T, "Norma / requisito verificado")]):
    lx = 0.3 + k * 3.2
    ax.add_patch(FancyBboxPatch((lx, 5.98), 0.3, 0.22, boxstyle="round,pad=0.01", fc=fon, ec=col, lw=1.2))
    ax.text(lx + 0.42, 6.09, lab, fontsize=9, color=TXT, va="center")
fig.savefig(os.path.join(OUT, "D1_pipeline_devsecops.png"), dpi=200, bbox_inches="tight")
plt.close(fig)

# =====================================================================================
# 2. Arquitectura con controles en ejecucion
# =====================================================================================
fig, ax = lienzo(18, 7.2)
ax.text(0.3, 6.95, "Arquitectura de Atlas con controles de seguridad en ejecución (defensa en profundidad)",
        fontsize=15, fontweight="bold", color=TXT, va="top")
ax.text(0.3, 6.5, "Cada capa aplica controles propios; ninguna depende de que la anterior haya filtrado la solicitud.",
        fontsize=10.5, color=TXT2, va="top")
caja(ax, 0.3, 2.7, 2.3, 1.6, "Usuario", "Navegador\n(desktop, tablet, móvil)", borde=LINE, fondo=GRIS_T)
caja(ax, 3.6, 1.75, 3.5, 3.5, "Frontend · nginx",
     "React (escape de salida)\nCSP restrictiva\nX-Frame-Options DENY\nnosniff · Referrer-Policy\n"
     "Permissions-Policy\nserver_tokens off\n\nOWASP A05", borde=AZUL, fondo=AZUL_T)
caja(ax, 8.4, 0.95, 4.7, 5.1, "API · Express (Node 22)",
     "helmet: HSTS, CSP, sin X-Powered-By\nCORS solo al origen del frontend\n"
     "Límite de login: 5 fallos / 15 min (429)\nJWT HS256 + revocación (logout)\n"
     "Autorización por rol (403)\nAislamiento por empresa (anti-IDOR)\n"
     "Validación server-side de entradas\nPDF verificado por firma, máx. 5 MB\n"
     "Errores genéricos con ID de referencia\nProceso sin privilegios (USER node)\n\nOWASP A01 · A03 · A04 · A05 · A07",
     borde=AZUL, fondo=AZUL_T, bsize=8.8)
caja(ax, 14.0, 3.65, 3.7, 2.1, "PostgreSQL",
     "Consultas parametrizadas\nFK por empresa_id\nCredenciales solo por entorno",
     borde=VERDE, fondo=VERDE_T)
caja(ax, 14.0, 1.15, 3.7, 2.1, "Auditoría",
     "Solo-anexión (POST deshabilitado)\nVisible solo por empresa\nLey 21.663 · Ley 21.719",
     borde=VIO, fondo=VIO_T)
flecha(ax, 2.6, 3.5, 3.58, 3.5); ax.text(3.1, 3.65, "HTTPS", ha="center", fontsize=8.5, color=TXT2)
flecha(ax, 7.1, 3.5, 8.38, 3.5); ax.text(7.75, 3.65, "JSON + JWT", ha="center", fontsize=8.5, color=TXT2)
flecha(ax, 13.1, 4.7, 13.98, 4.7)
flecha(ax, 13.1, 2.2, 13.98, 2.2)
ax.text(0.3, 0.35, "Secretos (JWT_SECRET, DATABASE_URL) se inyectan por entorno; el servicio no arranca si faltan "
        "(fail-safe). Ningún secreto queda en el código ni en el repositorio (.env en .gitignore, verificado por Gitleaks).",
        fontsize=9.5, color=TXT2)
fig.savefig(os.path.join(OUT, "D2_arquitectura_controles.png"), dpi=200, bbox_inches="tight")
plt.close(fig)

# =====================================================================================
# 3. Ciclo de mantenimiento continuo
# =====================================================================================
import math
fig, ax = lienzo(16, 10)
ax.text(0.3, 9.7, "Ciclo de mantenimiento y aseguramiento continuo de Atlas",
        fontsize=15, fontweight="bold", color=TXT, va="top")
ax.text(0.3, 9.25, "Cada cambio, sea correctivo, adaptativo, perfectivo o preventivo, pasa por el mismo pipeline antes de llegar a producción.",
        fontsize=10.5, color=TXT2, va="top")
pasos = [
    ("1 Monitorear", "Escaneo nocturno, Dependabot,\nlogs con ID de error, métricas", AZUL, AZUL_T),
    ("2 Detectar", "CVE nueva, gate fallido,\nincidente, cambio legal", NAR, NAR_T),
    ("3 Clasificar", "Severidad CVSS → SLA\nCrítico 48 h · Alto 7 d", NAR, NAR_T),
    ("4 Corregir", "Rama + PR con prueba\nde regresión del hallazgo", AZUL, AZUL_T),
    ("5 Verificar", "Pipeline DevSecOps\ncompleto (7 gates)", VERDE, VERDE_T),
    ("6 Liberar", "Staging → producción,\nversión trazable (SHA)", VERDE, VERDE_T),
    ("7 Revisar", "Post-mortem, métricas,\nactualizar riesgos aceptados", VIO, VIO_T),
]
cx, cy, R = 8.0, 4.3, 3.6
n = len(pasos)
pos = []
for i in range(n):
    ang = math.pi / 2 - 2 * math.pi * i / n
    pos.append((cx + R * 1.75 * math.cos(ang), cy + R * math.sin(ang)))
bw, bh = 3.2, 1.25
for i, ((t, c, col, fon), (x, y)) in enumerate(zip(pasos, pos)):
    caja(ax, x - bw / 2, y - bh / 2, bw, bh, t, c, borde=col, fondo=fon, tsize=10, bsize=8.6)
for i in range(n):
    (x1, y1), (x2, y2) = pos[i], pos[(i + 1) % n]
    dx, dy = x2 - x1, y2 - y1; d = math.hypot(dx, dy)
    ux, uy = dx / d, dy / d
    t = min((bw / 2 + 0.12) / abs(ux) if ux else 1e9, (bh / 2 + 0.12) / abs(uy) if uy else 1e9)
    sx, sy = x1 + ux * t, y1 + uy * t
    ex, ey = x2 - ux * t, y2 - uy * t
    flecha(ax, sx, sy, ex, ey, color=TXT2, rad=-0.15)
ax.text(cx, cy + 0.35, "Calidad sostenible", ha="center", fontsize=12, fontweight="bold", color=TXT)
ax.text(cx, cy - 0.25, "ISO/IEC 25010 · ISO/IEC 27001\nLey 19.628 / 21.719 · Ley 21.663",
        ha="center", va="top", fontsize=9.5, color=TXT2, linespacing=1.4)
fig.savefig(os.path.join(OUT, "D3_ciclo_mantenimiento.png"), dpi=200, bbox_inches="tight")
plt.close(fig)
print("Diagramas generados en", OUT)
