import React, { useEffect, useRef, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, PointElement, LineElement
} from "chart.js";
import { Wifi, WifiOff, Clock, Users, X, Activity } from "lucide-react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { socket } from "../../utils/socket"; // opsional, biar realtime queue

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement
);

// =========================
// 🔍 Modal Detail User
// =========================
function UserDetailModal({ open, onClose, detail }) {
  if (!open) return null;

  const totalSent =
    (detail?.totals?.sent || 0) +
    (detail?.totals?.delivered || 0) +
    (detail?.totals?.read || 0) +
    (detail?.totals?.played || 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-[fadeIn_.2s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              Detail User — {detail?.user?.username || "-"}
            </h3>
            <p className="text-sm text-gray-500">
              Statistik 30 hari terakhir • WA:{" "}
              <span
                className={`font-semibold ${
                  detail?.waStatus === "CONNECTED"
                    ? "text-green-600"
                    : detail?.waStatus === "QR_READY"
                    ? "text-yellow-600"
                    : "text-gray-600"
                }`}
              >
                {detail?.waStatus}
              </span>{" "}
              • Queue:{" "}
              {detail?.queueDepth > 0 ? (
                <span className="font-semibold text-yellow-700">
                  {detail.queueDepth} aktif
                </span>
              ) : (
                <span className="text-gray-400">0 (kosong)</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Pesan" value={detail?.totals?.total || 0} color="indigo" />
            <StatCard title="Terkirim (incl. Delivered/Read)" value={totalSent} color="green" />
            <StatCard title="Gagal" value={detail?.totals?.failed || 0} color="red" />
            <StatCard title="Success Rate" value={`${detail?.totals?.successRate || 0}%`} color="emerald" />
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Timeline pesan per hari (30 hari)
            </h4>
            <Bar
              data={{
                labels: (detail?.daily || []).map((d) => d.date),
                datasets: [
                  {
                    label: "Total",
                    data: (detail?.daily || []).map((d) => d.total),
                    backgroundColor: "rgba(99,102,241,0.7)",
                    borderRadius: 4,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false } },
                  y: { ticks: { precision: 0 }, grid: { color: "#eef2f7" } },
                },
              }}
            />
          </div>

          {/* Footer Info */}
          <div className="text-xs text-gray-400 space-x-2">
            <span>
              Quota harian:{" "}
              {detail?.user?.quotaDaily ? (
                <span className="font-semibold text-indigo-700">
                  {detail.user.quotaDaily}
                </span>
              ) : (
                <span className="italic">Unlimited</span>
              )}
            </span>
            • <span>Status: {detail?.user?.active ? "Aktif" : "Nonaktif"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Komponen kecil kartu statistik
function StatCard({ title, value, color }) {
  return (
    <div
      className={`p-4 bg-${color}-50 border border-${color}-100 rounded-xl text-center`}
    >
      <p className="text-gray-500 text-xs">{title}</p>
      <p className={`text-2xl font-bold text-${color}-700`}>{value}</p>
    </div>
  );
}

// =========================
// 📊 Halaman Utama Dashboard Admin
// =========================
export default function DashboardPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // modal states
  const [openModal, setOpenModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const chartRef = useRef(null);

  // Fetch data utama admin
  const fetchStats = async () => {
    try {
      const res = await api.get("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setStats(res.data.data);
    } catch (err) {
      console.error("Gagal fetch statistik admin:", err);
    } finally {
      setLoading(false);
    }
  };

  // Detail per user
  const fetchUserDetail = async (userId) => {
    setDetailLoading(true);
    setOpenModal(true);
    try {
      const res = await api.get(`/api/admin/users/${userId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setDetail(res.data.data);
    } catch (e) {
      console.error("Gagal fetch detail user:", e);
    } finally {
      setDetailLoading(false);
    }
  };

  // Auto-refresh + listener socket
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);

    // 🔄 Optional: realtime update queueDepth
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
      <div className="bg-white p-6 rounded-2xl shadow text-center">
        <p className="text-gray-500">Memuat data statistik...</p>
      </div>
    );
  }

  const { kpi, users, totalUserAktif } = stats;

  // chart dataset per user
  const chartData = {
    labels: users.map((u) => u.username),
    datasets: [
      {
        label: "Total Pesan",
        data: users.map((u) => u.totalPesan),
        backgroundColor: "rgba(99,102,241,0.85)",
        borderRadius: 6,
      },
      {
        label: "Terkirim",
        data: users.map((u) => u.terkirim),
        backgroundColor: "rgba(16,185,129,0.85)",
        borderRadius: 6,
      },
      {
        label: "Gagal",
        data: users.map((u) => u.gagal),
        backgroundColor: "rgba(239,68,68,0.85)",
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: "bottom" } },
    scales: {
      x: { grid: { display: false } },
      y: { ticks: { precision: 0 }, grid: { color: "#eef2f7" } },
    },
    onClick: (evt) => {
      const chart = chartRef.current;
      if (!chart) return;
      const points = chart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true);
      if (!points.length) return;
      const index = points[0].index;
      const user = users[index];
      if (user?._id) fetchUserDetail(user._id);
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Monitoring & Statistik</h2>
          <p className="text-gray-500 text-sm mt-1">
            Monitoring sistem dan performa pengguna WhatsApp Blast.
          </p>
        </div>
        <span className="text-xs text-gray-400">Auto refresh setiap 15 detik</span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total User Aktif", value: totalUserAktif, color: "indigo", icon: <Users size={18} /> },
          { label: "Pesan Hari Ini", value: kpi.today.toLocaleString(), color: "green", icon: <Activity size={18} /> },
          { label: "7 Hari Terakhir", value: kpi.last7d.toLocaleString(), color: "blue", icon: <Clock size={18} /> },
          { label: "Failed Hari Ini", value: kpi.failedToday, color: "red", icon: <WifiOff size={18} /> },
        ].map((c, i) => (
          <div
            key={i}
            className={`p-5 bg-${c.color}-50 border border-${c.color}-100 rounded-2xl shadow-sm hover:shadow-md transition`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs">{c.label}</p>
                <p className={`text-3xl font-bold text-${c.color}-700 mt-1`}>
                  {c.value}
                </p>
              </div>
              <div className={`p-3 rounded-full bg-${c.color}-100 text-${c.color}-700`}>
                {c.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Aktivitas Pesan per User</h3>
        {users.length > 0 ? (
          <Bar ref={chartRef} data={chartData} options={chartOptions} />
        ) : (
          <p className="text-center text-gray-400 py-8">Belum ada data</p>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Ringkasan Aktivitas User</h3>
          <span className="text-xs text-gray-400">{new Date().toLocaleString("id-ID")}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-600">
                <th className="py-2 px-3">User</th>
                <th>Total</th>
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
                  onClick={() => fetchUserDetail(u._id)}
                  className="border-b hover:bg-indigo-50/40 cursor-pointer transition-colors"
                >
                  <td className="py-2 px-3 font-medium text-gray-800">{u.username}</td>
                  <td>{u.totalPesan}</td>
                  <td className="text-green-600">{u.terkirim}</td>
                  <td className="text-red-500">{u.gagal}</td>
                  <td>
                    <span
                      className={`flex items-center gap-1 text-xs font-semibold w-fit px-3 py-1 rounded-full ${
                        u.waStatus === "CONNECTED"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {u.waStatus === "CONNECTED" ? <Wifi size={14} /> : <WifiOff size={14} />}
                      {u.waStatus}
                    </span>
                  </td>
                  <td className="text-center">
                    {u.queueDepth > 0 ? (
                      <span className="text-yellow-700 font-semibold">{u.queueDepth} aktif</span>
                    ) : (
                      <span className="text-gray-400">0 (kosong)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <UserDetailModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        detail={detailLoading ? null : detail}
      />
    </div>
  );
}
