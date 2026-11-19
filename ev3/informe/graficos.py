"""Genera los graficos del informe y la presentacion EV3 a partir de las
evidencias reales en ev3/evidencias. Ejecutar: python ev3/informe/graficos.py"""
import json, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator

BASE = os.path.dirname(os.path.abspath(__file__))
EVI = os.path.join(BASE, "..", "evidencias")
OUT = os.path.join(BASE, "graficos")
os.makedirs(OUT, exist_ok=True)

# Paleta validada (scripts/validate_palette.js: ALL CHECKS PASS, light)
ANTES, DESPUES = "#eb6834", "#2a78d6"
SURF, TXT, TXT2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"

plt.rcParams.update({
    "font.family": "Arial", "font.size": 11, "axes.edgecolor": GRID,
    "axes.labelcolor": TXT2, "xtick.color": TXT2, "ytick.color": TXT2,
    "figure.facecolor": SURF, "axes.facecolor": SURF, "savefig.facecolor": SURF,
    "axes.spines.top": False, "axes.spines.right": False,
})

def titulo(ax, t, sub=None):
    ax.set_title(t, loc="left", fontsize=14, fontweight="bold", color=TXT, pad=26 if sub else 12)
    if sub:
        ax.text(0, 1.02, sub, transform=ax.transAxes, fontsize=10, color=TXT2, va="bottom")

def leyenda(ax):
    ax.legend(frameon=False, loc="lower right", fontsize=10, labelcolor=TXT)

def guardar(fig, nombre):
    fig.savefig(os.path.join(OUT, nombre), dpi=200, bbox_inches="tight", pad_inches=0.3)
    plt.close(fig)

def k6_p95(ruta, esc):
    m = json.load(open(ruta, encoding="utf-8"))["metrics"]
    return m[f"http_req_duration{{escenario:{esc}}}"]["p(95)"]

# ---------------------------------------------------------------- 1 hallazgos por herramienta
cats = [
    ("Pruebas API de seguridad fallidas", 13, 0),
    ("Dependencias vulnerables en producción (backend, npm audit)", 7, 0),
    ("OWASP ZAP: alertas Altas y Medias", 6, 2),
    ("Secretos en archivos versionables (Gitleaks)", 5, 0),
    ("SonarQube: vulnerabilidades", 4, 1),
    ("Semgrep: hallazgos bloqueantes (ERROR)", 1, 0),
]
fig, ax = plt.subplots(figsize=(10, 5.2))
y = range(len(cats))[::-1]
h = 0.36
for i, (lab, a, d) in zip(y, cats):
    ax.barh(i + h / 2 + 0.02, a, height=h, color=ANTES, label="Antes" if i == len(cats) - 1 else None)
    ax.barh(i - h / 2 - 0.02, d, height=h, color=DESPUES, label="Después" if i == len(cats) - 1 else None)
    ax.text(a + 0.15, i + h / 2 + 0.02, str(a), va="center", fontsize=10, color=TXT)
    ax.text(d + 0.15, i - h / 2 - 0.02, str(d), va="center", fontsize=10, color=TXT)
ax.set_yticks(list(y), [c[0] for c in cats], color=TXT)
ax.xaxis.set_major_locator(MaxNLocator(integer=True))
ax.grid(axis="x", color=GRID, linewidth=0.8); ax.set_axisbelow(True)
ax.set_xlabel("Cantidad de hallazgos")
titulo(ax, "Hallazgos de seguridad antes y después de la mitigación",
       "Las 2 alertas ZAP restantes y la vulnerabilidad SonarQube son riesgos aceptados y documentados")
leyenda(ax)
guardar(fig, "01_hallazgos_antes_despues.png")

