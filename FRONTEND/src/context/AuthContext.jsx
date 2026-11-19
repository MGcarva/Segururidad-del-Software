import { useEffect, useMemo, useState } from "react";
import { api, setAuthToken } from "../lib/api";
import { AuthContext } from "./authContextInstance";
import { jwtDecode } from "jwt-decode";

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => localStorage.getItem("token") || null
  );
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  });
  const [role, setRole] = useState(
    () => localStorage.getItem("role") || "administrador"
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const login = async ({ nombre_usuario, password }) => {
    setLoading(true);
    try {
      const { data } = await api.post("/autenticacion/login", {
        nombre_usuario,
        password,
      });
      const newToken = data?.token;
      setToken(newToken);
      localStorage.setItem("token", newToken);
      setAuthToken(newToken);
      
      // Decodificar el token JWT usando jwt-decode
      let decodedToken = null;
      try {
        decodedToken = jwtDecode(newToken);
      } catch (error) {
        console.error('Error al decodificar JWT:', error);
      }
      
      // Crear objeto user con nombre_usuario y todo el contenido descifrado del token
      const userData = {
        nombre_usuario,
        ...(decodedToken || {})
      };
      
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      // El backend ahora incluye el rol real del usuario en el JWT
      const r = decodedToken?.rol || "editor";
      setRole(r);
      localStorage.setItem("role", r);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Revoca el token en el backend (RF-1.2); no bloqueamos el logout visual si falla
    api.post("/autenticacion/logout").catch(() => {});
    setToken(null);
    setUser(null);
    setRole(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
  };

  const value = useMemo(
    () => ({ token, user, role, setRole, loading, login, logout }),
    [token, user, role, loading]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
