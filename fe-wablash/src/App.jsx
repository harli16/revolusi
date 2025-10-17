// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { BlastProvider } from "./context/BlastContext";

import Login from "./pages/Login";

// === Layout dan halaman admin ===
import AdminDashboard from "./pages/admin/AdminDashboard"; // ini adalah layout utama admin

// === Layout & halaman user ===
import UserLayout from "./pages/user/UserLayout";
import Dashboard from "./pages/user/Dashboard";
import KirimPesan from "./pages/user/KirimPesan";
import LogPengiriman from "./pages/user/LogPengiriman";
import DatabaseSiswa from "./pages/user/DatabaseSiswa";
import TemplatePesan from "./pages/user/TemplatePesan";
import ProfilSaya from "./pages/user/ProfilSaya";
import Bantuan from "./pages/user/Bantuan";
import LiveChat from "./pages/user/LiveChat";
import Contacts from "./pages/user/Contacts";

export default function App() {
  const { user } = useAuth();

  return (
    <BlastProvider>
      <Routes>
        {/* Login Page */}
        <Route path="/login" element={<Login />} />

        {/* === ADMIN AREA === */}
        <Route
          path="/admin/*"
          element={
            user?.role === "admin" ? (
              <AdminDashboard /> // ✅ ini handle semua halaman admin
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* === USER AREA === */}
        <Route
          path="/user/*"
          element={
            user?.role === "user" ? (
              <UserLayout />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="kirim-pesan" element={<KirimPesan />} />
          <Route path="log-pengiriman" element={<LogPengiriman />} />
          <Route path="database" element={<DatabaseSiswa />} />
          <Route path="template-pesan" element={<TemplatePesan />} />
          <Route path="profil" element={<ProfilSaya />} />
          <Route path="bantuan" element={<Bantuan />} />
          <Route path="livechat" element={<LiveChat />} />
          <Route path="contacts" element={<Contacts />} />
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BlastProvider>
  );
}