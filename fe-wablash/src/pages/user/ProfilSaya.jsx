import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Camera } from "lucide-react";

export default function ProfilSaya() {
  const { token } = useAuth();
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // state untuk ubah password
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Ambil data profil user saat load
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.ok) setFormData(data.user);
      } catch (err) {
        console.error("Gagal fetch profil:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [token]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.ok) {
        alert("Profil berhasil diperbarui");
        setFormData(data.user);
      } else {
        alert("Gagal update profil: " + data.message);
      }
    } catch (err) {
      console.error("Error update profil:", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        alert("Password berhasil diubah");
        setShowPasswordModal(false);
        setOldPassword("");
        setNewPassword("");
      } else {
        alert("Gagal ubah password: " + data.message);
      }
    } catch (err) {
      console.error("Error update password:", err);
    } finally {
      setSavingPassword(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append("photo", file);

    setUploading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/profile/photo`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formDataUpload,
      });
      const data = await res.json();
      if (data.ok) {
        alert("Foto profil berhasil diubah");
        setFormData(data.user);
      } else {
        alert("Gagal upload foto: " + data.message);
      }
    } catch (err) {
      console.error("Error upload foto:", err);
    } finally {
      setUploading(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  if (loading) return <p>Loading...</p>;
  if (!formData) return <p>Data user tidak ditemukan</p>;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
      <h3 className="text-xl font-semibold mb-4">Profil Saya</h3>

      {/* Foto Profil */}
      <div className="flex items-center space-x-6 mb-6">
        <img
          src={
            formData.photo
              ? formData.photo
              : "https://placehold.co/100x100/6366f1/ffffff?text=SM"
          }
          alt="User Avatar"
          className="w-24 h-24 rounded-full object-cover"
        />
        <div>
          <label className="py-2 px-4 text-sm font-medium text-white bg-indigo-600 rounded-lg flex items-center gap-2 cursor-pointer">
            <Camera size={16} /> {uploading ? "Mengupload..." : "Ubah Foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </label>
          <p className="text-xs text-gray-500 mt-2">JPG, PNG. Maks 1MB.</p>
        </div>
      </div>

      {/* Form Profil */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username || ""}
              onChange={handleChange}
              className="mt-1 w-full rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm">Nama Lengkap</label>
            <input
              type="text"
              name="name"
              value={formData.name || ""}
              onChange={handleChange}
              className="mt-1 w-full rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm">Nomor WA Blasting</label>
            <input
              type="text"
              name="phone"
              value={formData.phone || ""}
              onChange={handleChange}
              className="mt-1 w-full rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm">Jabatan</label>
            <input
              type="text"
              value={formData.jabatan || ""}
              disabled
              className="mt-1 w-full rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm">Tempat, Tanggal Lahir</label>
            <input
              type="text"
              name="ttl"
              value={formData.ttl || ""}
              onChange={handleChange}
              className="mt-1 w-full rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm">Pendidikan Terakhir</label>
            <input
              type="text"
              value={formData.pendidikan || ""}
              disabled
              className="mt-1 w-full rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm">Jenis Kelamin</label>
            <input
              type="text"
              value={formData.jenisKelamin || ""}
              disabled
              className="mt-1 w-full rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm">Terakhir Login</label>
            <input
              type="text"
              value={formatDateTime(formData.lastActive)}
              disabled
              className="mt-1 w-full rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="py-2 px-6 rounded-lg text-white bg-yellow-600 hover:bg-yellow-700"
          >
            Ubah Password
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`py-2 px-6 rounded-lg text-white ${
              saving
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>

      {/* Modal Ubah Password */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex justify-center items-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-4">
            <h3 className="text-lg font-semibold mb-4">Ubah Password</h3>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm">Password Lama</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="mt-1 w-full rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm">Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-md dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="py-2 px-4 rounded-lg bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className={`py-2 px-4 rounded-lg text-white ${
                    savingPassword
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {savingPassword ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
