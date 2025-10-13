import { useEffect, useState } from "react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import {
  LogOut,
  SlidersHorizontal,
  RefreshCcw,
  WifiOff,
  Wifi,
  Clock,
  X,
} from "lucide-react";

// ===== Modal Set Kuota =====
function QuotaModal({ open, onClose, user, onSubmit }) {
  const [value, setValue] = useState(user?.quotaDaily || 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-[fadeIn_.25s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50 rounded-t-2xl">
          <h3 className="text-lg font-semibold text-gray-800">
            Set Kuota Harian — {user?.username}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Tentukan jumlah maksimum pesan yang boleh dikirim user ini per hari.
            <br />
            <span className="text-xs text-gray-400">
              (Masukkan <strong>0</strong> untuk <em>Unlimited</em>)
            </span>
          </p>

          <input
            type="number"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            placeholder="Masukkan angka kuota"
            className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
          >
            Batal
          </button>
          <button
            onClick={() => onSubmit(value)}
            className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
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
      <div className="flex justify-center items-center h-64 text-gray-500">
        Memuat data pengguna...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-800">Kontrol Sistem</h3>
        <button
          onClick={() => {
            setRefreshing(true);
            fetchUsers();
          }}
          className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition font-medium shadow-sm ${
            refreshing
              ? "bg-gray-200 text-gray-600"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          <RefreshCcw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total User" value={users.length} color="indigo" />
        <SummaryCard
          label="WA Connected"
          value={users.filter((u) => u.waStatus === "CONNECTED").length}
          color="green"
        />
        <SummaryCard
          label="Queue Aktif"
          value={users.reduce((acc, u) => acc + (u.queueDepth || 0), 0)}
          color="yellow"
        />
        <SummaryCard
          label="User Nonaktif"
          value={users.filter((u) => !u.active).length}
          color="red"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-gray-700 text-left">
              <th className="py-3 px-4">User</th>
              <th>Status WA</th>
              <th>Queue</th>
              <th>Kuota</th>
              <th>Aktif</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u._id}
                className="border-b hover:bg-gray-50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-800">
                  {u.username}
                </td>

                <td className="px-2">
                  <span
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold w-fit ${
                      u.waStatus === "CONNECTED"
                        ? "bg-green-100 text-green-700"
                        : u.waStatus === "QR_READY"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {u.waStatus === "CONNECTED" ? (
                      <Wifi size={14} />
                    ) : u.waStatus === "QR_READY" ? (
                      <Clock size={14} />
                    ) : (
                      <WifiOff size={14} />
                    )}
                    {u.waStatus}
                  </span>
                </td>

                <td className="px-2 text-center">
                  {u.queueDepth > 0 ? (
                    <span className="text-yellow-700 font-semibold">
                      {u.queueDepth} aktif
                    </span>
                  ) : (
                    <span className="text-gray-400">0 (kosong)</span>
                  )}
                </td>

                <td className="px-2 text-center">
                  <span
                    className={`${
                      u.quotaDaily === 0
                        ? "text-gray-400 italic"
                        : "text-indigo-700 font-semibold"
                    }`}
                  >
                    {u.quotaDaily === 0 ? "Unlimited" : u.quotaDaily}
                  </span>
                </td>

                <td className="px-2 text-center">
                  {u.active ? "✅" : "❌"}
                </td>

                <td className="px-2 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() =>
                        action(
                          `/api/admin/users/${u._id}/wa/logout`,
                          "WA session user di-reset (logout)"
                        )
                      }
                      title="Reset / Logout WA"
                      className="p-2 rounded-lg bg-red-100 hover:bg-red-200 transition"
                    >
                      <LogOut size={16} className="text-red-700" />
                    </button>
                    <button
                      onClick={() => handleSetQuota(u)}
                      title="Set Kuota Harian"
                      className="p-2 rounded-lg bg-indigo-100 hover:bg-indigo-200 transition"
                    >
                      <SlidersHorizontal size={16} className="text-indigo-700" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Set Kuota */}
      <QuotaModal
        open={openQuotaModal}
        onClose={() => setOpenQuotaModal(false)}
        user={selectedUser}
        onSubmit={handleSubmitQuota}
      />
    </div>
  );
}

// ===== Komponen kecil =====
function SummaryCard({ label, value, color }) {
  return (
    <div
      className={`bg-${color}-50 border border-${color}-100 p-4 rounded-xl shadow-sm text-center`}
    >
      <p className="text-gray-500 text-sm">{label}</p>
      <p className={`text-2xl font-bold text-${color}-700 mt-1`}>{value}</p>
    </div>
  );
}
