// Quality gate y generador de reporte para pruebas de carga de Apache JMeter.
// Analiza el archivo results.jtl (CSV generado por JMeter -l results.jtl) y
// verifica los criterios de aceptacion de Atlas:
//   - CRUD 50 usuarios : media < 300 ms, p95 < 300 ms, errores 5xx < 1%
//   - CRUD 200 usuarios: media < 300 ms, p95 < 300 ms, errores 5xx < 1%
//   - Documentos       : media <= 10 000 ms, p95 <= 10 000 ms, max <= 10 000 ms, errores 5xx < 1%
//
// Uso:
//   node ev3/automatizacion/carga/jmeter-gate.mjs <results.jtl> [salida.md] [salida.json]

import fs from "node:fs";
import path from "node:path";

const jtlPath = process.argv[2];
const mdPath = process.argv[3] || "jmeter-summary.md";
const jsonPath = process.argv[4] || "jmeter-gate-result.json";

if (!jtlPath || !fs.existsSync(jtlPath)) {
  const msg = `# Apache JMeter — Error\n\nNo se encontro el archivo de resultados JTL: \`${jtlPath || "(no indicado)"}\`\n`;
  fs.mkdirSync(path.dirname(path.resolve(mdPath)), { recursive: true });
  fs.writeFileSync(mdPath, msg, "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify({ aprobado: false, error: "JTL no encontrado" }, null, 2), "utf8");
  console.error(msg);
  process.exit(1);
}

// Parser CSV compatible con campos entrecomillados en results.jtl
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const rawLines = fs.readFileSync(jtlPath, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
if (rawLines.length < 2) {
  const msg = "# Apache JMeter — Error\n\nEl archivo `results.jtl` no contiene muestras ejecutadas.\n";
  fs.writeFileSync(mdPath, msg, "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify({ aprobado: false, error: "Sin muestras" }, null, 2), "utf8");
  console.error(msg);
  process.exit(1);
}

const headers = parseCsvLine(rawLines[0]);
const idx = (name) => headers.indexOf(name);
const iElapsed = idx("elapsed");
const iLabel = idx("label");
const iCode = idx("responseCode");
const iSuccess = idx("success");

if (iElapsed < 0 || iLabel < 0 || iCode < 0 || iSuccess < 0) {
  console.error("Cabeceras JTL inesperadas:", headers);
  process.exit(1);
}

const muestras = rawLines.slice(1).map((line) => {
  const cols = parseCsvLine(line);
  const code = String(cols[iCode] || "").trim();
  return {
    elapsed: Number(cols[iElapsed]) || 0,
    label: String(cols[iLabel] || ""),
    code,
    is5xx: /^5\d\d$/.test(code),
    success: String(cols[iSuccess]).toLowerCase() === "true",
  };
});

function calcularStats(rows) {
  const n = rows.length;
  if (n === 0) {
    return { count: 0, mean: 0, p95: 0, max: 0, min: 0, errors: 0, errorPct: 0, errors5xx: 0, pct5xx: 0 };
  }
  const sorted = rows.map((r) => r.elapsed).sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
  const min = sorted[0];
  const max = sorted[n - 1];
  const errors = rows.filter((r) => !r.success).length;
  const errors5xx = rows.filter((r) => r.is5xx).length;
  return {
    count: n,
    mean: Number(mean.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    errors,
    errorPct: Number(((errors / n) * 100).toFixed(2)),
    errors5xx,
    pct5xx: Number(((errors5xx / n) * 100).toFixed(2)),
  };
}

const ESCENARIOS = [
  {
    id: "SETUP",
    nombre: "Preparación (Login + Cliente base)",
    prefijo: "[SETUP]",
    evaluar: (s) => {
      const fallos = [];
      if (s.count < 2) fallos.push(`muestras insuficientes (${s.count} < 2)`);
      if (s.errors > 0) fallos.push(`${s.errors} error(es) en setup`);
      return fallos;
    },
    criterioTexto: "Login y creación de cliente base sin errores",
  },
  {
    id: "CRUD-50",
    nombre: "CRUD 50 usuarios",
    prefijo: "[CRUD-50]",
    evaluar: (s) => {
      const fallos = [];
      if (s.count === 0) fallos.push("sin muestras ejecutadas");
      if (s.mean >= 300) fallos.push(`media ${s.mean} ms >= 300 ms`);
      if (s.p95 >= 300) fallos.push(`p95 ${s.p95} ms >= 300 ms`);
      if (s.pct5xx >= 1) fallos.push(`errores 5xx ${s.pct5xx}% >= 1%`);
      if (s.errorPct >= 1) fallos.push(`errores totales ${s.errorPct}% >= 1%`);
      return fallos;
    },
    criterioTexto: "Media < 300 ms, p95 < 300 ms, 5xx < 1%",
  },
  {
    id: "CRUD-200",
    nombre: "CRUD 200 usuarios",
    prefijo: "[CRUD-200]",
    evaluar: (s) => {
      const fallos = [];
      if (s.count === 0) fallos.push("sin muestras ejecutadas");
      if (s.mean >= 300) fallos.push(`media ${s.mean} ms >= 300 ms`);
      if (s.p95 >= 300) fallos.push(`p95 ${s.p95} ms >= 300 ms`);
      if (s.pct5xx >= 1) fallos.push(`errores 5xx ${s.pct5xx}% >= 1%`);
      return fallos;
    },
    criterioTexto: "Media < 300 ms, p95 < 300 ms, 5xx < 1%",
  },
  {
    id: "DOCS",
    nombre: "Documentos (subida/descarga PDF)",
    prefijo: "[DOCS]",
    evaluar: (s) => {
      const fallos = [];
      if (s.count === 0) fallos.push("sin muestras ejecutadas");
      if (s.mean > 10000) fallos.push(`media ${s.mean} ms > 10 000 ms`);
      if (s.p95 > 10000) fallos.push(`p95 ${s.p95} ms > 10 000 ms`);
      if (s.max > 10000) fallos.push(`máximo ${s.max} ms > 10 000 ms`);
      if (s.pct5xx >= 1) fallos.push(`errores 5xx ${s.pct5xx}% >= 1%`);
      if (s.errorPct >= 1) fallos.push(`errores totales ${s.errorPct}% >= 1%`);
      return fallos;
    },
    criterioTexto: "Tiempo <= 10 000 ms (media, p95, máx), 5xx < 1%",
  },
];

const resultadosEscenarios = ESCENARIOS.map((esc) => {
  const rows = muestras.filter((m) => m.label.startsWith(esc.prefijo));
  const stats = calcularStats(rows);
  const fallos = esc.evaluar(stats);
  return {
    id: esc.id,
    nombre: esc.nombre,
    criterio: esc.criterioTexto,
    aprobado: fallos.length === 0,
    fallos,
    stats,
  };
});

// Desglose por etiqueta (endpoint)
const labelsUnicos = [...new Set(muestras.map((m) => m.label))];
const desgloseEndpoints = labelsUnicos.map((label) => ({
  label,
  ...calcularStats(muestras.filter((m) => m.label === label)),
}));

const aprobadoGlobal = resultadosEscenarios.every((r) => r.aprobado);

const md = [
  "# Apache JMeter — Resultados de Pruebas de Carga",
  "",
  `**Veredicto del Gate:** ${aprobadoGlobal ? "✅ APROBADO" : "❌ RECHAZADO"}`,
  `**Total de muestras procesadas:** ${muestras.length}`,
  "",
  "## Evaluación por Escenario",
  "",
  "| Escenario | Muestras | Media (ms) | p95 (ms) | Máx (ms) | Errores 5xx | Error total | Criterio | Estado |",
  "|---|---:|---:|---:|---:|---:|---:|---|---|",
  ...resultadosEscenarios.map((r) => {
    const s = r.stats;
    const estado = r.aprobado ? "✅ OK" : `❌ FALLA (${r.fallos.join("; ")})`;
    return `| ${r.nombre} | ${s.count} | ${s.mean} | ${s.p95} | ${s.max} | ${s.errors5xx} (${s.pct5xx}%) | ${s.errors} (${s.errorPct}%) | ${r.criterio} | ${estado} |`;
  }),
  "",
  "## Desglose por Endpoint",
  "",
  "| Endpoint | Muestras | Media (ms) | p95 (ms) | Máx (ms) | 5xx | Errores |",
  "|---|---:|---:|---:|---:|---:|---:|",
  ...desgloseEndpoints.map(
    (e) => `| \`${e.label}\` | ${e.count} | ${e.mean} | ${e.p95} | ${e.max} | ${e.errors5xx} (${e.pct5xx}%) | ${e.errors} (${e.errorPct}%) |`
  ),
  "",
].join("\n");

fs.mkdirSync(path.dirname(path.resolve(mdPath)), { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(jsonPath)), { recursive: true });
fs.writeFileSync(mdPath, md, "utf8");
fs.writeFileSync(
  jsonPath,
  JSON.stringify({ aprobado: aprobadoGlobal, totalMuestras: muestras.length, escenarios: resultadosEscenarios, endpoints: desgloseEndpoints }, null, 2),
  "utf8"
);

console.log(md);
process.exit(aprobadoGlobal ? 0 : 1);
