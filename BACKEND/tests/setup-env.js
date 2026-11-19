// Variables de entorno de prueba (no son secretos reales).
process.env.JWT_SECRET = process.env.JWT_SECRET || "clave-de-prueba-unitaria-solo-para-jest-0123456789";
process.env.LOGIN_MAX_FALLOS = "3";
