import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import api from "../../utils/api"; // axios instance
import { useAuth } from "../../context/AuthContext";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function DashboardPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalUserAktif, setTotalUserAktif] = useState(0);
  const [totalPesan, setTotalPesan] = useState(0);
  const [kuotaGlobal, setKuotaGlobal] = useState(0);
  const [chartLabels, setChartLabels] = useState([]);
  const [chartData, setChartData] = useState([]);

  // ambil data statistik
  const fetchStats = async () => {
    try {
      const res = await api.get("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;

      if (data.ok) {
        // data dari backend diharapkan seperti:
        // { ok: true, data: { users: [...], totalPesan: number, kuota: number } }

        setTotalUserAktif(data.data.totalUserAktif || data.data.users.length);
        setTotalPesan(data.data.totalPesan || 0);
        setKuotaGlobal(data.data.kuota || 0);

        const labels = data.data.users.map((u) => u.username || u.name);
        const pesan = data.data.users.map((u) => u.totalPesan || 0);

        setChartLabels(labels);
        setChartData(pesan);
      }
    } catch (err) {
      console.error("Gagal fetch statistik admin:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.formattedValue}`,
        },
      },
    },
  };

  const adminChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Jumlah Pesan Terkirim (Bulan Ini)",
        data: chartData,
        backgroundColor: [
          "rgba(99, 102, 241, 0.7)",
          "rgba(34, 197, 94, 0.7)",
          "rgba(239, 68, 68, 0.7)",
          "rgba(234, 179, 8, 0.7)",
          "rgba(59, 130, 246, 0.7)",
        ],
        borderRadius: 6,
      },
    ],
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md text-center">
        <p className="text-gray-500">Memuat data statistik...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h3 className="text-xl font-semibold mb-4">Monitoring & Statistik Admin</h3>

      {/* Kartu Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-4 bg-indigo-50 rounded-lg text-center shadow-sm">
          <p className="text-gray-500">Total User Aktif</p>
          <p className="text-3xl font-bold text-indigo-700 mt-1">{totalUserAktif}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg text-center shadow-sm">
          <p className="text-gray-500">Total Pesan (Bulan Ini)</p>
          <p className="text-3xl font-bold text-green-700 mt-1">
            {totalPesan.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg text-center shadow-sm">
          <p className="text-gray-500">Kuota Global Terpakai</p>
          <p className="text-3xl font-bold text-yellow-700 mt-1">{kuotaGlobal}%</p>
        </div>
      </div>

      {/* Chart */}
      {chartLabels.length > 0 ? (
        <Bar data={adminChartData} options={chartOptions} />
      ) : (
        <p className="text-center text-gray-500">Belum ada data pesan untuk ditampilkan</p>
      )}
    </div>
  );
}
