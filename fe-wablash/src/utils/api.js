import axios from "axios";

// bikin instance axios dengan baseURL dari .env FE
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // otomatis pakai VITE_API_URL dari .env
  withCredentials: false,
});

export default api;
