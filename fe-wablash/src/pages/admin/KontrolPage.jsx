// src/pages/admin/KontrolPage.jsx
import React, { useEffect, useState } from "react";
import {
  LogOut,
  SlidersHorizontal,
  RefreshCcw,
  WifiOff,
  Wifi,
  Clock,
  X,
  Users,
  Activity,
  UserX,
  CheckCircle2,
} from "lucide-react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

// ===== Modal Set Kuota =====
function QuotaModal({ open, onClose, user, onSubmit }) {
  const [value, setValue] = useState(user?.quotaDaily || 0);

  useEffect(() => {
    if (user) setValue(user.quotaDaily);
  }, [user]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <h3 className="text-lg font-semibold text-gray-800">
            Atur Kuota Harian —{" "}
            <span className="text-indigo-600">{user?.username}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Tentukan jumlah maksimum pesan yang boleh dikirim oleh user ini per
            hari.
            <br />
            <span className="text-xs text-gray-400">
              Masukkan <strong>0</strong> untuk <em>unlimited</em>.
            </span>
          </p>

          <input
            type="number"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            placeholder="Masukkan angka kuota"
            className="w-full text-lg border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition font-semibold"
          >
            Batal
          </button>
          <button
            onClick={() => onSubmit(value)}
            className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-sm"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Halaman Kontrol Sistem =====
export default function KontrolPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [openQuotaModal, setOpenQuotaModal] = useState(false);

  // === Ambil data user dari API
  const fetchUsers = async () => {
    try {
      const res = await api.get("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setUsers(res.data.data.users);
    } catch (err) {
      console.error("Gagal ambil data users:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 15000);
    return () => clearInterval(interval);
  }, []);

  const action = async (url, msg) => {
    try {
      await api.post(url, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchUsers();
      console.log(msg);
    } catch (err) {
      console.error("Gagal menjalankan aksi:", err);
    }
  };

  const handleSetQuota = (user) => {
    setSelectedUser(user);
    setOpenQuotaModal(true);
  };

  const handleSubmitQuota = async (value) => {
    try {
      await api.patch(
        `/api/users/${selectedUser._id}/quota`,
        { quotaDaily: Number(value) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOpenQuotaModal(false);
      fetchUsers();
    } catch (err) {
      console.error("Gagal set kuota:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96 text-gray-500 bg-gray-50">
        Memuat data pengguna...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Kontrol Sistem
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor dan kelola semua pengguna aktif.
            </p>
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              fetchUsers();
            }}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold shadow-sm border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 transition disabled:opacity-70"
          >
            <RefreshCcw
              size={16}
              className={refreshing ? "animate-spin text-indigo-500" : ""}
            />
            {refreshing ? "Memuat..." : "Refresh Data"}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <SummaryCard
            icon={Users}
            label="Total Pengguna"
            value={users.length}
            color="indigo"
          />
          <SummaryCard
            icon={CheckCircle2}
            label="WA Terhubung"
            value={users.filter((u) => u.waStatus === "CONNECTED").length}
            color="green"
          />
          <SummaryCard
            icon={Activity}
            label="Antrian Aktif"
            value={users.reduce((acc, u) => acc + (u.queueDepth || 0), 0)}
            color="amber"
          />
          <SummaryCard
            icon={UserX}
            label="User Nonaktif"
            value={users.filter((u) => !u.active).length}
            color="rose"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr className="text-gray-600 text-left uppercase text-xs">
                <th className="py-3.5 px-5 font-semibold">User</th>
                <th className="py-3.5 px-3 font-semibold">Status WA</th>
                <th className="py-3.5 px-3 font-semibold">Antrian</th>
                <th className="py-3.5 px-3 font-semibold">Kuota Harian</th>
                <th className="py-3.5 px-3 font-semibold">Status Akun</th>
                <th className="py-3.5 px-5 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr
                  key={u._id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="py-4 px-5 font-medium text-gray-800">
                    {u.username}
                  </td>
                  <td className="px-3">
                    <StatusWBadge status={u.waStatus} />
                  </td>
                  <td className="px-3 font-medium text-gray-700">
                    {u.queueDepth > 0 ? (
                      <span className="text-amber-700">
                        {u.queueDepth} pesan
                      </span>
                    ) : (
                      <span className="text-gray-400">Kosong</span>
                    )}
                  </td>
                  <td className="px-3 font-medium text-gray-700">
                    {u.quotaDaily === 0 ? (
                      <span className="text-gray-400 italic">Unlimited</span>
                    ) : (
                      <span className="text-indigo-700 font-semibold">
                        {u.quotaDaily}
                      </span>
                    )}
                  </td>
                  <td className="px-3">
                    {u.active ? (
                      <span className="text-green-600 font-semibold">
                        Aktif
                      </span>
                    ) : (
                      <span className="text-rose-600 font-semibold">
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <ActionButton
                        icon={LogOut}
                        title="Reset / Logout WA"
                        onClick={() =>
                          action(
                            `/api/admin/users/${u._id}/wa/logout`,
                            "WA session user direset"
                          )
                        }
                        variant="danger"
                      />
                      <ActionButton
                        icon={SlidersHorizontal}
                        title="Set Kuota Harian"
                        onClick={() => handleSetQuota(u)}
                        variant="primary"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Kuota */}
        <QuotaModal
          open={openQuotaModal}
          onClose={() => setOpenQuotaModal(false)}
          user={selectedUser}
          onSubmit={handleSubmitQuota}
        />
      </div>
    </div>
  );
}

// ===== Komponen kecil =====
function SummaryCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <div
      className={`bg-white border p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition ${colorMap[color]}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`p-2.5 rounded-full bg-opacity-20 ${
            colorMap[color].split(" ")[0]
          }`}
        >
          <Icon size={22} />
        </div>
        <p className="text-sm font-medium opacity-80">{label}</p>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function StatusWBadge({ status }) {
  const base =
    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold w-fit";
  if (status === "CONNECTED")
    return (
      <span className={`${base} bg-green-100 text-green-700`}>
        <Wifi size={14} /> Terhubung
      </span>
    );
  if (status === "QR_READY")
    return (
      <span className={`${base} bg-amber-100 text-amber-700`}>
        <Clock size={14} /> Butuh QR
      </span>
    );
  return (
    <span className={`${base} bg-gray-100 text-gray-600`}>
      <WifiOff size={14} /> Terputus
    </span>
  );
}

function ActionButton({ icon: Icon, title, onClick, variant }) {
  const variants = {
    primary: "bg-indigo-100 hover:bg-indigo-200 text-indigo-700",
    danger: "bg-rose-100 hover:bg-rose-200 text-rose-700",
  };
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2.5 rounded-lg transition ${variants[variant]} hover:scale-105`}
    >
      <Icon size={16} />
    </button>
  );
}
