// Generador de resumenes Markdown para evidencias de GitHub Actions (artifacts + Step Summary).
// Sin dependencias externas (solo Node 20+).
//
// Subcomandos:
//   node generar-resumen.mjs gitleaks  <gitleaks.json> <out.md>
//   node generar-resumen.mjs npm-audit <backend.json> <frontend.json> <out.md>
//   node generar-resumen.mjs jest      <jest.json> <coverage-summary.json> <eslint.json> <out.md>
//   node generar-resumen.mjs supertest <supertest.json> <api-junit.xml> <out.md>
//   node generar-resumen.mjs selenium  <ide-dir> <e2e-junit.xml> <shots-dir> <out.md>
//   node generar-resumen.mjs sonarqube <measures.json> <issues.json> <qg.json> <modo> <out.md>
//   node generar-resumen.mjs zap       <frontend.json> <backend.json> <gate.txt> <out.md>
//   node generar-resumen.mjs gate      <out.md> <out.json>

import fs from "node:fs";
import path from "node:path";

const [cmd, ...args] = process.argv.slice(2);

function readJsonSafe(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readTextSafe(file) {
  if (!file || !fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8");
}

function writeOut(file, content) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  console.log(content);
}

function parseJunitSummary(xmlText) {
  if (!xmlText) return null;
  const cases = [...xmlText.matchAll(/<testcase\b([^>]*)(?:\/>|>([\s\S]*?)<\/testcase>)/g)];
  if (cases.length === 0) return null;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const detalles = [];
  for (const m of cases) {
    const attrs = m[1] || "";
    const body = m[2] || "";
    const nameMatch = attrs.match(/\bname="([^"]*)"/);
    const name = (nameMatch ? nameMatch[1] : "caso").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    const hasFailure = /<(?:failure|error)\b/.test(body);
    const isSkipped = /<skipped\b/.test(body);
    if (hasFailure) {
      failed++;
      detalles.push({ name, status: "❌ FALLA" });
    } else if (isSkipped) {
      skipped++;
      detalles.push({ name, status: "⏭️ OMITIDO" });
    } else {
      passed++;
      detalles.push({ name, status: "✅ OK" });
    }
  }
  return { total: cases.length, passed, failed, skipped, detalles };
}

function resumenJestJson(data) {
  if (!data) return null;
  const casos = [];
  for (const suite of data.testResults || []) {
    for (const a of suite.assertionResults || []) {
      casos.push({
        suite: path.basename(suite.name || ""),
        name: a.fullName || a.title,
        status: a.status === "passed" ? "✅ OK" : a.status === "pending" ? "⏭️ OMITIDO" : "❌ FALLA",
      });
    }
  }
  return {
    total: data.numTotalTests ?? casos.length,
    passed: data.numPassedTests ?? 0,
    failed: data.numFailedTests ?? 0,
    pending: data.numPendingTests ?? 0,
    success: Boolean(data.success),
    casos,
  };
}