# ---------------------------------------------------------------- 2 resultado suite API
fig, ax = plt.subplots(figsize=(8, 3.2))
filas = [("Después (27 casos)", 27, 0), ("Antes (26 casos)", 13, 13)]
for i, (lab, ok, ko) in enumerate(filas):
    ax.barh(i, ok, color=DESPUES, height=0.5, label="Aprobados" if i == 0 else None)
    ax.barh(i, ko, left=ok + 0.15 if ko else ok, color=ANTES, height=0.5, label="Fallidos" if i == 1 else None)
    ax.text(ok / 2, i, f"{ok} aprobados", ha="center", va="center", color="white", fontsize=10, fontweight="bold")
    if ko:
        ax.text(ok + ko / 2, i, f"{ko} fallidos", ha="center", va="center", color="white", fontsize=10, fontweight="bold")
ax.set_yticks([0, 1], [f[0] for f in filas], color=TXT)
ax.set_xlim(0, 28); ax.set_xlabel("Casos de prueba automatizados (API funcional + seguridad)")
ax.grid(axis="x", color=GRID, linewidth=0.8); ax.set_axisbelow(True)
titulo(ax, "Suite automatizada de la API: de 50% a 100% de aprobación")
handles, labels = ax.get_legend_handles_labels()
ax.legend(handles, labels, frameon=False, loc="upper center", bbox_to_anchor=(0.5, -0.32), ncol=2, fontsize=10)
guardar(fig, "02_suite_api.png")

# ---------------------------------------------------------------- 3 tiempo manual vs automatizado
act = [  # (actividad, minutos manual estimado, segundos automatizado medido)
    ("27 casos API funcionales y de seguridad", 108, 1.9),
    ("Revisión de seguridad web (DAST)", 90, 105),
    ("Revisión de dependencias (SCA)", 45, 16),
    ("5 flujos E2E en navegador", 15, 8.4),
    ("29 pruebas unitarias", 30, 1.7),
    ("Búsqueda de secretos en el código", 30, 2),
]
fig, ax = plt.subplots(figsize=(10, 5))
y = range(len(act))[::-1]
for i, (lab, man, auto) in zip(y, act):
    am = auto / 60
    ax.barh(i + h / 2 + 0.02, man, height=h, color=ANTES, label="Manual (estimado)" if i == len(act) - 1 else None)
    ax.barh(i - h / 2 - 0.02, max(am, 0.4), height=h, color=DESPUES, label="Automatizado (medido)" if i == len(act) - 1 else None)
    ax.text(man + 1, i + h / 2 + 0.02, f"{man} min", va="center", fontsize=10, color=TXT)
    ax.text(max(am, 0.4) + 1, i - h / 2 - 0.02, f"{auto:g} s".replace(".", ","), va="center", fontsize=10, color=TXT)
ax.set_yticks(list(y), [a[0] for a in act], color=TXT)
ax.set_xlabel("Minutos por ciclo de pruebas")
ax.grid(axis="x", color=GRID, linewidth=0.8); ax.set_axisbelow(True)
tm = sum(a[1] for a in act); ta = sum(a[2] for a in act) / 60
titulo(ax, f"Tiempo por ciclo: {tm} min manual frente a {ta:.1f} min automatizado".replace(".", ","),
       "Manual: estimación del equipo según la ejecución manual de EV2 · Automatizado: tiempos medidos en este ciclo")
leyenda(ax)
guardar(fig, "03_tiempo_manual_vs_auto.png")

# ---------------------------------------------------------------- 4 rendimiento k6 (corridas)
antes = {"carga": [224.71, k6_p95(os.path.join(EVI, "antes", "k6-summary.json"), "carga")],
         "estres": [k6_p95(os.path.join(EVI, "antes", "k6-summary.json"), "estres")]}
desp_files = [os.path.join(EVI, "despues", "k6-summary.json")] + [
    os.path.join(EVI, "despues", "k6-repeticiones", f"k6-summary-{i}.json") for i in (2, 3)]
