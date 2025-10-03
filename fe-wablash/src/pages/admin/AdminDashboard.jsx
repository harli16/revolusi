import React, { useState, useEffect } from "react";
import UserManagement from "./UserManagement";
import { useAuth } from "../../context/AuthContext";
import {
  BarChart3,
  Users,
  FileSpreadsheet,
  SlidersHorizontal,
  Activity,
  Bell,
  LogOut,
  MessageSquareText,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import api from "../../utils/api"; // ✅ axios instance

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AdminDashboard() {
  const { logout, token } = useAuth();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [totalUserAktif, setTotalUserAktif] = useState(0);
  const [totalPesan, setTotalPesan] = useState(0);
  const [kuotaGlobal, setKuotaGlobal] = useState(0);

  const admin = { name: "Admin LP3I" };

  const SidebarLink = ({ page, icon, children }) => (
    <a
      href="#"
      className={`flex items-center p-3 rounded-lg text-gray-600 hover:bg-gray-100 ${
        currentPage === page ? "bg-indigo-100 text-indigo-700 font-semibold" : ""
      }`}
      onClick={(e) => {
        e.preventDefault();
        setCurrentPage(page);
      }}
    >
      {icon} {children}
    </a>
  );

  const PageContent = () => {
    switch (currentPage) {
      case "users":
        return <UserManagement />;
      case "templates":
        return <TemplatesPage />;
      case "kontrol":
        return <KontrolPage />;
      case "activity":
        return <ActivityPage />;
      case "blasts":
        return <BlastPage />;
      case "dashboard":
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="bg-gray-100 text-gray-900 font-sans">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="h-16 flex items-center justify-center border-b border-gray-200">
            <span className="ml-2 text-xl font-bold text-indigo-600">Admin Panel</span>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Menu Admin
            </h3>
            <SidebarLink page="dashboard" icon={<BarChart3 className="w-5 h-5 mr-3" />}>
              Monitoring
            </SidebarLink>
            <SidebarLink page="users" icon={<Users className="w-5 h-5 mr-3" />}>
              Manajemen User
            </SidebarLink>
            <SidebarLink page="activity" icon={<Activity className="w-5 h-5 mr-3" />}>
              Aktivitas User
            </SidebarLink>
            <SidebarLink page="blasts" icon={<MessageSquareText className="w-5 h-5 mr-3" />}>
              Detail Blast
            </SidebarLink>
            <SidebarLink page="templates" icon={<FileSpreadsheet className="w-5 h-5 mr-3" />}>
              Template Global
            </SidebarLink>
            <SidebarLink page="kontrol" icon={<SlidersHorizontal className="w-5 h-5 mr-3" />}>
              Kontrol Sistem
            </SidebarLink>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 relative">
            <h1 className="text-2xl font-semibold capitalize">
              {{
                dashboard: "Monitoring & Statistik",
                users: "Manajemen User",
                templates: "Template Global",
                kontrol: "Kontrol Sistem",
                activity: "Aktivitas User",
                blasts: "Detail Blast",
              }[currentPage]}
            </h1>
            <div className="flex items-center space-x-4">
              <button className="relative text-gray-500 hover:text-gray-700">
                <Bell className="w-6 h-6" />
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Avatar + Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center focus:outline-none"
                >
                  <img
                    src="https://placehold.co/40x40/ef4444/ffffff?text=AD"
                    alt="Admin Avatar"
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="ml-3 text-left hidden sm:block">
                    <p className="font-semibold text-sm">{admin.name}</p>
                    <p className="text-xs text-gray-500">{admin.email}</p>
                  </div>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <button
                      onClick={logout}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="p-6">
            <PageContent />
          </div>
        </main>
      </div>
    </div>
  );

  // --- Halaman Dashboard ---
  function DashboardPage() {
    const [chartLabels, setChartLabels] = useState([]);
    const [chartData, setChartData] = useState([]);

    const fetchStats = async () => {
      try {
        const res = await api.get("/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data;

        if (data.ok) {
          const usersOnly = data.users.filter((u) => u.role === "user");

          // hitung user aktif
          const aktifCount = usersOnly.filter(
            (u) => u.active === true && !u.suspended
          ).length;
          setTotalUserAktif(aktifCount);

          // labels & data chart
          setChartLabels(usersOnly.map((u) => u.username));
          setChartData(usersOnly.map((u) => u.totalPesan || 0));

          // total pesan = jumlah semua totalPesan
          const sumPesan = usersOnly.reduce(
            (acc, u) => acc + (u.totalPesan || 0),
            0
          );
          setTotalPesan(sumPesan);

          // kuota global (dummy)
          setKuotaGlobal(76);
        }
      } catch (err) {
        console.error("Gagal fetch statistik:", err);
      }
    };

    useEffect(() => {
      fetchStats();
    }, []);

    const adminChartData = {
      labels: chartLabels,
      datasets: [
        {
          label: "Jumlah Pesan Terkirim (Bulan Ini)",
          data: chartData,
          backgroundColor: [
            "rgba(255, 99, 132, 0.5)",
            "rgba(54, 162, 235, 0.5)",
            "rgba(255, 206, 86, 0.5)",
            "rgba(75, 192, 192, 0.5)",
            "rgba(153, 102, 255, 0.5)",
            "rgba(255, 159, 64, 0.5)",
          ],
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              return ` ${context.dataset.label}: ${context.formattedValue}`;
            },
          },
        },
      },
    };

    return (
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-xl font-semibold mb-4">Monitoring & Statistik Admin</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="p-4 bg-gray-100 rounded-lg">
            <p>Total User Aktif: <strong>{totalUserAktif}</strong></p>
          </div>
          <div className="p-4 bg-gray-100 rounded-lg">
            <p>Total Pesan Terkirim (Bulan Ini):{" "}
              <strong>{totalPesan.toLocaleString()}</strong></p>
          </div>
          <div className="p-4 bg-gray-100 rounded-lg">
            <p>Penggunaan Kuota Global: <strong>{kuotaGlobal}%</strong></p>
          </div>
        </div>
        <Bar data={adminChartData} options={chartOptions} />
      </div>
    );
  }

  // --- Halaman Detail Blast ---
  function BlastPage() {
    const [blasts, setBlasts] = useState([]);

    const fetchBlasts = async () => {
      try {
        const res = await api.get("/api/logs/messages/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data;
        if (data.ok) setBlasts(data.logs);
      } catch (err) {
        console.error("Gagal fetch blasts:", err);
      }
    };

    useEffect(() => {
      fetchBlasts();
    }, []);

    const getStatusColor = (status) => {
      switch (status) {
        case "delivered":
          return "text-green-600 bg-green-100";
        case "read":
          return "text-blue-600 bg-blue-100";
        case "failed":
          return "text-red-600 bg-red-100";
        case "pending":
          return "text-yellow-600 bg-yellow-100";
        default:
          return "text-gray-600 bg-gray-100";
      }
    };

    return (
      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Detail Blast</h3>
          <button
            onClick={fetchBlasts}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Refresh Data
          </button>
        </div>
        {blasts.length === 0 ? (
          <p className="text-gray-500 text-center">Belum ada data blast</p>
        ) : (
          <table className="w-full border-collapse border border-gray-200 rounded-lg shadow-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-200 px-4 py-2 text-left">Nomor</th>
                <th className="border border-gray-200 px-4 py-2 text-left">Status</th>
                <th className="border border-gray-200 px-4 py-2 text-left">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {blasts.map((b, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-4 py-2">{b.phone || "-"}</td>
                  <td className="border border-gray-200 px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded text-sm font-medium ${getStatusColor(b.status)}`}
                    >
                      {b.status || b.aktivitas}
                    </span>
                  </td>
                  <td className="border border-gray-200 px-4 py-2">
                    {b.createdAt ? new Date(b.createdAt).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // --- Halaman Templates ---
  function TemplatesPage() {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-xl font-semibold mb-4">Template Global</h3>
        <p className="text-gray-600">Template pesan global akan tampil di sini...</p>
      </div>
    );
  }

  // --- Halaman Kontrol ---
  function KontrolPage() {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-xl font-semibold mb-4">Kontrol Sistem</h3>
        <p className="text-gray-600">Pengaturan sistem global di sini...</p>
      </div>
    );
  }

  // --- Halaman Activity ---
  function ActivityPage() {
    const [activities, setActivities] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userLogs, setUserLogs] = useState([]);
    const [showModal, setShowModal] = useState(false);

    const fetchActivities = async () => {
      try {
        const resUsers = await api.get("/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const usersData = resUsers.data;

        if (usersData.ok) {
          const usersOnly = usersData.users.filter((u) => u.role === "user");

          const mapped = usersOnly.map((u) => ({
            id: u._id,
            username: u.username,
            createdAt: u.createdAt,
            totalPesan: u.totalPesan || 0,
            isOnline: u.isOnline || false,
            lastActive: u.lastActive || null,
          }));

          setActivities(mapped);
        }
      } catch (err) {
        console.error("Gagal fetch aktivitas:", err);
      }
    };

    useEffect(() => {
      fetchActivities();
      const interval = setInterval(fetchActivities, 15000);
      return () => clearInterval(interval);
    }, []);

    const fetchUserLogs = async (userId) => {
      try {
        const res = await api.get(`/api/logs/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data;
        if (data.ok) {
          setUserLogs(data.logs);
          setShowModal(true);
        }
      } catch (err) {
        console.error("Gagal fetch log user:", err);
      }
    };

    const UserCard = ({ user }) => {
      const initials = user.username
        ? user.username
            .split(" ")
            .map((w) => w[0].toUpperCase())
            .join("")
        : "US";

      return (
        <div className="bg-white border rounded-xl p-4 shadow hover:shadow-md transition">
          <div className="flex items-center mb-3">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-purple-500 text-white font-bold mr-3 relative">
              {initials}
              {user.isOnline && (
                <span className="absolute bottom-0 right-0 block w-3 h-3 rounded-full bg-green-500 ring-2 ring-white"></span>
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{user.username}</p>
              <p className="text-xs text-gray-500">
                {user.isOnline
                  ? "Sedang online"
                  : user.lastActive
                  ? `Terakhir aktif: ${new Date(user.lastActive).toLocaleString()}`
                  : `Dibuat: ${new Date(user.createdAt).toLocaleString()}`}
              </p>
            </div>
          </div>
          <p className="text-gray-700 mb-3">
            Total Pesan: <strong>{user.totalPesan}</strong>
          </p>
          <button
            onClick={() => {
              setSelectedUser(user);
              fetchUserLogs(user.id);
            }}
            className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200"
          >
            Lihat Detail Log
          </button>
        </div>
      );
    };

    return (
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-xl font-semibold mb-6">Ringkasan Aktivitas User</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>

        {/* Modal Detail Log */}
        {showModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-200/40 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">
                Log Detail - {selectedUser?.username}
              </h3>
              <table className="w-full border-collapse border border-gray-200 rounded-lg shadow-sm mb-4">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-left">Nomor</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Status</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {userLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-3 py-2">{log.phone || "-"}</td>
                      <td className="border border-gray-200 px-3 py-2">{log.status || log.aktivitas}</td>
                      <td className="border border-gray-200 px-3 py-2">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}
