// Pruebas E2E automatizadas con Selenium WebDriver (Chrome headless) sobre el
// frontend de Atlas. Equivalen a los flujos grabados en Selenium IDE
// (atlas-login.side) pero exportados a codigo para ejecutarse en CI/CD.
//
//   cd ev3/automatizacion/e2e && npm install && npm test
//   FRONT_URL=http://localhost:3350 USUARIO=admin CLAVE=admin npm test
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Builder, until, By } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { LoginPage, LayoutPage } from "./pages/pages.mjs";

const FRONT = process.env.FRONT_URL || "http://localhost:3350";
const USUARIO = process.env.USUARIO || "admin";
const CLAVE = process.env.CLAVE || "admin";
const SHOTS = process.env.SHOTS_DIR || path.resolve("../../evidencias/e2e");
fs.mkdirSync(SHOTS, { recursive: true });

let driver, login, layout;

before(async () => {
  const opts = new chrome.Options().addArguments("--headless=new", "--window-size=1366,850", "--no-sandbox");
  driver = await new Builder().forBrowser("chrome").setChromeOptions(opts).build();
  login = new LoginPage(driver, FRONT);
  layout = new LayoutPage(driver);
});

after(async () => { await driver?.quit(); });

async function captura(nombre) {
  fs.writeFileSync(path.join(SHOTS, `${nombre}.png`), await driver.takeScreenshot(), "base64");
}

afterEach(async () => {
  await driver.executeScript("window.localStorage.clear(); window.sessionStorage.clear();");
});

test("E2E-01 [RF-1.1] Login valido redirige al panel de inicio", async () => {
  await login.abrir();
  await login.ingresar(USUARIO, CLAVE);
  await layout.esperarHome();
  await captura("E2E-01_login_valido");
  assert.match(await driver.getCurrentUrl(), /\/home/);
});

test("E2E-02 [NFR-SEG] Login invalido muestra mensaje generico y no da acceso", async () => {
  await login.abrir();
  await login.ingresar(USUARIO, "clave-incorrecta");
  const msg = await login.mensajeToast();
  await captura("E2E-02_login_invalido");
  assert.match(msg, /Credenciales inv[aá]lidas/);
  assert.match(await driver.getCurrentUrl(), /\/login/);
});

test("E2E-03 [RF-1.3] Una ruta protegida sin sesion redirige al login", async () => {
  await driver.get(`${FRONT}/clientes`);
  await driver.wait(until.urlContains("/login"), 10000);
  await captura("E2E-03_ruta_protegida");
  assert.match(await driver.getCurrentUrl(), /\/login/);
});

test("E2E-04 [RF-3.2] Usuario autenticado navega al listado de clientes", async () => {
  await login.abrir();
  await login.ingresar(USUARIO, CLAVE);
  await layout.esperarHome();
  await layout.irA("clientes");
  await driver.wait(until.urlContains("/clientes"), 10000);
  await driver.wait(until.elementLocated(By.css("table")), 10000);
  await captura("E2E-04_listado_clientes");
});

test("E2E-05 [RF-1.2] Cerrar sesion devuelve al login y bloquea el regreso", async () => {
  await login.abrir();
  await login.ingresar(USUARIO, CLAVE);
  await layout.esperarHome();
  await layout.cerrarSesion();
  await driver.get(`${FRONT}/home`);
  await driver.wait(until.urlContains("/login"), 10000);
  await captura("E2E-05_logout");
  assert.match(await driver.getCurrentUrl(), /\/login/);
});
