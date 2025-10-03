import React, { useEffect, useState, useRef } from "react";
import api from "../../utils/api"; // 🔑 pakai axios instance
import { useAuth } from "../../context/AuthContext";
import {
  Search,
  FileDown,
  FileUp,
  Pen,
  Trash2,
  Save,
  X,
  LoaderCircle,
} from "lucide-react";

const CustomModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-fade-in-down">
        <div className="flex justify-between items-center pb-3 border-b">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};

export default function Contacts() {
  const { token } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, type: "", data: null });

  // ==========================
  // Fetch contacts
  // ==========================
  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/contacts", {
        headers: { Authorization: `Bearer ${token}` },
        params: { search },
      });
      if (res.data.ok) {
        setContacts(res.data.items || []);
      }
    } catch (err) {
      console.error("❌ Error fetch contacts:", err);
      setModal({
        isOpen: true,
        type: "error",
        data: { message: "Gagal memuat kontak." },
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (token) fetchContacts();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [token, search]);

  // ==========================
  // Export contacts
  // ==========================
  const handleExport = async () => {
    setActionLoading("export");
    try {
      const res = await api.get("/api/contacts/export", {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "contacts.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();

      setModal({
        isOpen: true,
        type: "success",
        data: { message: "Kontak berhasil diekspor." },
      });
    } catch (err) {
      console.error("❌ Error export contacts:", err);
      setModal({
        isOpen: true,
        type: "error",
        data: { message: "Gagal mengekspor kontak." },
      });
    } finally {
      setActionLoading(null);
    }
  };

  // ==========================
  // Import contacts
  // ==========================
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      handleImport(selectedFile);
    }
  };

  const handleImport = async (selectedFile) => {
    const formData = new FormData();
    formData.append("file", selectedFile);
    setActionLoading("import");

    try {
      const res = await api.post("/api/contacts/import", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      if (res.data.ok) {
        setModal({
          isOpen: true,
          type: "success",
          data: { message: `Berhasil mengimpor ${res.data.imported} kontak.` },
        });
        fetchContacts();
      }
    } catch (err) {
      console.error("❌ Error import contacts:", err);
      setModal({
        isOpen: true,
        type: "error",
        data: {
          message: "Gagal mengimpor kontak. Pastikan format file sudah benar.",
        },
      });
    } finally {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActionLoading(null);
    }
  };

  // ==========================
  // Edit contact
  // ==========================
  const startEdit = (c) => {
    setEditing(c._id);
    setEditName(c.name || "");
    setEditNumber(c.waNumber || "");
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditName("");
    setEditNumber("");
  };

  const saveEdit = async (id) => {
    setActionLoading(id);
    try {
      const res = await api.put(
        `/api/contacts/${id}`,
        { name: editName, waNumber: editNumber },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.ok) {
        setModal({
          isOpen: true,
          type: "success",
          data: { message: "Kontak berhasil diperbarui." },
        });
        cancelEdit();
        fetchContacts();
      }
    } catch (err) {
      console.error("❌ Error update contact:", err);
      setModal({
        isOpen: true,
        type: "error",
        data: { message: "Gagal memperbarui kontak." },
      });
    } finally {
      setActionLoading(null);
    }
  };

  // ==========================
  // Delete contact
  // ==========================
  const handleDeleteRequest = (id) => {
    setModal({ isOpen: true, type: "delete", data: { id } });
  };

  const deleteContact = async (id) => {
    setActionLoading(id);
    setModal({ isOpen: false, type: "", data: null });
    try {
      const res = await api.delete(`/api/contacts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) {
        setModal({
          isOpen: true,
          type: "success",
          data: { message: "Kontak berhasil dihapus." },
        });
        fetchContacts();
      }
    } catch (err) {
      console.error("❌ Error delete contact:", err);
      setModal({
        isOpen: true,
        type: "error",
        data: { message: "Gagal menghapus kontak." },
      });
    } finally {
      setActionLoading(null);
    }
  };

  const closeModal = () => setModal({ isOpen: false, type: "", data: null });

  return (
    <div className="bg-gray-100 min-h-screen text-gray-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Daftar Kontak</h1>
        </header>

        {/* Actions Bar */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full sm:flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / nomor..."
              className="bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 transition"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExport}
              disabled={actionLoading === "export"}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition duration-300"
            >
              <FileDown size={18} />
              <span>Export</span>
            </button>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              ref={fileInputRef}
              disabled={actionLoading === "import"}
            />
            <button
              onClick={() => fileInputRef.current.click()}
              disabled={actionLoading === "import"}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition duration-300"
            >
              <FileUp size={18} />
              <span>Import</span>
            </button>
          </div>
        </div>
        {/* Contacts Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <LoaderCircle className="animate-spin text-indigo-500" size={48} />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500">Tidak ada kontak ditemukan.</p>
              {search && (
                <p className="text-gray-400 text-sm mt-1">
                  Coba kata kunci lain.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                  <tr>
                    <th scope="col" className="px-6 py-3">Nama</th>
                    <th scope="col" className="px-6 py-3">Nomor WA</th>
                    {/* 🔥 NEW: kolom Asal Sekolah & Kelas */}
                    <th scope="col" className="px-6 py-3 hidden lg:table-cell">Asal Sekolah</th>
                    <th scope="col" className="px-6 py-3 hidden lg:table-cell">Kelas</th>
                    <th scope="col" className="px-6 py-3 hidden md:table-cell">Terakhir Diperbarui</th>
                    <th scope="col" className="px-6 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c._id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {editing === c._id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-gray-100 border border-gray-300 p-1 rounded w-full"
                            autoFocus
                          />
                        ) : (
                          c.name || "-"
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editing === c._id ? (
                          <input
                            type="text"
                            value={editNumber}
                            onChange={(e) => setEditNumber(e.target.value)}
                            className="bg-gray-100 border border-gray-300 p-1 rounded w-full"
                          />
                        ) : (
                          c.waNumber || c._id
                        )}
                      </td>

                      {/* 🔥 NEW: tampilkan SCHOOL & KELAS (capslock) */}
                      <td className="px-6 py-4 hidden lg:table-cell">
                        {(c.school || "-").toString().toUpperCase()}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        {(c.kelas || "-").toString().toUpperCase()}
                      </td>

                      <td className="px-6 py-4 hidden md:table-cell">
                        {new Date(c.updatedAt || c.lastAt).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {editing === c._id ? (
                            <>
                              <button
                                onClick={() => saveEdit(c._id)}
                                disabled={actionLoading === c._id}
                                className="text-green-500 hover:text-green-600 p-1 disabled:text-gray-400"
                              >
                                {actionLoading === c._id ? (
                                  <LoaderCircle className="animate-spin" size={20} />
                                ) : (
                                  "Simpan"
                                )}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-gray-500 hover:text-gray-700 p-1"
                              >
                                Batal
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(c)}
                                className="bg-yellow-400 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-yellow-500"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteRequest(c._id)}
                                className="bg-red-500 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-red-600"
                              >
                                Hapus
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
