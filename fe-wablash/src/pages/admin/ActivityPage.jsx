import { useEffect, useState } from "react";
import { RefreshCcw, Wifi, WifiOff, Clock, Activity } from "lucide-react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

export default function ActivityPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Aktivitas User</h2>
        <button
          onClick={() => {
            setRefreshing(true);
            fetchData();
          }}
          className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium shadow-sm transition ${
            refreshing
              ? "bg-gray-200 text-gray-600"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          <RefreshCcw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-gray-600 text-left">
              <th className="py-3 px-4">User</th>
              <th>Total Pesan</th>
              <th>Terkirim</th>
              <th>Gagal</th>
              <th>Status WA</th>
              <th>Queue</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u._id}
                className="border-b hover:bg-indigo-50/40 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-800">
                  {u.username}
                </td>
                <td>{u.totalPesan}</td>
                <td className="text-green-600">{u.terkirim}</td>
                <td className="text-red-500">{u.gagal}</td>
                <td>
                  <span
                    className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold w-fit rounded-full ${
                      u.waStatus === "CONNECTED"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {u.waStatus === "CONNECTED" ? (
                      <Wifi size={14} />
                    ) : (
                      <WifiOff size={14} />
                    )}
                    {u.waStatus}
                  </span>
                </td>
                <td className="text-center">
                  {u.queueDepth > 0 ? (
                    <span className="text-yellow-700 font-semibold">
                      {u.queueDepth} aktif
                    </span>
                  ) : (
                    <span className="text-gray-400">0 (kosong)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            Belum ada aktivitas user
          </p>
        )}
      </div>
    </div>
  );
}
