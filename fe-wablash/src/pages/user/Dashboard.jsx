import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import api from "../../utils/api"; // 🔑 axios instance

// ✅ Register ChartJS plugin
ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [waConnected, setWaConnected] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Ambil statistik summary & weekly
        const res1 = await api.get("/api/stats/summary", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res2 = await api.get("/api/stats/weekly", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res1.data.ok) setStats(res1.data.data);
        if (res2.data.ok) setWeekly(res2.data.data);

        // Ambil status WA
        const res3 = await api.get("/api/wa/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res3.data.ok) setWaConnected(res3.data.connected);
      } catch (err) {
        console.error("Dashboard error:", err.response?.data || err.message);
      }
    };
    fetchData();
  }, [token]);

  // data chart
  const labels = weekly.map((d) => d._id);
  const counts = weekly.map((d) => d.count);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Pesan Terkirim",
        data: counts,
        borderColor: "rgb(79, 70, 229)",
        backgroundColor: "rgba(79, 70, 229, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Selamat Datang, semangat kerjanya bubu {user?.name || user?.username} 🥰
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Berikut statistik penggunaan aplikasi DyaVan Message
        </p>
      </div>

      {/* Cards Statistik */}
      {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <p className="text-gray-500 text-sm">Terkirim Hari Ini</p>
            <p className="text-2xl font-bold">{stats.sentToday}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <p className="text-gray-500 text-sm">Total Blast Bulan Ini</p>
            <p className="text-2xl font-bold">{stats.sentThisMonth}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <p className="text-gray-500 text-sm">Pesan Gagal</p>
            <p className="text-2xl font-bold">{stats.failed}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <p className="text-gray-500 text-sm">Koneksi WA</p>
            <p
              className={`text-xl font-bold ${
                waConnected ? "text-green-600" : "text-red-600"
              }`}
            >
              {waConnected ? "Terhubung" : "Belum Terhubung"}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-gray-500">Memuat data...</p>
      )}

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold mb-4">
          Statistik Pengiriman 7 Hari Terakhir
        </h3>
        <Line
          data={chartData}
          options={{ responsive: true, scales: { y: { beginAtZero: true } } }}
        />
      </div>
    </div>
  );
}
