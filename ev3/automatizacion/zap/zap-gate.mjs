// Quality gate de seguridad para reportes JSON de OWASP ZAP.
// Falla (exit 1) si existe alguna alerta de riesgo Alto, o de riesgo Medio que
// no este en la lista de riesgos aceptados formalmente (zap-riesgos-aceptados.json).
//
//   node zap-gate.mjs reporte1.json [reporte2.json ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const aceptados = JSON.parse(fs.readFileSync(path.join(dir, "zap-riesgos-aceptados.json"), "utf8"));
const RIESGO = { 3: "ALTO", 2: "MEDIO", 1: "BAJO", 0: "INFO" };

let bloqueantes = 0;
for (const archivo of process.argv.slice(2)) {
  const reporte = JSON.parse(fs.readFileSync(archivo, "utf8"));
  console.log(`\n# ${path.basename(archivo)}`);
  for (const sitio of reporte.site || []) {
    for (const a of sitio.alerts || []) {
      const riesgo = Number(a.riskcode);
      const acept = aceptados[a.pluginid];
      let estado = "ok";
      if (riesgo >= 3 || (riesgo === 2 && !acept)) { estado = "BLOQUEA"; bloqueantes++; }
      else if (acept) estado = `aceptado: ${acept.justificacion}`;
      console.log(`  [${RIESGO[riesgo].padEnd(5)}] ${a.alert} (${a.pluginid}) x${a.count} -> ${estado}`);
    }
  }
}
console.log(`\nResultado del gate: ${bloqueantes === 0 ? "APROBADO" : `RECHAZADO (${bloqueantes} alerta(s) bloqueante(s))`}`);
process.exit(bloqueantes === 0 ? 0 : 1);
