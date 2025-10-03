import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Pencil, Trash2, Eye } from "lucide-react";
import api from "../../utils/api"; // 🔥 axios instance

export default function UserManagement() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({ username: "", password: "", role: "user" });

  const fetchUsers = async () => {
    try {
      const res = await api.get("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      if (data.ok) {
        // Urutkan: admin dulu, baru user
        const sorted = data.users.sort((a, b) => {
          if (a.role === "admin" && b.role !== "admin") return -1;
          if (a.role !== "admin" && b.role === "admin") return 1;
          return 0;
        });
        setUsers(sorted);
      }
    } catch (err) {
      console.error("Gagal ambil users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Tambah / Update User
  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editId ? `/api/users/${editId}` : "/api/users";
    const method = editId ? "put" : "post";

    try {
      const res = await api[method](url, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      if (data.ok) {
        fetchUsers();
        setShowModal(false);
        setFormData({ username: "", password: "", role: "user" });
        setEditId(null);
      } else {
        alert(data.message || "Gagal simpan user");
      }
    } catch (err) {
      console.error("Gagal simpan user:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Yakin hapus user ini?")) return;
    try {
      await api.delete(`/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
    } catch (err) {
      console.error("Gagal hapus user:", err);
    }
  };

  const handleEdit = (user) => {
    setFormData({ username: user.username, password: "", role: user.role });
    setEditId(user._id);
    setShowModal(true);
  };

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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manajemen User</h1>
          <p className="text-gray-500">Total {users.length} pengguna.</p>
        </div>
        <div className="flex space-x-2">
          <button className="border px-3 py-1 rounded text-sm cursor-pointer">
            Excel
          </button>
          <button className="border px-3 py-1 rounded text-sm cursor-pointer">
            PDF
          </button>
          <button
            onClick={() => {
              setFormData({ username: "", password: "", role: "user" });
              setEditId(null);
              setShowModal(true);
            }}
            className="bg-purple-600 text-white px-3 py-1 rounded cursor-pointer"
          >
            + Tambah User
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600 text-left">
              <th className="p-3">User</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Kuota Blast</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-b hover:bg-gray-50">
                <td className="p-3 flex items-center space-x-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-700 font-bold">
                    {u.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{u.username}</p>
                    <p className="text-gray-500 text-xs">{u.username}@lp3i.ac.id</p>
                  </div>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      u.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      u.active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {u.active ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="p-3">99.999</td>
                <td className="p-3 text-center space-x-2">
                  <button
                    onClick={() => handleToggleStatus(u._id, u.active)}
                    className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
                      u.active ? "bg-red-500 text-white" : "bg-green-500 text-white"
                    }`}
                  >
                    {u.active ? "Suspend" : "Aktifkan"}
                  </button>
                  <button className="rounded cursor-pointer text-blue-500 hover:text-blue-700">
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleEdit(u)}
                    className="rounded cursor-pointer text-yellow-500 hover:text-yellow-700"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(u._id)}
                    className="rounded cursor-pointer text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah/Edit */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-200/40 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-96">
            <h2 className="text-lg font-bold mb-4">
              {editId ? "Edit User" : "Tambah User"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Username"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                className="w-full border p-2 rounded"
                required
              />
              <input
                type="password"
                placeholder={editId ? "Password baru (opsional)" : "Password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full border p-2 rounded"
                required={!editId}
              />
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="w-full border p-2 rounded cursor-pointer"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-400 text-white px-3 py-1 rounded cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 text-white px-3 py-1 rounded cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