switch (cmd) {
  case "gitleaks": {
    const [reportFile, outFile] = args;
    const findings = readJsonSafe(reportFile);
    const lista = Array.isArray(findings) ? findings : [];
    const lines = [
      "# Gitleaks — Escaneo de Secretos (Historial Git Completo)",
      "",
      `- **Hallazgos detectados:** ${lista.length}`,
      `- **Estado:** ${lista.length === 0 ? "✅ Sin secretos expuestos" : "❌ Se detectaron posibles secretos (valores redactados)"}`,
      "",
    ];
    if (lista.length > 0) {
      lines.push("| Regla | Archivo | Línea | Commit |");
      lines.push("|---|---|---:|---|");
      for (const f of lista.slice(0, 50)) {
        lines.push(`| \`${f.RuleID || "-"}\` | \`${f.File || "-"}\` | ${f.StartLine || "-"} | \`${String(f.Commit || "").slice(0, 7)}\` |`);
      }
      lines.push("");
    }
    writeOut(outFile, lines.join("\n"));
    break;
  }

  case "npm-audit": {
    const [backFile, frontFile, outFile] = args;
    const extraer = (nombre, data) => {
      const v = data?.metadata?.vulnerabilities || {};
      return {
        nombre,
        info: v.info || 0,
        low: v.low || 0,
        moderate: v.moderate || 0,
        high: v.high || 0,
        critical: v.critical || 0,
        total: v.total || 0,
        disponible: Boolean(data),
      };
    };
    const filas = [extraer("BACKEND (producción)", readJsonSafe(backFile)), extraer("FRONTEND (producción)", readJsonSafe(frontFile))];
    const bloqueantes = filas.reduce((acc, f) => acc + f.high + f.critical, 0);
    const lines = [
      "# npm audit — Análisis de Dependencias (SCA)",
      "",
      `- **Política:** Bloquea vulnerabilidades **High** o **Critical** en dependencias de producción (\`--omit=dev\`).`,
      `- **Vulnerabilidades bloqueantes (High + Critical):** ${bloqueantes}`,
      `- **Estado:** ${bloqueantes === 0 && filas.every((f) => f.disponible) ? "✅ APROBADO" : "❌ RECHAZADO"}`,
      "",
      "| Componente | Info | Low | Moderate | High | Critical | Total |",
      "|---|---:|---:|---:|---:|---:|---:|",
      ...filas.map((f) => `| ${f.nombre} | ${f.info} | ${f.low} | ${f.moderate} | ${f.high} | ${f.critical} | ${f.total} |`),
      "",
    ];
    writeOut(outFile, lines.join("\n"));
    break;
  }

  case "jest": {
    const [jestFile, covFile, eslintFile, outFile] = args;
    const j = resumenJestJson(readJsonSafe(jestFile));
    const cov = readJsonSafe(covFile)?.total || null;
    const eslintArr = readJsonSafe(eslintFile);
    const eslintErrors = Array.isArray(eslintArr) ? eslintArr.reduce((a, f) => a + (f.errorCount || 0), 0) : null;
    const eslintWarnings = Array.isArray(eslintArr) ? eslintArr.reduce((a, f) => a + (f.warningCount || 0), 0) : null;

    const lines = [
      "# Jest — Pruebas Unitarias, Cobertura y Calidad Frontend",
      "",
      "## Resumen Jest",
      j
        ? `- **Total:** ${j.total} | **Aprobadas:** ${j.passed} | **Fallidas:** ${j.failed} | **Omitidas:** ${j.pending}`
        : "- ⚠️ No se encontró reporte JSON de Jest.",
      "",
    ];
    if (cov) {
      lines.push("## Cobertura de Código (Módulos de Seguridad)");
      lines.push("| Métrica | Porcentaje | Cubiertas / Total |");
      lines.push("|---|---:|---:|");
      for (const k of ["lines", "statements", "functions", "branches"]) {
        if (cov[k]) lines.push(`| ${k} | ${cov[k].pct}% | ${cov[k].covered} / ${cov[k].total} |`);
      }
      lines.push("");
    }
    if (eslintErrors !== null) {
      lines.push(`## ESLint Frontend`);
      lines.push(`- **Errores:** ${eslintErrors} | **Advertencias:** ${eslintWarnings}`);
      lines.push("");
    }
    if (j && j.casos.length > 0) {
      lines.push("## Casos Ejecutados (Jest)");
      lines.push("| Archivo | Prueba | Estado |");
      lines.push("|---|---|---|");
      for (const c of j.casos) {
        lines.push(`| \`${c.suite}\` | ${c.name.replace(/\|/g, "\\|")} | ${c.status} |`);
      }
      lines.push("");
    }
    writeOut(outFile, lines.join("\n"));
    break;
  }

  case "supertest": {
    const [stFile, apiXmlFile, outFile] = args;
    const st = resumenJestJson(readJsonSafe(stFile));
    const api = parseJunitSummary(readTextSafe(apiXmlFile));
    const lines = [
      "# Supertest + API Seguridad — Pruebas de Integración",
      "",
      "## 1. Jest + Supertest (Integración contra PostgreSQL + API real)",
      st
        ? `- **Total:** ${st.total} | **Aprobadas:** ${st.passed} | **Fallidas:** ${st.failed} | **Omitidas:** ${st.pending}`
        : "- ⚠️ No se encontró reporte JSON de Supertest.",
      "",
    ];
    if (st && st.casos.length > 0) {
      lines.push("| Suite | Caso | Estado |");
      lines.push("|---|---|---|");
      for (const c of st.casos) {
        lines.push(`| \`${c.suite}\` | ${c.name.replace(/\|/g, "\\|")} | ${c.status} |`);
      }
      lines.push("");
    }
    lines.push("## 2. Suite de Seguridad y Funcionalidad API (atlas-api.test.mjs)");
    if (api) {
      lines.push(`- **Total:** ${api.total} | **Aprobadas:** ${api.passed} | **Fallidas:** ${api.failed} | **Omitidas:** ${api.skipped}`);
      lines.push("");
      lines.push("| Caso | Estado |");
      lines.push("|---|---|");
      for (const d of api.detalles) {
        lines.push(`| ${d.name.replace(/\|/g, "\\|")} | ${d.status} |`);
      }
    } else {
      lines.push("- ⚠️ No se encontró reporte JUnit de `atlas-api.test.mjs`.");
    }
    lines.push("");
    writeOut(outFile, lines.join("\n"));
    break;
  }

  case "selenium": {
    const [ideDir, e2eXmlFile, shotsDir, outFile] = args;
    const lines = ["# Selenium — Pruebas E2E (Selenium IDE + Selenium WebDriver)", ""];

    // Selenium IDE (archivos JSON generados por selenium-side-runner --output-format jest)
    lines.push("## 1. Selenium IDE (`atlas-login.side` via `selenium-side-runner`)");
    let ideFiles = [];
    if (ideDir && fs.existsSync(ideDir)) {
      ideFiles = fs.readdirSync(ideDir).filter((f) => f.endsWith(".json"));
    }
    if (ideFiles.length > 0) {
      let total = 0, passed = 0, failed = 0;
      const filas = [];
      for (const f of ideFiles) {
        const d = resumenJestJson(readJsonSafe(path.join(ideDir, f)));
        if (!d) continue;
        total += d.total;
        passed += d.passed;
        failed += d.failed;
        for (const c of d.casos) filas.push(`| ${c.name.replace(/\|/g, "\\|")} | ${c.status} |`);
      }
      lines.push(`- **Total:** ${total} | **Aprobadas:** ${passed} | **Fallidas:** ${failed}`);
      lines.push("");
      if (filas.length > 0) {
        lines.push("| Caso Selenium IDE | Estado |");
        lines.push("|---|---|");
        lines.push(...filas);
      }
    } else {
      lines.push("- ⚠️ No se encontraron reportes JSON de Selenium IDE (revisar `selenium-ide.log`).");
    }
    lines.push("");

    // Selenium WebDriver (POM)
    lines.push("## 2. Selenium WebDriver POM (`atlas-e2e.test.mjs`)");
    const e2e = parseJunitSummary(readTextSafe(e2eXmlFile));
    if (e2e) {
      lines.push(`- **Total:** ${e2e.total} | **Aprobadas:** ${e2e.passed} | **Fallidas:** ${e2e.failed}`);
      lines.push("");
      lines.push("| Caso E2E WebDriver | Estado |");
      lines.push("|---|---|");
      for (const d of e2e.detalles) {
        lines.push(`| ${d.name.replace(/\|/g, "\\|")} | ${d.status} |`);
      }
    } else {
      lines.push("- ⚠️ No se encontró reporte JUnit de Selenium WebDriver.");
    }
    lines.push("");

    if (shotsDir && fs.existsSync(shotsDir)) {
      const pngs = fs.readdirSync(shotsDir).filter((f) => f.endsWith(".png"));
      lines.push(`## 3. Capturas de Pantalla (${pngs.length})`);
      for (const p of pngs) lines.push(`- \`${p}\``);
      lines.push("");
    }
    writeOut(outFile, lines.join("\n"));
    break;
  }

  case "sonarqube": {
    const [measuresFile, issuesFile, qgFile, modo, outFile] = args;
    const measuresData = readJsonSafe(measuresFile);
    const issuesData = readJsonSafe(issuesFile);
    const qgData = readJsonSafe(qgFile);

    const qgStatus = qgData?.projectStatus?.status || "DESCONOCIDO";
    const medidas = {};
    for (const m of measuresData?.component?.measures || []) {
      medidas[m.metric] = m.value;
    }
    const issues = issuesData?.issues || [];

    const lines = [
      "# SonarQube — Análisis Estático de Calidad y Seguridad (SAST)",
      "",
      `- **Modo de ejecución:** ${modo || "N/A"}`,
      `- **Quality Gate:** ${qgStatus === "OK" ? "✅ OK" : `❌ ${qgStatus}`}`,
      `- **Total de issues recuperados:** ${issuesData?.total ?? issues.length}`,
      "",
      "## Métricas Principales",
      "",
      "| Métrica | Valor |",
      "|---|---:|",
      `| Bugs | ${medidas.bugs ?? "-"} |`,
      `| Vulnerabilidades | ${medidas.vulnerabilities ?? "-"} |`,
      `| Security Hotspots | ${medidas.security_hotspots ?? "-"} |`,
      `| Code Smells | ${medidas.code_smells ?? "-"} |`,
      `| Security Rating (1=A..5=E) | ${medidas.security_rating ?? "-"} |`,
      `| Reliability Rating (1=A..5=E) | ${medidas.reliability_rating ?? "-"} |`,
      `| Duplicación (%) | ${medidas.duplicated_lines_density ?? "-"} |`,
      `| Líneas de código (ncloc) | ${medidas.ncloc ?? "-"} |`,
      "",
    ];
    if (issues.length > 0) {
      lines.push("## Muestra de Hallazgos (hasta 30)");
      lines.push("| Severidad | Tipo | Regla | Componente | Línea | Mensaje |");
      lines.push("|---|---|---|---|---:|---|");
      for (const i of issues.slice(0, 30)) {
        const comp = String(i.component || "").split(":").pop();
        const msg = String(i.message || "").replace(/\|/g, "\\|");
        lines.push(`| ${i.severity || "-"} | ${i.type || "-"} | \`${i.rule || "-"}\` | \`${comp}\` | ${i.line || "-"} | ${msg} |`);
      }
      lines.push("");
    }
    writeOut(outFile, lines.join("\n"));
    break;
  }

  case "zap": {
    const [frontFile, backFile, gateTxtFile, outFile] = args;
    const contar = (nombre, data) => {
      const c = { nombre, alto: 0, medio: 0, bajo: 0, info: 0, disponible: Boolean(data) };
      for (const s of data?.site || []) {
        for (const a of s.alerts || []) {
          const r = Number(a.riskcode);
          if (r >= 3) c.alto++;
          else if (r === 2) c.medio++;
          else if (r === 1) c.bajo++;
          else c.info++;
        }
      }
      return c;
    };
    const filas = [contar("Frontend (ZAP Baseline pasivo)", readJsonSafe(frontFile)), contar("Backend (ZAP API Scan OpenAPI)", readJsonSafe(backFile))];
    const gateTxt = readTextSafe(gateTxtFile).trim();
    const lines = [
      "# OWASP ZAP — Pruebas Dinámicas de Seguridad (DAST)",
      "",
      "| Objetivo | Alto | Medio | Bajo | Info |",
      "|---|---:|---:|---:|---:|",
      ...filas.map((f) => `| ${f.nombre} | ${f.alto} | ${f.medio} | ${f.bajo} | ${f.info} |`),
      "",
      "## Salida del Quality Gate (`zap-gate.mjs`)",
      "```text",
      gateTxt || "(sin salida registrada)",
      "```",
      "",
    ];
    writeOut(outFile, lines.join("\n"));
    break;
  }

  case "gate": {
    const [outMd, outJson] = args;
    const jobs = [
      { id: "gitleaks", nombre: "1 · Gitleaks (Secretos)", estado: process.env.RES_GITLEAKS || "unknown" },
      { id: "npm-audit", nombre: "2 · npm audit (SCA)", estado: process.env.RES_NPM_AUDIT || "unknown" },
      { id: "jest-unitarias", nombre: "3 · Jest (Unitarias + Cobertura)", estado: process.env.RES_JEST || "unknown" },
      { id: "supertest-integracion", nombre: "4 · Supertest (Integración API + BD)", estado: process.env.RES_SUPERTEST || "unknown" },
      { id: "selenium-e2e", nombre: "5 · Selenium (IDE + WebDriver E2E)", estado: process.env.RES_SELENIUM || "unknown" },
      { id: "sonarqube", nombre: "6 · SonarQube (SAST + Quality Gate)", estado: process.env.RES_SONARQUBE || "unknown" },
      { id: "owasp-zap", nombre: "7 · OWASP ZAP (DAST + Gate)", estado: process.env.RES_ZAP || "unknown" },
      { id: "apache-jmeter", nombre: "8 · Apache JMeter (Carga CRUD + Docs)", estado: process.env.RES_JMETER || "unknown" },
    ];
    const icono = (st) => (st === "success" ? "✅ success" : st === "failure" ? "❌ failure" : st === "cancelled" ? "🚫 cancelled" : st === "skipped" ? "⏭️ skipped" : `⚠️ ${st}`);
    const fallidos = jobs.filter((j) => j.estado !== "success");
    const aprobado = fallidos.length === 0;

    const lines = [
      "# Gate de Calidad Final — Pipeline DevSecOps Atlas",
      "",
      `**Veredicto global:** ${aprobado ? "✅ APROBADO — Todos los controles pasaron; se habilita la continuación del flujo." : `❌ RECHAZADO — ${fallidos.length} job(s) no aprobaron (fallidos u omitidos); se bloquea el despliegue y cualquier pipeline posterior.`}`,
      "",
      "| Job | Estado |",
      "|---|---|",
      ...jobs.map((j) => `| ${j.nombre} | ${icono(j.estado)} |`),
      "",
    ];
    if (!aprobado) {
      lines.push("## Jobs que bloquearon el pipeline");
      for (const f of fallidos) lines.push(`- **${f.nombre}** (\`${f.estado}\`)`);
      lines.push("");
    }
    writeOut(outMd, lines.join("\n"));
    fs.mkdirSync(path.dirname(path.resolve(outJson)), { recursive: true });
    fs.writeFileSync(outJson, JSON.stringify({ aprobado, totalJobs: jobs.length, fallidos: fallidos.length, jobs }, null, 2), "utf8");
    process.exit(aprobado ? 0 : 1);
  }

  default:
    console.error(`Subcomando no reconocido: ${cmd}`);
    process.exit(2);
}
