import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { Pencil, Trash2, Eye, Search, Plus, X, EyeOff, FileDown } from "lucide-react";
import api from "../../utils/api";

export default function UserManagement() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [userToDelete, setUserToDelete] = useState(null);
  const [userDetail, setUserDetail] = useState(null);

  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "user",
  });

  // === Fetch Users ===
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      if (data.ok) {
        const sorted = data.users.sort((a, b) => {
          if (a.role === "admin" && b.role !== "admin") return -1;
          if (a.role !== "admin" && b.role === "admin") return 1;
          return a.username.localeCompare(b.username);
        });
        setUsers(sorted);
      }
    } catch (err) {
      console.error("Gagal ambil users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // === Create / Update ===
  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editId ? `/api/users/${editId}` : "/api/users";
    const method = editId ? "put" : "post";
    const payload = { ...formData };
    if (editId && !payload.password) delete payload.password;

    try {
      const res = await api[method](url, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) {
        fetchUsers();
        closeFormModal();
      } else alert(res.data.message || "Gagal menyimpan user");
    } catch (err) {
      console.error("Gagal simpan user:", err);
    }
  };

  // === Delete ===
  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/api/users/${userToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
      closeDeleteModal();
    } catch (err) {
      console.error("Gagal hapus user:", err);
    }
  };

  // === Aktif / Nonaktifkan ===
  const handleToggleStatus = async (id, active) => {
    try {
      await api.patch(
        `/api/users/${id}/status`,
        { active: !active },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchUsers();
    } catch (err) {
      console.error("Gagal ubah status user:", err);
    }
  };

  // === Modal Controls ===
  const openFormModal = (user = null) => {
    if (user) {
      setFormData({ username: user.username, password: "", role: user.role });
      setEditId(user._id);
    } else {
      setFormData({ username: "", password: "", role: "user" });
      setEditId(null);
    }
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditId(null);
    setPasswordVisible(false);
    setFormData({ username: "", password: "", role: "user" });
  };

  const openDeleteModal = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setUserToDelete(null);
    setShowDeleteModal(false);
  };

  const openDetailModal = (user) => {
    setUserDetail(user);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setUserDetail(null);
    setShowDetailModal(false);
  };

  // === Filter Search ===
  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [users, searchTerm]
  );

  const ActionButton = ({ icon: Icon, text, onClick, className }) => (
    <button
      onClick={onClick}
      className={`relative group flex items-center justify-center p-2 rounded-full transition-colors duration-200 ${className}`}
    >
      <Icon size={18} />
      <span className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {text}
      </span>
    </button>
  );

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Manajemen Pengguna</h1>
          <p className="text-gray-500 mt-1">
            Kelola akun, peran, dan status pengguna sistem.
          </p>
        </div>

        {/* Search + Add */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cari pengguna..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              <FileDown size={16} />
              <span>Ekspor</span>
            </button>
            <button
              onClick={() => openFormModal()}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 text-sm font-medium"
            >
              <Plus size={16} />
              <span>Tambah User</span>
            </button>
          </div>
        </div>

        {/* Tabel */}
        <div className="bg-white shadow-md rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="bg-gray-50 text-xs text-gray-700 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Pengguna</th>
                  <th className="p-4">Peran</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center p-8 text-gray-500">
                      Memuat data pengguna...
                    </td>
                  </tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <tr key={u._id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4 flex items-center space-x-4">
                        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-700 font-bold">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{u.username}</p>
                          <p className="text-gray-500 text-xs">{u.username}@lp3i.ac.id</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                            u.role === "admin"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                            u.active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.active ? "bg-green-600" : "bg-red-600"
                            }`}
                          ></span>
                          {u.active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {u.role !== "admin" && (
                            <button
                              onClick={() => handleToggleStatus(u._id, u.active)}
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                u.active
                                  ? "bg-yellow-500 text-white hover:bg-yellow-600"
                                  : "bg-green-500 text-white hover:bg-green-600"
                              }`}
                            >
                              {u.active ? "Suspend" : "Aktifkan"}
                            </button>
                          )}
                          <ActionButton
                            icon={Eye}
                            text="Detail"
                            onClick={() => openDetailModal(u)}
                            className="text-blue-500 hover:bg-blue-100"
                          />
                          <ActionButton
                            icon={Pencil}
                            text="Edit"
                            onClick={() => openFormModal(u)}
                            className="text-yellow-500 hover:bg-yellow-100"
                          />
                          {u.role !== "admin" && (
                            <ActionButton
                              icon={Trash2}
                              text="Hapus"
                              onClick={() => openDeleteModal(u)}
                              className="text-red-500 hover:bg-red-100"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center p-8 text-gray-500">
                      Tidak ada pengguna yang ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* === MODAL DETAIL USER === */}
      {showDetailModal && userDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeDetailModal}
        >
          <div
            className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Detail Pengguna</h2>
                <p className="text-sm text-gray-500">
                  Informasi lengkap untuk {userDetail.username}
                </p>
              </div>
              <button onClick={closeDetailModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Username</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-semibold">
                    {userDetail.username}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {userDetail.username}@lp3i.ac.id
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Peran</dt>
                  <dd className="mt-1">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                        userDetail.role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {userDetail.role}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                        userDetail.active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          userDetail.active ? "bg-green-600" : "bg-red-600"
                        }`}
                      ></span>
                      {userDetail.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">ID Pengguna</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono bg-gray-100 p-2 rounded">
                    {userDetail._id}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex justify-end pt-6 mt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={closeDetailModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit */}
      {showFormModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeFormModal}
        >
          <div
            className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {editId ? "Edit Pengguna" : "Tambah Pengguna Baru"}
              </h2>
              <button onClick={closeFormModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  placeholder="Contoh: budi.sentosa"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={passwordVisible ? "text" : "password"}
                    placeholder={editId ? "Isi untuk mengubah" : "Minimal 6 karakter"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    required={!editId}
                    minLength={editId ? 0 : 6}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500"
                  >
                    {passwordVisible ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peran</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeDeleteModal}
        >
          <div
            className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900">Konfirmasi Hapus</h3>
            <p className="mt-2 text-sm text-gray-600">
              Apakah Anda yakin ingin menghapus pengguna{" "}
              <span className="font-bold">{userToDelete?.username}</span>? Tindakan ini tidak dapat
              dibatalkan.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
