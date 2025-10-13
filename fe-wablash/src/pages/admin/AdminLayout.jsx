// src/pages/admin/AdminLayout.jsx
import React, { useState } from "react";
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
import { useAuth } from "../../context/AuthContext";

export default function AdminLayout({ children, currentPage, setCurrentPage }) {
  const { logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const admin = { name: "Admin LP3I", email: "admin@lp3i.ac.id" };

  const SidebarLink = ({ page, icon, label }) => {
    const active = currentPage === page;
    return (
      <button
        onClick={() => setCurrentPage(page)}
        className={`flex items-center w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 ${
          active
            ? "bg-indigo-50 text-indigo-700 font-semibold border-l-4 border-indigo-600"
            : "text-gray-600 hover:bg-gray-100 hover:text-indigo-700"
        }`}
      >
        <span
          className={`${
            active ? "text-indigo-700" : "text-gray-500"
          } flex items-center`}
        >
          {icon}
        </span>
        <span className="ml-3">{label}</span>
      </button>
    );
  };

  return (
    <div className="bg-gray-100 text-gray-900 font-sans min-h-screen">
      <div className="flex h-screen overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          {/* Logo area */}
          <div className="h-14 flex items-center justify-center border-b border-gray-100">
            <span className="text-lg font-semibold text-indigo-600 tracking-wide">
              LP3I Admin
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            <SidebarLink
              page="dashboard"
              icon={<BarChart3 className="w-5 h-5" />}
              label="Monitoring"
            />
            <SidebarLink
              page="users"
              icon={<Users className="w-5 h-5" />}
              label="Manajemen User"
            />
            <SidebarLink
              page="activity"
              icon={<Activity className="w-5 h-5" />}
              label="Aktivitas User"
            />
            <SidebarLink
              page="blasts"
              icon={<MessageSquareText className="w-5 h-5" />}
              label="Detail Blast"
            />
            <SidebarLink
              page="templates"
              icon={<FileSpreadsheet className="w-5 h-5" />}
              label="Log Pengiriman User"
            />
            <SidebarLink
              page="kontrol"
              icon={<SlidersHorizontal className="w-5 h-5" />}
              label="Kontrol Sistem"
            />
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
          {/* Header */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40">
            <h1 className="text-xl font-semibold text-gray-800 capitalize">
              {{
                dashboard: "Monitoring & Statistik",
                users: "Manajemen User",
                templates: "Template Global",
                kontrol: "Kontrol Sistem",
                activity: "Aktivitas User",
                blasts: "Detail Blast",
              }[currentPage] || "Admin Panel"}
            </h1>

            <div className="flex items-center gap-4">
              <button className="relative text-gray-500 hover:text-gray-700">
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Avatar + dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center focus:outline-none"
                >
                  <img
                    src="https://placehold.co/40x40/4F46E5/FFFFFF?text=AD"
                    alt="Admin Avatar"
                    className="w-9 h-9 rounded-full border border-gray-200"
                  />
                  <div className="ml-2 text-left hidden sm:block">
                    <p className="font-semibold text-sm text-gray-700">
                      {admin.name}
                    </p>
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

          {/* CONTENT */}
          <div className="flex-1 p-6 overflow-y-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
