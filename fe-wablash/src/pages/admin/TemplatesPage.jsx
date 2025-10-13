import React, { useEffect, useState } from "react";
import {
  Loader2,
  Search,
  User,
  ChevronLeft,
  FileText,
  ChevronRight,
  Check,
  CheckCheck,
  Clock,
  XCircle,
} from "lucide-react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

// 🟢 Status Pesan (identik dengan LogPengiriman user)
const StatusBadge = ({ status }) => {
  switch (status) {
    case "read":
      return (
        <span className="flex items-center justify-center gap-1 bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full w-fit mx-auto">
          <CheckCheck className="w-3.5 h-3.5 text-orange-600" /> Terkirim
        </span>
      );
    case "played":
      return (
        <span className="flex items-center justify-center gap-1 bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full w-fit mx-auto">
          <CheckCheck className="w-3.5 h-3.5 text-blue-600" /> Dibaca
        </span>
      );
    case "sent":
    case "delivered":
      return (
        <span className="flex items-center justify-center gap-1 bg-green-100 text-green-800 px-2.5 py-1 rounded-full w-fit mx-auto">
          <Check className="w-3.5 h-3.5 text-green-600" /> Terkirim
        </span>
      );
    case "failed":
      return (
        <span className="flex items-center justify-center gap-1 bg-red-100 text-red-800 px-2.5 py-1 rounded-full w-fit mx-auto">
          <XCircle className="w-3.5 h-3.5 text-red-600" /> Gagal
        </span>
      );
    default:
      return (
        <span className="flex items-center justify-center gap-1 bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full w-fit mx-auto">
          <Clock className="w-3.5 h-3.5 text-gray-600" /> Belum Sampai
        </span>
      );
  }
};

export default function TemplateGlobalPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  // === Ambil semua presenter (blast users)
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/blast-users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setUsers(res.data.users);
    } catch (err) {
      console.error("❌ Gagal ambil data presenter:", err);
    } finally {
      setLoading(false);
    }
  };

  // === Ambil log pengiriman milik user
  const fetchUserLogs = async (user) => {
    setSelectedUser(user);
    setLoading(true);
    try {
      const res = await api.get(`/api/admin/user/${user.userId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) {
        // backend baru kirim { ok: true, logs: [...] }
        setLogs(res.data.logs || []);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error("❌ Gagal ambil log user:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchUsers();
  }, [token]);

  // === Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-80 text-gray-500 bg-gray-50">
        <Loader2 className="animate-spin mr-3" /> Memuat data...
      </div>
    );
  }

  // === Detail Log per User
  if (selectedUser) {
    const filteredLogs = logs.filter(
      (l) =>
        (l.contactName || "")
          .toLowerCase()
          .includes(filter.toLowerCase()) ||
        (l.waNumber || "").includes(filter)
    );

    return (
      <div className="p-6 md:p-10 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setSelectedUser(null)}
            className="flex items-center gap-2 px-4 py-2 mb-6 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            <ChevronLeft size={16} /> Kembali ke Daftar Presenter
          </button>

          <div className="bg-white p-6 rounded-xl shadow">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Riwayat Blast</h1>
                <p className="text-gray-500 mt-1">
                  Presenter:{" "}
                  <span className="font-semibold text-blue-600">
                    {selectedUser.username}
                  </span>
                </p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari nama calon mahasiswa / nomor WA..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <p className="text-center text-gray-500 italic py-10">
                Tidak ada data log untuk pengguna ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                    <tr>
                      <th className="p-3 font-semibold">Tanggal Blast</th>
                      <th className="p-3 font-semibold">Nama & Nomor WA</th>
                      <th className="p-3 font-semibold">Asal Sekolah</th>
                      <th className="p-3 font-semibold">Kelas</th>
                      <th className="p-3 font-semibold">Tahun Lulus</th>
                      <th className="p-3 font-semibold">Isi Pesan</th>
                      <th className="p-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredLogs.map((log, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-700">
                          {new Date(log.createdAt).toLocaleString("id-ID")}
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-gray-900">{log.contactName || "-"}</p>
                          <p className="text-xs text-gray-500">
                            {log.to ? "+" + log.to.replace(/^0/, "62") : "-"}
                          </p>
                        </td>
                        <td className="p-3 text-gray-700">
                          {log.school || "-"}
                        </td>
                        <td className="p-3 text-gray-700">
                          {log.kelas || "-"}
                        </td>
                        <td className="p-3 text-gray-700">
                          {log.tahunLulus || "-"}
                        </td>
                        <td
                          className="p-3 text-gray-700 max-w-xs truncate"
                          title={log.message}
                        >
                          {log.message || "-"}
                        </td>
                        <td className="p-3 text-center">
                          <StatusBadge status={log.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === Daftar Presenter (User)
  return (
    <div className="p-6 md:p-10 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Log Pengiriman User
        </h1>
        <p className="text-gray-600 mb-8">
          Pilih presenter untuk melihat riwayat log pengirimannya.
        </p>

        {users.length === 0 ? (
          <div className="text-center bg-white rounded-lg shadow p-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Tidak Ada Log
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Belum ada aktivitas blast dari presenter manapun.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {users.map((u) => {
              const totalLog = u.campaignCount || u.totalSent || 0;
              return (
                <div
                  key={u.userId}
                  onClick={() => fetchUserLogs(u)}
                  className="group bg-white border border-gray-200 hover:border-purple-500 hover:shadow-md cursor-pointer rounded-xl p-5 transition-all duration-200"
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 flex items-center justify-center rounded-full">
                        <User className="text-purple-600 w-5 h-5" />
                      </div>
                      <h2 className="font-semibold text-gray-800">
                        {u.username}
                      </h2>
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-purple-500 transition-transform group-hover:translate-x-1" />
                  </div>
                  <hr className="border-gray-100 my-2" />
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">Total Log Pengiriman</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {totalLog}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
