import { useEffect, useState, useMemo } from "react";
import {
  Search,
  User,
  FileText,
  Calendar,
  Target,
  ArrowLeft,
  Sparkles,
  X,
} from "lucide-react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

const statusConfig = {
  Selesai: { color: "green", label: "Selesai" },
  Berjalan: { color: "blue", label: "Berjalan" },
  Dijadwalkan: { color: "yellow", label: "Dijadwalkan" },
  Gagal: { color: "red", label: "Gagal" },
  "Tidak Dikenal": { color: "gray", label: "Tidak Dikenal" },
};

export default function BlastPage() {
  const { token } = useAuth();
  const [view, setView] = useState("users");
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [blasts, setBlasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [blastDetails, setBlastDetails] = useState(null);
  const [blastDetailLoading, setBlastDetailLoading] = useState(false);

  // === Ambil daftar user ===
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/blast-users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setUsers(res.data.users);
    } catch (err) {
      console.error("Gagal ambil data user:", err);
    } finally {
      setLoading(false);
    }
  };

  // === Ambil daftar blast milik user ===
  const fetchUserBlasts = async (user) => {
    setSelectedUser(user);
    setView("blasts");
    setLoading(true);
    try {
      const res = await api.get(`/api/admin/user/${user.userId}/blasts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setBlasts(res.data.blasts);
    } catch (err) {
      console.error("Gagal ambil blast user:", err);
    } finally {
      setLoading(false);
    }
  };

  // === Ambil detail blast ===
  const fetchBlastDetails = async (blastId) => {
    setBlastDetailLoading(true);
    setShowDetailModal(true);
    try {
      const res = await api.get(`/api/admin/blast/${blastId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setBlastDetails(res.data.details);
    } catch (err) {
      console.error("Gagal ambil detail blast:", err);
    } finally {
      setBlastDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter((u) =>
        u.username?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [users, searchTerm]
  );

  const filteredBlasts = useMemo(
    () =>
      blasts
        .filter(
          (blast) => statusFilter === "Semua" || blast.status === statusFilter
        )
        .filter((blast) =>
          blast.campaignName?.toLowerCase().includes(searchTerm.toLowerCase())
        ),
    [blasts, searchTerm, statusFilter]
  );

  const FilterButton = ({ value }) => (
    <button
      onClick={() => setStatusFilter(value)}
      className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
        statusFilter === value
          ? "bg-purple-600 text-white shadow"
          : "bg-white text-gray-600 hover:bg-gray-100"
      }`}
    >
      {value}
    </button>
  );

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setBlastDetails(null);
  };

  // === Modal Target ===
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetDetails, setTargetDetails] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  // === Ambil daftar kontak target blast ===
  const fetchBlastTargets = async (blastId) => {
    setShowTargetModal(true);
    setLoadingTargets(true);
    try {
      const res = await api.get(`/api/admin/blast/${blastId}/targets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setTargetDetails(res.data.targets);
    } catch (err) {
      console.error("Gagal ambil target blast:", err);
    } finally {
      setLoadingTargets(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* === Header === */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">
            {view === "users"
              ? "Daftar Pengguna Blast"
              : `Riwayat Blast (${selectedUser?.username || "-"})`}
          </h1>
          {view === "blasts" && (
            <button
              onClick={() => {
                setView("users");
                setSelectedUser(null);
              }}
              className="flex items-center gap-2 text-purple-600 font-medium hover:text-purple-800"
            >
              <ArrowLeft size={16} /> Kembali
            </button>
          )}
        </div>

        {/* ==================== USERS ==================== */}
        {view === "users" && (
          <>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Cari nama pengguna..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 transition"
              />
            </div>

            {loading ? (
              <p className="text-center text-gray-500 py-20">
                Memuat daftar pengguna...
              </p>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center text-gray-400 py-20 bg-white rounded-xl shadow-sm">
                Tidak ada pengguna.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUsers.map((u) => (
                  <div
                    key={u.userId}
                    className="bg-white p-5 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition"
                  >
                    <div className="flex items-center gap-3">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.username}
                          className="w-12 h-12 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 flex items-center justify-center rounded-full font-bold text-lg text-white shadow-sm"
                          style={{
                            backgroundColor: `hsl(${
                              ((u.username || "X").charCodeAt(0) * 17) % 360
                            }, 70%, 50%)`,
                          }}
                        >
                          {u.username?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}

                      <div>
                        <h2 className="font-bold text-gray-800 text-lg">
                          {u.username || "Tanpa Pemilik"}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {u.campaignCount} Blast
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-4 text-center">
                      <div className="flex-1">
                        <p className="font-bold text-green-600 text-xl">
                          {u.totalSent.toLocaleString("id-ID")}
                        </p>
                        <p className="text-xs text-gray-500">Terkirim</p>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-red-600 text-xl">
                          {u.totalFailed.toLocaleString("id-ID")}
                        </p>
                        <p className="text-xs text-gray-500">Gagal</p>
                      </div>
                    </div>

                    <button
                      onClick={() => fetchUserBlasts(u)}
                      className="mt-5 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm py-2 rounded-lg transition-colors"
                    >
                      Lihat Blast
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================== BLASTS ==================== */}
        {view === "blasts" && (
          <>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
              <div className="relative w-full">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Cari nama Blast..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 transition"
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <FilterButton value="Semua" />
                <FilterButton value="Berjalan" />
                <FilterButton value="Selesai" />
                <FilterButton value="Gagal" />
              </div>
            </div>

            {loading ? (
              <p className="text-center text-gray-500 py-20">
                Memuat riwayat Blast...
              </p>
            ) : filteredBlasts.length === 0 ? (
              <div className="text-center text-gray-400 py-20 bg-white rounded-xl shadow-sm">
                Tidak ada Blast.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBlasts.map((b) => {
                  const config = statusConfig[b.status] || statusConfig["Tidak Dikenal"];
                  const progress =
                    b.targetCount > 0 ? (b.sent / b.targetCount) * 100 : 0;

                  return (
                    <div
                      key={b._id}
                      className="bg-white rounded-xl shadow-md border border-gray-100 flex flex-col hover:shadow-lg transition"
                    >
                      {/* Header */}
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex justify-between items-start">
                          <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                            {b.campaignName}
                            {b.campaignName?.includes("Blast Random") && (
                              <span className="flex items-center gap-1 text-purple-600 text-xs font-semibold bg-purple-50 px-2 py-0.5 rounded-full">
                                <Sparkles size={12} /> Random
                              </span>
                            )}
                          </h2>
                          <span
                            className={`text-${config.color}-600 bg-${config.color}-100 px-3 py-1 text-xs font-bold rounded-full`}
                          >
                            {config.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <Calendar size={13} className="text-gray-400" />
                          {new Date(b.createdAt).toLocaleString("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between text-sm font-medium text-gray-600">
                          <span>Progress</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`bg-${config.color}-500 h-2.5 rounded-full`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center mt-2">
                          <div>
                            <p className="font-bold text-green-600 text-lg">{b.sent}</p>
                            <p className="text-xs text-gray-500">Terkirim</p>
                          </div>
                          <div>
                            <p className="font-bold text-red-600 text-lg">{b.failed}</p>
                            <p className="text-xs text-gray-500">Gagal</p>
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-lg">{b.targetCount}</p>
                            <p className="text-xs text-gray-500">Target</p>
                          </div>
                        </div>
                      </div>

                      {/* Tombol */}
                      <div className="p-4 mt-auto bg-gray-50/50 flex gap-2">
                        <button
                          onClick={() => fetchBlastDetails(b._id)}
                          className="w-1/2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-semibold text-sm py-2 rounded-lg transition"
                        >
                          Lihat Rincian
                        </button>
                        <button
                          onClick={() => fetchBlastTargets(b._id)}
                          className="w-1/2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm py-2 rounded-lg transition"
                        >
                          Lihat Target
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {/* ========== MODAL DETAIL ========== */}
        {showDetailModal && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={closeDetailModal}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {blastDetailLoading ? (
                <p className="text-center text-gray-500 py-12">
                  Memuat detail blast...
                </p>
              ) : blastDetails ? (
                <>
                  <h2 className="text-xl font-bold text-gray-800">
                    Detail Blast: {blastDetails.campaignName}
                  </h2>
                  <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-600 flex items-center gap-2">
                        <FileText size={16} />
                        Isi Pesan
                      </h3>
                      <p className="mt-1 text-sm text-gray-800 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                        {blastDetails.message || "(Tidak ada isi pesan)"}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-600 flex items-center gap-2">
                          <Calendar size={16} />
                          Jadwal
                        </h3>
                        <p
                          onClick={() => fetchBlastTargets(blastDetails._id)}
                          className="mt-1 text-sm text-indigo-600 font-semibold cursor-pointer hover:underline"
                        >
                          {blastDetails.targetCount?.toLocaleString("id-ID")} Kontak
                        </p>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-600 flex items-center gap-2">
                          <Target size={16} />
                          Target
                        </h3>
                        <p className="mt-1 text-sm text-gray-800">
                          {blastDetails.targetCount?.toLocaleString("id-ID")}{" "}
                          Kontak
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500 py-12">
                  Detail blast tidak ditemukan.
                </p>
              )}
            </div>
          </div>
        )}
        {/* ========== MODAL TARGET DETAIL ========== */}
        {showTargetModal && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTargetModal(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  📋 Daftar Kontak Tujuan
                </h2>
                <button
                  onClick={() => setShowTargetModal(false)}
                  className="p-2 rounded-full hover:bg-gray-200 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {loadingTargets ? (
                <p className="text-center text-gray-500 py-12">
                  Memuat daftar kontak...
                </p>
              ) : targetDetails.length === 0 ? (
                <p className="text-center text-gray-400 py-12">
                  Tidak ada data kontak.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                      <tr>
                        <th className="py-3 px-4 text-left">Nama</th>
                        <th className="py-3 px-4 text-left">Nomor WA</th>
                        <th className="py-3 px-4 text-left">Asal Sekolah</th>
                        <th className="py-3 px-4 text-left">Kelas</th>
                        <th className="py-3 px-4 text-left">Tahun Lulus</th>
                        <th className="py-3 px-4 text-left">Isi Pesan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {targetDetails.map((c, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-2 px-4 font-semibold text-gray-800">
                            {c.name || "-"}
                          </td>
                          <td className="py-2 px-4 text-gray-600">
                            {c.waNumber || "-"}
                          </td>
                          <td className="py-2 px-4 text-gray-600">
                            {c.school || "-"}
                          </td>
                          <td className="py-2 px-4 text-gray-600">
                            {c.kelas || "-"}
                          </td>
                          <td className="py-2 px-4 text-gray-600">
                            {c.tahunLulus || "-"}
                          </td>
                          <td className="py-2 px-4 text-gray-700">
                            {c.message || "(tidak ada pesan)"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
