// src/pages/admin/DashboardPage.jsx
import React, { useEffect, useRef, useState } from "react";
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
import {
  UserCheck,
  Send,
  CalendarClock,
  CircleX,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { socket } from "../../utils/socket";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);

  // === Fetch data utama ===
  const fetchStats = async () => {
    try {
      const res = await api.get("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setStats(res.data.data);
    } catch (err) {
      console.error("Gagal ambil statistik admin:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);

    if (socket) {
      socket.on("admin:queueUpdate", (payload) => {
        setStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            users: prev.users.map((u) =>
              u._id === payload.userId
                ? { ...u, queueDepth: payload.queueDepth }
                : u
            ),
          };
        });
      });
    }

    return () => {
      clearInterval(interval);
      if (socket) socket.off("admin:queueUpdate");
    };
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Memuat data dashboard...
      </div>
    );
  }

  const { kpi, users, totalUserAktif } = stats;

  // === Chart data ===
  const chartData = {
    labels: users.map((u) => u.username),
    datasets: [
      {
        label: "Total Pesan",
        data: users.map((u) => u.totalPesan),
        backgroundColor: "rgba(79,70,229,0.8)", // indigo-600
        borderRadius: 6,
      },
      {
        label: "Terkirim",
        data: users.map((u) => u.terkirim),
        backgroundColor: "rgba(16,185,129,0.8)", // emerald-500
        borderRadius: 6,
      },
      {
        label: "Gagal",
        data: users.map((u) => u.gagal),
        backgroundColor: "rgba(239,68,68,0.8)", // red-500
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" } },
    scales: { y: { beginAtZero: true } },
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      {/* === KPI Cards === */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total User Aktif"
          value={totalUserAktif}
          icon={<UserCheck className="w-5 h-5 text-indigo-600" />}
          bg="indigo"
        />
        <StatCard
          title="Pesan Hari Ini"
          value={kpi.today.toLocaleString()}
          icon={<Send className="w-5 h-5 text-emerald-600" />}
          bg="emerald"
        />
        <StatCard
          title="7 Hari Terakhir"
          value={kpi.last7d.toLocaleString()}
          icon={<CalendarClock className="w-5 h-5 text-sky-600" />}
          bg="sky"
        />
        <StatCard
          title="Gagal Hari Ini"
          value={kpi.failedToday}
          icon={<CircleX className="w-5 h-5 text-red-600" />}
          bg="red"
        />
      </section>

      {/* === Chart & Table === */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            Aktivitas Pesan per User
          </h3>
          <div className="h-80">
            <Bar ref={chartRef} data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800">
              Ringkasan Aktivitas
            </h3>
            <span className="text-xs text-slate-400">
              {new Date().toLocaleString("id-ID")}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase">
                <tr>
                  <th className="py-2">User</th>
                  <th className="py-2 text-center">Terkirim</th>
                  <th className="py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50 transition">
                    <td className="py-3 font-medium text-slate-700">
                      {u.username}
                    </td>
                    <td className="py-3 text-center text-slate-600">
                      {u.terkirim}
                    </td>
                    <td className="py-3 text-center">
                      {u.waStatus === "CONNECTED" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 mr-1.5" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1.5" />
                          Disconnected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <p className="text-center text-gray-400 py-6">
                Belum ada data aktivitas user
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// === Komponen Kartu Statistik ===
function StatCard({ title, value, icon, bg }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`p-2 bg-${bg}-100 rounded-full`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-slate-800 mt-2">{value}</p>
    </div>
  );
}
