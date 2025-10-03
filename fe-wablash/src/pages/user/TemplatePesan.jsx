import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useBlast } from "../../context/BlastContext";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api"; // ✅ pakai axios instance
import {
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  Variable,
  Smile,
} from "lucide-react";

export default function TemplatePesan() {
  const { token } = useAuth();
  const { setMessage } = useBlast();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: "", message: "" });
  const [editId, setEditId] = useState(null);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const placeholders = [
    { key: "{{fullname}}", label: "NAMA LENGKAP" },
    { key: "{{first_name}}", label: "Nama Awal" },
    { key: "{{middle_name}}", label: "Nama Tengah" },
    { key: "{{last_name}}", label: "Nama Akhir" },
    { key: "{{birthdate}}", label: "Tanggal Lahir" },
    { key: "{{school}}", label: "Asal Sekolah" },
    { key: "{{beasiswa}}", label: "Beasiswa" },
    { key: "{{kelas}}", label: "Kelas" },
    { key: "{{lulus}}", label: "Tahun Lulus" },
    { key: "{{prestasi}}", label: "Prestasi" },
    { key: "{{orangtua}}", label: "Pekerjaan Orangtua" },
  ];

  const emojis = ["😀","😁","😂","🤣","😊","😍","😘","🤩","😎","👍","🙏","🎉","🔥","❤️","💯"];

  // ambil semua template
  const fetchTemplates = async () => {
    try {
      const res = await api.get("/api/templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setTemplates(res.data.templates);
    } catch (err) {
      console.error("Gagal fetch templates:", err);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // tambah / update template
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editId ? `/api/templates/${editId}` : "/api/templates";
      const method = editId ? "put" : "post";

      const res = await api[method](url, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.ok) {
        setShowModal(false);
        setFormData({ title: "", message: "" });
        setEditId(null);
        fetchTemplates();
      }
    } catch (err) {
      console.error("Gagal simpan template:", err);
    }
  };

  // hapus template
  const handleDelete = async (id) => {
    if (!window.confirm("Yakin hapus template ini?")) return;
    try {
      const res = await api.delete(`/api/templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) fetchTemplates();
    } catch (err) {
      console.error("Gagal hapus template:", err);
    }
  };

  // insert placeholder/emoji
  const insertAtCursor = (text) => {
    const textarea = document.getElementById("template-message");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = formData.message.slice(0, start);
    const after = formData.message.slice(end);
    const newMessage = before + text + after;

    setFormData((prev) => ({ ...prev, message: newMessage }));

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }, 0);
  };

  const insertPlaceholder = (ph) => {
    insertAtCursor(" " + ph);
    setShowPlaceholder(false);
  };

  const insertEmoji = (emoji) => {
    insertAtCursor(emoji);
    setShowEmoji(false);
  };

  const handleGunakan = (tpl) => {
    setMessage(tpl.message);
    navigate("/user/kirim-pesan");
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Template Pesan</h3>
        <button
          onClick={() => {
            setFormData({ title: "", message: "" });
            setEditId(null);
            setShowModal(true);
          }}
          className="flex items-center py-2 px-4 rounded-md text-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" /> Tambah Template
        </button>
      </div>

      {/* List Template */}
      {templates.length === 0 ? (
        <p className="text-gray-500">Belum ada template...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl._id}
              className="p-4 border rounded-lg dark:border-gray-700"
            >
              <h4 className="font-bold">{tpl.title}</h4>
              <p className="text-sm text-gray-500 mt-1 line-clamp-3">
                {tpl.message}
              </p>
              <div className="mt-3 flex space-x-2">
                <button
                  className="text-xs text-indigo-600 flex items-center"
                  onClick={() => handleGunakan(tpl)}
                >
                  <MessageSquare className="w-3 h-3 mr-1" /> Gunakan
                </button>
                <button
                  onClick={() => {
                    setFormData({
                      title: tpl.title,
                      message: tpl.message,
                    });
                    setEditId(tpl._id);
                    setShowModal(true);
                  }}
                  className="text-xs text-yellow-600 flex items-center"
                >
                  <Pencil className="w-3 h-3 mr-1" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(tpl._id)}
                  className="text-xs text-red-600 flex items-center"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex justify-center items-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-4">
            <h4 className="text-lg font-semibold mb-4">
              {editId ? "Edit Template" : "Tambah Template"}
            </h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Judul</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="mt-1 block w-full border rounded-md p-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Pesan</label>
                <div className="flex items-center space-x-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setShowPlaceholder((s) => !s)}
                    className="flex items-center px-2 py-1 border rounded text-sm"
                  >
                    <Variable className="w-4 h-4 mr-1" /> Placeholder
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmoji((s) => !s)}
                    className="flex items-center px-2 py-1 border rounded text-sm"
                  >
                    <Smile className="w-4 h-4 mr-1" /> Emoji
                  </button>
                </div>

                {showPlaceholder && (
                  <div className="border rounded p-2 mb-2 bg-white dark:bg-gray-700">
                    {placeholders.map((ph) => (
                      <button
                        key={ph.key}
                        type="button"
                        onClick={() => insertPlaceholder(ph.key)}
                        className="block w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        {ph.label} ({ph.key})
                      </button>
                    ))}
                  </div>
                )}

                {showEmoji && (
                  <div className="border rounded p-2 mb-2 bg-white dark:bg-gray-700 flex flex-wrap gap-2">
                    {emojis.map((em, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => insertEmoji(em)}
                        className="text-xl hover:scale-110"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  id="template-message"
                  rows="4"
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className="mt-1 block w-full border rounded-md p-2"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditId(null);
                  }}
                  className="px-4 py-2 bg-gray-200 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md"
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
