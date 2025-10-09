import React, { useEffect, useState, useRef, useMemo } from "react";
import api from "../../utils/api"; // 🔑 pakai axios instance
import { useAuth } from "../../context/AuthContext";
import {
  FileDown,
  FileUp,
  LoaderCircle,
  X,
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
  const [schoolsList, setSchoolsList] = useState([]);
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("");
  const [kelas, setKelas] = useState("");
  const [tahun, setTahun] = useState("");
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, type: "", data: null });
  
  // ==========================
  // Tambah Kontak Manual (modal)
  // ==========================
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addNumber, setAddNumber] = useState("");

  // ==========================
  // Fetch contacts (with filters)
  // ==========================
  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/contacts", {
        headers: { Authorization: `Bearer ${token}` },
        params: { search, school, kelas, tahun },
      });

      if (res.data.ok) {
        // ✅ Gunakan fallback antara data/items
        setContacts(res.data.data || res.data.items || []);
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

  // ==========================
  // Ambil unique list untuk dropdown
  // ==========================
  // const uniqueSchools = useMemo(() => {
  //   // Ambil semua nama sekolah unik dari contacts
  //   const arr = contacts.map((c) =>
  //     (c.school || "").trim().toUpperCase()
  //   );

  //   // Hilangkan duplikat + kosong
  //   const unique = [...new Set(arr.filter(Boolean))];

  //   // Urut abjad biar rapi
  //   return unique.sort();
  // }, [contacts]);

  const uniqueClasses = useMemo(() => {
    const arr = contacts.map((c) =>
      (c.kelas || "").trim().toUpperCase()
    );
    const unique = [...new Set(arr.filter(Boolean))];
    return unique.sort();
  }, [contacts]);

  const uniqueYears = useMemo(() => {
    const arr = contacts
      .map((c) => (c.tahunLulus ?? "").toString().trim())
      .filter(Boolean);
    const unique = [...new Set(arr)];
    return unique.sort(); // urut asc
  }, [contacts]);

  // ==========================
  // Ambil daftar sekolah (global function)
  // ==========================
  const fetchSchools = async () => {
    try {
      const res = await api.get("/api/contacts/schools", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setSchoolsList(res.data.data);
    } catch (err) {
      console.error("❌ Error ambil daftar sekolah:", err);
    }
  };

  useEffect(() => {
    if (token) fetchSchools();
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (token) fetchContacts();
    }, 300);
    return () => clearTimeout(t);
  }, [token, search, school, kelas, tahun]);

  // ==========================
  // Export contacts
  // ==========================
  const handleExport = async () => {
    setActionLoading("export");
    try {
      const res = await api.get("/api/contacts/export", {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
        params: { search, school, kelas, tahun }, // 🔥 tambahkan filter aktif
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
      console.error("❌ Error export:", err);
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
        // ✅ Tampilkan notifikasi sukses
        setModal({
          isOpen: true,
          type: "success",
          data: { message: `Berhasil mengimpor ${res.data.imported} kontak.` },
        });

        // ✅ Reset filter agar semua data sekolah muncul lagi
        setSchool("");
        setKelas("");
        setTahun("");
        setSearch("");

        // ✅ Fetch ulang semua kontak tanpa filter
        await fetchContacts();
        await fetchSchools();
      }
    } catch (err) {
      console.error("❌ Import error:", err);
      setModal({
        isOpen: true,
        type: "error",
        data: {
          message: "Gagal mengimpor kontak. Pastikan format file sudah benar.",
        },
      });
    } finally {
      // ✅ Reset state upload
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActionLoading(null);
    }
  };


  // ==========================
  // Edit/Delete contact
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
    } catch {
      setModal({
        isOpen: true,
        type: "error",
        data: { message: "Gagal memperbarui kontak." },
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRequest = (id) =>
    setModal({ isOpen: true, type: "delete", data: { id } });

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
    } catch {
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

  const resetFilter = () => {
    setSchool("");
    setKelas("");
    setSearch("");
    setTahun("");
  };

  // ==========================
  // UI
  // ==========================
  return (
    <div className="bg-gray-100 min-h-screen text-gray-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Daftar Kontak</h1>
          <span className="text-sm text-gray-600">
            Total kontak: <strong>{contacts.length}</strong>
          </span>
        </header>

        {/* FILTER & ACTIONS */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-col sm:flex-row flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama / nomor..."
            className="bg-gray-50 border border-gray-300 rounded-md text-sm p-2.5 flex-1"
          />

          <select
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            className="border border-gray-300 rounded-md p-2 text-sm bg-white"
          >
            <option value="">Semua Sekolah</option>
            {schoolsList.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Kelas */}
          <select
            value={kelas}
            onChange={(e) => setKelas(e.target.value)}
            className="border border-gray-300 rounded-md p-2 text-sm bg-white"
          >
            <option value="">Semua Kelas</option>
            {uniqueClasses.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>

          {/* Tahun Lulus */}
          <select
            value={tahun}
            onChange={(e) => setTahun(e.target.value)}
            className="border border-gray-300 rounded-md p-2 text-sm bg-white"
          >
            <option value="">Semua Tahun</option>
            {uniqueYears.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>


          <button
            onClick={resetFilter}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Reset Filter
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleExport}
              disabled={actionLoading === "export"}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-2 px-4 rounded-md transition"
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
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-2 px-4 rounded-md transition"
            >
              <FileUp size={18} />
              <span>Import</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition"
            >
              <span>+ Tambah Kontak</span>
            </button>
          </div>
        </div>

        {/* TABEL KONTAK */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <LoaderCircle className="animate-spin text-indigo-500" size={48} />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500">Tidak ada kontak ditemukan.</p>
              {(search || school || kelas) && (
                <p className="text-gray-400 text-sm mt-1">
                  Coba ubah atau reset filter.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                  <tr>
                    <th className="px-6 py-3">Nama</th>
                    <th className="px-6 py-3">Nomor WA</th>
                    <th className="px-6 py-3 hidden lg:table-cell">Asal Sekolah</th>
                    <th className="px-6 py-3 hidden lg:table-cell">Kelas</th>
                    <th className="px-6 py-3 hidden lg:table-cell">Tahun Lulus</th>
                    <th className="px-6 py-3 hidden md:table-cell">Terakhir Diperbarui</th>
                    <th className="px-6 py-3 text-center">Aksi</th>
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
                          c.waNumber || "-"
                        )}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">{(c.school || "-").toUpperCase()}</td>
                      <td className="px-6 py-4 hidden lg:table-cell">{(c.kelas || "-").toUpperCase()}</td>
                      <td className="px-6 py-4 hidden lg:table-cell">{(c.tahunLulus || "-").toUpperCase()}</td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        {new Date(c.updatedAt).toLocaleString("id-ID")}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {editing === c._id ? (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => saveEdit(c._id)}
                              disabled={actionLoading === c._id}
                              className="text-green-500 hover:text-green-600"
                            >
                              Simpan
                            </button>
                            <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-700">
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-center">
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
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL HAPUS */}
        {modal.isOpen && modal.type === "delete" && (
          <CustomModal
            isOpen={modal.isOpen}
            onClose={closeModal}
            title="Konfirmasi Hapus"
          >
            <p className="text-gray-700 mb-4">
              Apakah Anda yakin ingin menghapus kontak ini?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800"
              >
                Batal
              </button>
              <button
                onClick={() => deleteContact(modal.data.id)}
                className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white"
              >
                Hapus
              </button>
            </div>
          </CustomModal>
        )}
        {/* MODAL TAMBAH KONTAK */}
        {isAddModalOpen && (
          <CustomModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            title="Tambah Kontak Manual"
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = {
                  name: addName.trim(),
                  waNumber: addNumber.trim(),
                  school,
                  kelas,
                  tahunLulus: tahun,
                };

                if (!formData.name || !formData.waNumber) {
                  alert("Nama dan Nomor WA wajib diisi!");
                  return;
                }

                setActionLoading("add");
                try {
                  const res = await api.post("/api/contacts", formData, {
                    headers: { Authorization: `Bearer ${token}` },
                  });

                  if (res.data.ok) {
                    setContacts((prev) => [...prev, res.data.data]);
                    setAddName("");
                    setAddNumber("");
                    setIsAddModalOpen(false);
                    setModal({
                      isOpen: true,
                      type: "success",
                      data: { message: "Kontak berhasil ditambahkan." },
                    });
                  }
                } catch (err) {
                  console.error("❌ Error tambah kontak:", err);
                  setModal({
                    isOpen: true,
                    type: "error",
                    data: { message: "Gagal menambah kontak." },
                  });
                } finally {
                  setActionLoading(null);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  placeholder="Masukkan nama kontak"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nomor WhatsApp
                </label>
                <input
                  type="text"
                  value={addNumber}
                  onChange={(e) => {
                    // hanya izinkan angka
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setAddNumber(val);
                  }}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Contoh: 6281234567890"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sekolah
                  </label>
                  <select
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  >
                    <option value="">Pilih Sekolah</option>
                    {schoolsList.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kelas
                  </label>
                  <select
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  >
                    <option value="">Pilih Kelas</option>
                    {uniqueClasses.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tahun Lulus
                  </label>
                  <select
                    value={tahun}
                    onChange={(e) => setTahun(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  >
                    <option value="">Pilih Tahun</option>
                    {uniqueYears.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === "add"}
                  className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {actionLoading === "add" ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </CustomModal>
        )}
      </div>
    </div>
  );
}
