// Prueba de carga y estres automatizada (k6) sobre la API de Atlas.
// Escenario "carga": 50 usuarios virtuales sostenidos (NFR-PERF-1: p95 < 300 ms).
// Escenario "estres": rampa hasta 200 usuarios para encontrar el punto de quiebre.
//
//   docker run --rm --network atlas-network -v <ruta>:/scripts grafana/k6 run /scripts/atlas-carga.k6.js
import http from "k6/http";
import { check, sleep } from "k6";

const API = __ENV.API_URL || "http://atlas-backend:4000";

export const options = {
  scenarios: {
    carga: {
      executor: "constant-vus", vus: 50, duration: "30s", tags: { escenario: "carga" },
    },
    estres: {
      executor: "ramping-vus", startTime: "35s", startVUs: 50,
      stages: [
        { duration: "20s", target: 120 },
        { duration: "20s", target: 200 },
        { duration: "10s", target: 0 },
      ],
      tags: { escenario: "estres" },
    },
  },
  thresholds: {
    "http_req_duration{escenario:carga}": ["p(95)<300"],
    "http_req_failed{escenario:carga}": ["rate<0.01"],
    "http_req_failed{escenario:estres}": ["rate<0.05"],
    "http_req_duration{escenario:estres}": ["p(95)<1000"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
};

export function setup() {
  const r = http.post(`${API}/autenticacion/login`,
    JSON.stringify({ nombre_usuario: __ENV.USUARIO || "admin", password: __ENV.CLAVE || "admin" }),
    { headers: { "Content-Type": "application/json" } });
  return { token: r.json("token") };
}

export default function (data) {
  const h = { headers: { Authorization: `Bearer ${data.token}` } };
  const r1 = http.get(`${API}/clientes`, h);
  const r2 = http.get(`${API}/contratos/dashboard`, h);
  check(r1, { "clientes 200": (r) => r.status === 200 });
  check(r2, { "dashboard 200": (r) => r.status === 200 });
  sleep(1);
}
