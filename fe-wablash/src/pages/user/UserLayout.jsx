import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Send,
  History,
  Database,
  FileText,
  HelpCircle,
  UserCircle,
  LogOut,
  MessageCircle,
  Users,
  Smartphone,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { socket } from "../../utils/socket";
import axios from "axios";

export default function UserLayout() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { logout, user, token } = useAuth();
  const navigate = useNavigate();

  // 🔥 WA status
  const [waConnected, setWaConnected] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);

  const navClass = ({ isActive }) =>
    `block p-2 rounded transition ${
      isActive
        ? "bg-indigo-100 text-indigo-700 font-semibold"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // klik di luar dropdown → tutup
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==========================
  // WA Status + Socket Events
  // ==========================
  useEffect(() => {
    if (!token) return;

    const API_URL = import.meta.env.VITE_API_URL;

    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/wa/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.ok) {
          setWaConnected(res.data.connected);
          if (!res.data.connected) {
            try {
              // 🔥 Panggil connect untuk trigger startSession (generate QR)
              await axios.post(
                `${API_URL}/api/wa/connect`,
                {},
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              );

              // Ambil QR setelah connect
              const qrRes = await axios.get(`${API_URL}/api/wa/qr.png`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: "blob",
              });
              const url = URL.createObjectURL(qrRes.data);
              setQrUrl(url);
            } catch (err) {
              console.error("Gagal ambil QR:", err);
              setQrUrl(null);
            }
          } else {
            setQrUrl(null);
          }
        }
      } catch (err) {
        console.error("Gagal cek WA status:", err);
      }
    };

    fetchStatus();

    // ✅ join socket room
    // socket.emit("join", user?.id);

    // ✅ listen event QR & ready
    socket.on("wa:qr", () => {
      // QR baru bisa langsung diambil dari endpoint
      setQrUrl(`${API_URL}/api/wa/qr.png?t=${Date.now()}`);
      setWaConnected(false);
    });

    socket.on("wa:ready", () => {
      setWaConnected(true);
      setQrUrl(null);
    });

    return () => {
      socket.off("wa:qr");
      socket.off("wa:ready");
    };
  }, [token, user?.id]);
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 dark:border-gray-700/30 p-4">
        <h2 className="text-indigo-600 font-bold text-xl mb-6 text-center">
          DyaVan Message
        </h2>
        <nav className="space-y-2">
          <NavLink to="/user/dashboard" end className={navClass}>
            <LayoutDashboard className="w-4 h-4 inline mr-2" /> Dashboard
          </NavLink>

          <div className="mt-4 mb-2 px-2 text-xs uppercase text-gray-400">
            Komunikasi
          </div>
          <NavLink to="/user/kirim-pesan" className={navClass}>
            <Send className="w-4 h-4 inline mr-2" /> Kirim Pesan
          </NavLink>
          <NavLink to="/user/log-pengiriman" className={navClass}>
            <History className="w-4 h-4 inline mr-2" /> Log Pengiriman
          </NavLink>
          <NavLink to="/user/contacts" className={navClass}>
            <Users className="w-4 h-4 inline mr-2" /> Kontak
          </NavLink>
          <NavLink to="/user/livechat" className={navClass}>
            <MessageCircle className="w-4 h-4 inline mr-2" /> Live Chat
          </NavLink>

          <div className="mt-4 mb-2 px-2 text-xs uppercase text-gray-400">
            Data & Tools
          </div>
          <NavLink to="/user/database" className={navClass}>
            <Database className="w-4 h-4 inline mr-2" /> Database Siswa
          </NavLink>
          <NavLink to="/user/template-pesan" className={navClass}>
            <FileText className="w-4 h-4 inline mr-2" /> Template Pesan
          </NavLink>

          <div className="mt-4 mb-2 px-2 text-xs uppercase text-gray-400">
            User
          </div>
          <NavLink to="/user/profil" className={navClass}>
            <UserCircle className="w-4 h-4 inline mr-2" /> Profil Saya
          </NavLink>
          <NavLink to="/user/bantuan" className={navClass}>
            <HelpCircle className="w-4 h-4 inline mr-2" /> Bantuan
          </NavLink>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between relative">
          <h1 className="text-xl font-semibold flex items-center gap-3">
            User Panel
            <span
              className={`flex items-center gap-1 text-sm px-2 py-1 rounded ${
                waConnected
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              {waConnected ? "WA Terhubung" : "WA Belum Scan"}
            </span>
          </h1>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((s) => !s)}
              className="flex items-center focus:outline-none"
            >
              {user?.photo ? (
                <img
                  src={user.photo}
                  alt="avatar"
                  className="w-10 h-10 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white font-bold">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </div>
              )}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* Popup QR kalau belum scan */}
      {!waConnected && qrUrl && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg text-center relative w-[320px]">
            {/* Tombol X */}
            <button
              onClick={() => setQrUrl(null)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>

            <h2 className="text-lg font-semibold mb-4">
              Scan QR WhatsApp Anda
            </h2>
            <img
              src={qrUrl}
              alt="QR WhatsApp"
              className="mx-auto w-64 h-64 rounded border"
            />
            <p className="text-sm text-gray-500 mt-2">
              Gunakan aplikasi WhatsApp di HP Anda untuk scan QR ini
            </p>

            {/* Tombol Kembali */}
            <button
              onClick={() => setQrUrl(null)}
              className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Kembali
            </button>
          </div>
        </div>
      )}
    </div>
  );
}