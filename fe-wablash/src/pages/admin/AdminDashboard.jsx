import React, { useState, useMemo } from "react";
import AdminLayout from "./AdminLayout";
import UserManagement from "./UserManagement";
import TemplatesPage from "./TemplatesPage";
import KontrolPage from "./KontrolPage";
import ActivityPage from "./ActivityPage";
import BlastPage from "./BlastPage";
import DashboardPage from "./DashboardPage"; // berisi chart statistik

export default function AdminDashboard() {
  const [currentPage, setCurrentPage] = useState("dashboard");

  // Gunakan useMemo biar komponen halaman gak re-render terus saat state berubah
  const PageContent = useMemo(() => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage />;
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
      default:
        return (
          <div className="p-6 bg-white rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-700">
              Halaman tidak ditemukan
            </h3>
          </div>
        );
    }
  }, [currentPage]);

  return (
    <AdminLayout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {PageContent}
    </AdminLayout>
  );
}
