import axios from "axios";

// bikin instance axios dengan baseURL dari .env FE
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // otomatis pakai VITE_API_URL dari .env
  withCredentials: false,
});

// ✅ Interceptor untuk otomatis tambah Authorization header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // ambil token login dari localStorage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`; // tambahkan ke setiap request
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
