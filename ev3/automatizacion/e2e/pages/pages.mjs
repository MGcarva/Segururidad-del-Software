// Page Object Model (POM) de Atlas. Cada pagina encapsula sus selectores y
// acciones; si cambia la interfaz solo se actualiza este archivo y no las
// pruebas (mantenibilidad, PPT 3.3.1 "Patrones de diseño").
import { By, until } from "selenium-webdriver";

const T = 10000;
const tid = (id) => By.css(`[data-testid="${id}"]`);

export class LoginPage {
  constructor(driver, baseUrl) { this.d = driver; this.url = `${baseUrl}/login`; }
  async abrir() { await this.d.get(this.url); await this.d.wait(until.elementLocated(tid("button-login")), T); }
  async ingresar(usuario, clave) {
    await this.d.findElement(tid("input-nombre-usuario")).sendKeys(usuario);
    await this.d.findElement(tid("input-password")).sendKeys(clave);
    await this.d.findElement(tid("button-login")).click();
  }
  async mensajeToast() {
    const el = await this.d.wait(until.elementLocated(By.css("[data-sonner-toast]")), T);
    return el.getText();
  }
}

export class LayoutPage {
  constructor(driver) { this.d = driver; }
  async esperarHome() { await this.d.wait(until.urlContains("/home"), T); }
  async irA(label) {
    await this.d.wait(until.elementLocated(tid(`link-nav-${label}`)), T).click();
  }
  async cerrarSesion() {
    await this.d.wait(until.elementLocated(tid("button-layout-logout")), T).click();
    await this.d.wait(until.urlContains("/login"), T);
  }
}
