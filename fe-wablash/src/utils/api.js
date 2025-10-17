import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // contoh: http://10.10.30.13:3001
  withCredentials: false,
});

// ✅ Interceptor: auto tambah Bearer token + pastikan prefix /api
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // ⛑️ Safety net: kalau URL diawali "/" tapi belum pakai "/api/",
    // kita tambahkan "/api" supaya gak kejadian /chat/unread → 404 lagi.
    if (typeof config.url === "string") {
      if (config.url.startsWith("/") && !config.url.startsWith("/api/")) {
        config.url = `/api${config.url}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
