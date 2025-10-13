import { useEffect, useState } from "react";
import { RefreshCcw, Loader2 } from "lucide-react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

export default function BlastPage() {
  const { token } = useAuth();
  const [blasts, setBlasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const res = await api.get("/api/blasts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setBlasts(res.data.data);
    } catch (err) {
      console.error("Gagal ambil data blasts:", err);
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
        Memuat data blast...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Detail Blast</h2>
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-gray-600 text-left">
              <th className="py-3 px-4">User</th>
              <th>Nama Blast</th>
              <th>Total Target</th>
              <th>Terkirim</th>
              <th>Gagal</th>
              <th>Status</th>
              <th>Mulai</th>
            </tr>
          </thead>
          <tbody>
            {blasts.map((b) => (
              <tr
                key={b._id}
                className="border-b hover:bg-indigo-50/40 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-800">
                  {b.user?.username || "-"}
                </td>
                <td>{b.name || "-"}</td>
                <td>{b.total || 0}</td>
                <td className="text-green-600">{b.success || 0}</td>
                <td className="text-red-500">{b.failed || 0}</td>
                <td>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      b.status === "running"
                        ? "bg-yellow-100 text-yellow-700"
                        : b.status === "done"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {b.status?.toUpperCase()}
                  </span>
                </td>
                <td>{new Date(b.createdAt).toLocaleString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {blasts.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            Belum ada data blast
          </p>
        )}
      </div>
    </div>
  );
}
