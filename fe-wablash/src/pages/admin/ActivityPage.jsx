import { useEffect, useState } from "react";
import {
  RefreshCcw,
  Wifi,
  WifiOff,
  Send,
  LogIn,
  LogOut,
  Upload,
  AlertCircle,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

// === ICON ACTIVITY ===
const ActivityIcon = ({ type }) => {
  switch (type) {
    case "BLAST_START":
      return <Send className="text-blue-500" size={20} />;
    case "LOGIN":
      return <LogIn className="text-green-500" size={20} />;
    case "LOGOUT":
      return <LogOut className="text-gray-500" size={20} />;
    case "CONTACTS_UPLOAD":
      return <Upload className="text-purple-500" size={20} />;
    case "WA_CONNECTED":
      return <Wifi className="text-green-500" size={20} />;
    case "WA_DISCONNECTED":
      return <WifiOff className="text-red-500" size={20} />;
    default:
      return <AlertCircle className="text-gray-400" size={20} />;
  }
};

// === DESKRIPSI ACTIVITY ===
const ActivityDescription = ({ activity }) => {
  switch (activity.type) {
    case "BLAST_START":
      return (
        <>
          Memulai blast{" "}
          <strong>"{activity.details?.campaignName || "-"}"</strong> ke{" "}
          {activity.details?.contactCount || 0} kontak.
        </>
      );

    case "LOGIN":
      return (
        <>
          Login dari IP{" "}
          <span className="font-mono bg-gray-100 px-1 rounded">
            {activity.details?.ip || "-"}
          </span>
          .
        </>
      );

    case "LOGOUT":
      return <>Logout dari sistem.</>;

    case "CONTACTS_UPLOAD":
      return (
        <>
          Mengunggah <strong>{activity.details?.count || 0} kontak</strong> dari
          file <i>{activity.details?.fileName || "-"}</i>.
        </>
      );

    case "WA_CONNECTED":
      return <>Koneksi WhatsApp berhasil terhubung.</>;

    case "WA_DISCONNECTED":
      return (
        <>
          Koneksi WhatsApp terputus.{" "}
          <span className="text-gray-500">
            ({activity.details?.reason || "Tidak diketahui"})
          </span>
        </>
      );

    default:
      return <>Aktivitas tidak dikenal.</>;
  }
};

// === FORMAT WAKTU RELATIF ===
function formatRelativeTime(date) {
  const now = new Date();
  const diff = (now - new Date(date)) / 1000;
  if (diff < 60) return `${Math.round(diff)} detik yang lalu`;
  if (diff < 3600) return `${Math.round(diff / 60)} menit yang lalu`;
  if (diff < 86400) return `${Math.round(diff / 3600)} jam yang lalu`;
  return `${Math.round(diff / 86400)} hari yang lalu`;
}

// === CARD STAT KECIL ===
const StatCard = ({ icon: Icon, label, value, colorClass }) => (
  <div className="bg-gray-50 p-3 rounded-lg">
    <div
      className={`flex items-center gap-2 text-xs font-semibold text-gray-500`}
    >
      <Icon size={14} className={colorClass} />
      {label}
    </div>
    <p
      className={`text-xl font-bold text-gray-800 mt-1 ${colorClass}`}
    >
      {Number(value || 0).toLocaleString("id-ID")}
    </p>
  </div>
);

export default function ActivityPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivities, setUserActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // === FETCH DATA UTAMA ===
  const fetchData = async () => {
    try {
      const res = await api.get("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setUsers(res.data.data.users);
    } catch (err) {
      console.error("Gagal ambil data aktivitas user:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // === FETCH DETAIL AKTIVITAS PER USER ===
  const fetchUserActivity = async (userId) => {
    setActivityLoading(true);
    try {
      const res = await api.get(`/api/admin/activity/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) {
        const activities = (res.data.activities || []).map((a) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        }));
        setUserActivities(activities);
      } else {
        setUserActivities([]);
      }
    } catch (err) {
      console.error("Gagal ambil detail aktivitas:", err);
      setUserActivities([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const openActivityModal = (user) => {
    setSelectedUser(user);
    setShowActivityModal(true);
    fetchUserActivity(user._id);
  };

  const closeActivityModal = () => {
    setShowActivityModal(false);
    setSelectedUser(null);
    setUserActivities([]);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading)
    return (
      <div className="text-center text-gray-500 py-20">
        Memuat data aktivitas user...
      </div>
    );

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Monitor Aktivitas
            </h1>
            <p className="text-gray-500 mt-1">
              Pantau statistik dan aktivitas pengguna secara real-time.
            </p>
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              fetchData();
            }}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium shadow-sm transition-all duration-200 ${
              refreshing
                ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                : "bg-purple-600 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            }`}
            disabled={refreshing}
          >
            <RefreshCcw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Memperbarui..." : "Perbarui Sekarang"}
          </button>
        </div>

        {/* User Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((u) => (
            <div
              key={u._id}
              className="bg-white rounded-xl shadow-md border border-gray-100 flex flex-col transition-all hover:shadow-lg hover:-translate-y-1"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <p className="font-bold text-gray-800">{u.username}</p>
                <span
                  className={`flex items-center gap-2 px-3 py-1 text-xs font-semibold w-fit rounded-full ${
                    u.waStatus === "CONNECTED"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {u.waStatus === "CONNECTED" ? (
                    <Wifi size={14} />
                  ) : (
                    <WifiOff size={14} />
                  )}
                  {u.waStatus}
                </span>
              </div>

              {/* Stats */}
              <div className="p-4 grid grid-cols-2 gap-4">
                <StatCard
                  icon={TrendingUp}
                  label="Total Pesan"
                  value={u.totalPesan}
                  colorClass="text-blue-600"
                />
                <StatCard
                  icon={CheckCircle}
                  label="Terkirim"
                  value={u.terkirim}
                  colorClass="text-green-600"
                />
                <StatCard
                  icon={XCircle}
                  label="Gagal"
                  value={u.gagal}
                  colorClass="text-red-600"
                />
                <StatCard
                  icon={Clock}
                  label="Antrian"
                  value={u.queueDepth}
                  colorClass="text-yellow-600"
                />
              </div>

              {/* Footer */}
              <div className="p-4 mt-auto">
                <button
                  onClick={() => openActivityModal(u)}
                  className="w-full text-center bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-sm py-2 rounded-lg transition-colors"
                >
                  Lihat Log Aktivitas
                </button>
              </div>
            </div>
          ))}
        </div>

        {users.length === 0 && !loading && (
          <div className="text-center text-gray-400 py-12 bg-white rounded-xl shadow-sm">
            <p>Belum ada aktivitas dari pengguna manapun.</p>
          </div>
        )}

        {/* Modal Detail Aktivitas */}
        {showActivityModal && selectedUser && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={closeActivityModal}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-800">
                Log Aktivitas: {selectedUser.username}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Menampilkan aktivitas terbaru dari pengguna ini.
              </p>

              <div className="border-t border-gray-200 -mx-6">
                {activityLoading ? (
                  <p className="text-center text-gray-500 py-12">
                    Memuat log aktivitas...
                  </p>
                ) : userActivities.length > 0 ? (
                  <ul className="space-y-2 p-6 max-h-[60vh] overflow-y-auto">
                    {userActivities.map((activity, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-lg"
                      >
                        <div className="bg-gray-100 rounded-full p-2">
                          <ActivityIcon type={activity.type} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-800">
                            <ActivityDescription activity={activity} />
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatRelativeTime(activity.timestamp)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-gray-500 py-12">
                    Tidak ada aktivitas terbaru untuk pengguna ini.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
