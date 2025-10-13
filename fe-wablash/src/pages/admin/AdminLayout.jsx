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

  const SidebarLink = ({ page, icon, label }) => (
    <button
      className={`flex items-center w-full text-left p-3 rounded-lg text-gray-600 hover:bg-gray-100 ${
        currentPage === page ? "bg-indigo-100 text-indigo-700 font-semibold" : ""
      }`}
      onClick={() => setCurrentPage(page)}
    >
      {icon}
      <span className="ml-3">{label}</span>
    </button>
  );

  return (
    <div className="bg-gray-100 text-gray-900 font-sans">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="h-16 flex items-center justify-center border-b border-gray-200">
            <span className="ml-2 text-xl font-bold text-indigo-600">Admin Panel</span>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            <SidebarLink page="dashboard" icon={<BarChart3 className="w-5 h-5" />} label="Monitoring" />
            <SidebarLink page="users" icon={<Users className="w-5 h-5" />} label="Manajemen User" />
            <SidebarLink page="activity" icon={<Activity className="w-5 h-5" />} label="Aktivitas User" />
            <SidebarLink page="blasts" icon={<MessageSquareText className="w-5 h-5" />} label="Detail Blast" />
            <SidebarLink page="templates" icon={<FileSpreadsheet className="w-5 h-5" />} label="Template Global" />
            <SidebarLink page="kontrol" icon={<SlidersHorizontal className="w-5 h-5" />} label="Kontrol Sistem" />
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

          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