desp = {e: [k6_p95(f, e) for f in desp_files] for e in ("carga", "estres")}
fig, ax = plt.subplots(figsize=(9, 4.6))
xpos = {"carga": 0, "estres": 1}
for esc, x in xpos.items():
    for j, v in enumerate(antes[esc]):
        ax.scatter(x - 0.12, v, s=70, color=ANTES, edgecolor=SURF, linewidth=2, zorder=3,
                   label="Antes" if (esc == "carga" and j == 0) else None)
    for j, v in enumerate(desp[esc]):
        ax.scatter(x + 0.12, v, s=70, color=DESPUES, edgecolor=SURF, linewidth=2, zorder=3,
                   label="Después" if (esc == "carga" and j == 0) else None)
ax.axhline(300, color=TXT2, linestyle="--", linewidth=1)
ax.text(-0.45, 312, "Umbral NFR-PERF-1: p95 < 300 ms", ha="left", va="bottom", fontsize=9, color=TXT2)
ax.set_xticks([0, 1], ["Carga: 50 usuarios", "Estrés: rampa a 200 usuarios"], color=TXT)
ax.set_xlim(-0.5, 1.5); ax.set_ylim(0, 1000)
ax.set_ylabel("Latencia p95 (ms)")
ax.grid(axis="y", color=GRID, linewidth=0.8); ax.set_axisbelow(True)
titulo(ax, "Rendimiento con volumen de datos equivalente (cada punto = una corrida)",
       "0% de errores en todas las corridas · antes: 2 corridas de carga y 1 de estrés · después: 3 corridas de cada una")
ax.legend(frameon=False, loc="upper left", fontsize=10)
guardar(fig, "04_rendimiento_k6.png")

# ---------------------------------------------------------------- 5 punto de quiebre por volumen
p95_13k = k6_p95(os.path.join(EVI, "despues", "k6-volumen-13k", "k6-summary.json"), "carga")
fig, ax = plt.subplots(figsize=(8, 3.4))
vals = [("128 clientes", desp["carga"][0]), ("12.990 clientes", p95_13k)]
for i, (lab, v) in enumerate(vals):
    ax.barh(1 - i, v / 1000, color=DESPUES, height=0.5)
    ax.text(v / 1000 + 0.2, 1 - i, f"{v / 1000:.2f} s".replace(".", ","), va="center", fontsize=11, color=TXT, fontweight="bold")
ax.set_yticks([1, 0], [v[0] for v in vals], color=TXT)
ax.set_xlabel("Latencia p95 con 50 usuarios (s)")
ax.set_xlim(0, 17.5)
ax.grid(axis="x", color=GRID, linewidth=0.8); ax.set_axisbelow(True)
titulo(ax, "Punto de quiebre: GET /clientes no pagina sus resultados",
       "Con ~13 mil clientes cada respuesta pesa 8,5 MB y la latencia se multiplica por 40")
guardar(fig, "05_quiebre_volumen.png")

# ---------------------------------------------------------------- 6 tiempos del pipeline
tiempos = json.load(open(os.path.join(EVI, "pipeline", "pipeline-tiempos.json"), encoding="utf-8"))
fig, ax = plt.subplots(figsize=(10, 5))
y = list(range(len(tiempos)))[::-1]
for i, t in zip(y, tiempos):
    ax.barh(i, t["ms"] / 1000, color=DESPUES, height=0.55)
    ax.text(t["ms"] / 1000 + 2, i, f"{t['ms'] / 1000:.0f} s", va="center", fontsize=10, color=TXT)
ax.set_yticks(y, [t["etapa"] for t in tiempos], color=TXT)
ax.set_xlabel("Segundos")
ax.grid(axis="x", color=GRID, linewidth=0.8); ax.set_axisbelow(True)
total = sum(t["ms"] for t in tiempos) / 60000
titulo(ax, f"Pipeline DevSecOps completo ejecutado: {total:.1f} minutos, todos los gates aprobados".replace(".", ","),
       "Ejecución local secuencial en un equipo de desarrollo; en CI las etapas 2 y 3 corren en paralelo")
guardar(fig, "06_pipeline_tiempos.png")

print("Graficos generados en", OUT)
