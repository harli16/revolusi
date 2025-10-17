import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { socket } from "../utils/socket";

const AuthContext = createContext();

// Ambil base URL dari .env
const API_URL = import.meta.env.VITE_API_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(
    localStorage.getItem("user")
      ? JSON.parse(localStorage.getItem("user"))
      : null
  );
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);

  // ========================
  // LOGIN
  // ========================
  const login = async (username, password) => {
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        username,
        password,
      });

      console.log("Login response:", res.data);

      if (res.data.ok) {
        const userData = {
          id: res.data.user.id || res.data.user._id,
          username: res.data.user.username,
          role: res.data.user.role,
          isOnline: res.data.user.isOnline,
          lastActive: res.data.user.lastActive,
          photo: res.data.user.photo || null,
        };

        setUser(userData);
        setToken(res.data.token);

        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(userData));

        // 🔥 connect socket & join room
        socket.connect();
        // socket.emit("join", userData.id);
        console.log("✅ Joined socket room:", userData.id);

        return true;
      }
      return false;
    } catch (err) {
      console.error("Login error:", err.response?.data || err.message);
      return false;
    }
  };

  // ========================
  // FETCH USER
  // ========================
  const fetchUser = async () => {
    if (!token) return;

    try {
      const res = await axios.get(`${API_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("Fetch user response:", res.data);

      if (res.data.ok) {
        const userData = {
          id: res.data.user._id,
          username: res.data.user.username,
          role: res.data.user.role,
          isOnline: res.data.user.isOnline,
          lastActive: res.data.user.lastActive,
          photo: res.data.user.photo || null,
        };

        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));

        // 🔥 pastikan socket join kalau refresh / reload
        socket.connect();
        // socket.emit("join", userData.id);
        console.log("✅ Joined socket room:", userData.id);
      }
    } catch (err) {
      console.error("Fetch user error:", err.response?.data || err.message);
    }
  };

  // ========================
  // LOGOUT
  // ========================
  const logout = async () => {
    try {
      if (user && token) {
        await axios.post(
          `${API_URL}/api/auth/logout`,
          { userId: user.id },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      }
    } catch (err) {
      console.error("Logout API error:", err.response?.data || err.message);
    }

    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // 🔥 disconnect socket biar bersih
    socket.disconnect();
    console.log("❌ Socket disconnected after logout");
  };

  // ========================
  // AUTO FETCH USER setiap kali ada token
  // ========================
  useEffect(() => {
    if (token) {
      fetchUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, fetchUser, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);