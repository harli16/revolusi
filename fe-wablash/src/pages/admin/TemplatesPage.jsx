import { useEffect, useState } from "react";
import { Plus, Trash2, RefreshCcw, CheckCircle2 } from "lucide-react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

export default function TemplatesPage() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newTemplate, setNewTemplate] = useState("");

  const fetchTemplates = async () => {
    try {
      const res = await api.get("/api/templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) setTemplates(res.data.data);
    } catch (err) {
      console.error("Gagal ambil template:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const addTemplate = async () => {
    if (!newTemplate.trim()) return;
    await api.post(
      "/api/templates",
      { text: newTemplate },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewTemplate("");
    fetchTemplates();
  };

  const deleteTemplate = async (id) => {
    await api.delete(`/api/templates/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchTemplates();
  };

  if (loading)
    return (
      <div className="text-center text-gray-500 py-20">
        Memuat template...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Template Global</h2>
        <button
          onClick={() => {
            setRefreshing(true);
            fetchTemplates();
          }}
          className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium shadow-sm transition ${
            refreshing
              ? "bg-gray-200 text-gray-600"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          <RefreshCcw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Add Template */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex gap-3">
        <input
          value={newTemplate}
          onChange={(e) => setNewTemplate(e.target.value)}
          placeholder="Tulis template baru..."
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
        />
        <button
          onClick={addTemplate}
          className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
        >
          <Plus size={16} /> Tambah
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-gray-600 text-left">
              <th className="py-3 px-4">#</th>
              <th>Template</th>
              <th>Status</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t, i) => (
              <tr
                key={t._id}
                className="border-b hover:bg-indigo-50/40 transition-colors"
              >
                <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                <td className="max-w-md">{t.text}</td>
                <td>
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                    <CheckCircle2 size={14} />
                    Aktif
                  </span>
                </td>
                <td className="text-right">
                  <button
                    onClick={() => deleteTemplate(t._id)}
                    className="p-2 rounded-lg bg-red-100 hover:bg-red-200 transition"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            Belum ada template global
          </p>
        )}
      </div>
    </div>
  );
}
