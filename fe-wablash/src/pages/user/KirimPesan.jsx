import { useRef, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../../context/AuthContext";
import { socket } from "../../utils/socket";
import { useBlast } from "../../context/BlastContext";
import {
  Variable,
  ChevronDown,
  Smile,
  Paperclip,
  Eye,
  Send,
  Save,
  CheckCheck,
  Smartphone,
  Italic,
  Bold,
} from "lucide-react";
import LiveChat from "./LiveChat";
import api from "../../utils/api"; // 🔑 axios instance

// helper: bikin Title Case
const toTitleCase = (str) => {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// helper: bikin UPPERCASE (khusus beasiswa)
const toUpper = (str) => (str ? String(str).toUpperCase() : "");


// helper format tanggal
const formatDate = (val) => {
  if (!val) return "";
  if (typeof val === "number") {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      return `${String(parsed.d).padStart(2, "0")}-${String(parsed.m).padStart(
        2,
        "0"
      )}-${parsed.y}`;
    }
  }
  const d = new Date(val);
  if (!isNaN(d)) {
    return `${String(d.getDate()).padStart(2, "0")}-${String(
      d.getMonth() + 1
    ).padStart(2, "0")}-${d.getFullYear()}`;
  }
  return "";
};

export default function KirimPesan() {
  const { user, token } = useAuth();
  const { message, setMessage, currentBlast, setCurrentBlast } = useBlast();
  const [recipients, setRecipients] = useState([]);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [delay, setDelay] = useState(5);
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [randomDelay, setRandomDelay] = useState(false);
  const [minDelay, setMinDelay] = useState(3);
  const [maxDelay, setMaxDelay] = useState(7);
  const [pauseEvery, setPauseEvery] = useState(20);
  const [pauseDuration, setPauseDuration] = useState(60);
  const [maxPerBatch, setMaxPerBatch] = useState(50);
  const [maxPerDay, setMaxPerDay] = useState(300);
  const [blastId, setBlastId] = useState(null);
  const intervalRef = useRef(null);

  // restore blastId dari localStorage
  useEffect(() => {
    const savedBlastId = localStorage.getItem("currentBlastId");
    if (savedBlastId) {
      setBlastId(savedBlastId);
    }
  }, []);

  // pause blast
  const handlePauseBlast = async () => {
    if (!currentBlast?.blastId) return;
    try {
      const { data } = await api.post(`/api/blasts/${currentBlast.blastId}/pause`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.ok) {
        setCurrentBlast((prev) => ({
          ...prev,
          status: "paused",
          statusText: "⏸️ Blast dijeda user",
        }));
      } else {
        alert(data.message || "Gagal menjeda blast");
      }
    } catch (err) {
      console.error("Error pause blast:", err);
    }
  };

  // resume blast
  const handleResumeBlast = async () => {
    if (!currentBlast?.blastId) return;
    try {
      const { data } = await api.post(`/api/blasts/${currentBlast.blastId}/resume`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.ok) {
        setCurrentBlast((prev) => ({
          ...prev,
          status: "active",
          statusText: "▶️ Blast dilanjutkan",
        }));
      } else {
        alert(data.message || "Gagal melanjutkan blast");
      }
    } catch (err) {
      console.error("Error resume blast:", err);
    }
  };

  const [pending, setPending] = useState(0);
  const [waConnected, setWaConnected] = useState(false);
  const [blastLogs, setBlastLogs] = useState([]);
  const [showChatDrawer, setShowChatDrawer] = useState(false);

  // fetch templates & wa status
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data } = await api.get("/api/templates", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data.ok) setTemplates(data.templates);
      } catch (err) {
        console.error("Gagal fetch templates:", err);
      }
    };

    const fetchWaStatus = async () => {
      try {
        const { data } = await api.get("/api/wa/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data.ok) setWaConnected(data.connected);
      } catch (err) {
        console.error("Gagal cek WA status:", err);
      }
    };

    fetchTemplates();
    fetchWaStatus();
  }, [token]);

  // polling blast progress
  useEffect(() => {
      if (!blastId) return;
  
      intervalRef.current = setInterval(async () => {
        try {
          const API_URL = import.meta.env.VITE_API_URL;
          const res = await fetch(`${API_URL}/api/blasts/${blastId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.ok) {
            const b = data.blast;
  
            // total recipients
            const totalRecipients = Array.isArray(b.recipients) ? b.recipients.length : 0;
  
            // hitung jumlah status langsung dari recipients (ground truth)
            let sent = 0;
            let delivered = 0;
            let read = 0;
            let played = 0;
            let failed = 0;
  
            b.recipients.forEach((r) => {
              if (r.status === "failed") {
                failed++;
              } else if (r.status === "played") {
                // played = sudah sent + delivered + read
                played++;
                read++;
                delivered++;
                sent++;
              } else if (r.status === "read") {
                read++;
                delivered++;
                sent++;
                if (r.played) played++;
              } else if (r.status === "delivered") {
                delivered++;
                sent++;
              } else if (r.status === "sent") {
                sent++;
              }
            });
  
            // definisi status
            const PENDING = new Set(["queued", "pending"]); // status batch ketahan
            const FINAL = new Set([
              "sent", "delivered", "read", "played",
              "failed", "cancelled", "stopped", "completed"
            ]);
  
            // hitung pending & selesai
            const pendingCount = b.recipients.filter((r) => PENDING.has(r.status)).length;
            const doneCount = b.recipients.filter((r) => FINAL.has(r.status)).length;
  
            // progress global
            const rawProgress = Math.round((doneCount / (totalRecipients || 1)) * 100);
            const progress = Math.min(100, Math.max(0, rawProgress));
  
            // update state
            setCurrentBlast((prev) => ({
              ...prev,
              blastId: b._id,
              total: totalRecipients,
              progress,
              current: doneCount,
              sent,
              delivered,
              read,
              played,
              failed,
              pending: pendingCount,             // FE cek tombol batch dari sini
              maxPerBatch: b.maxPerBatch || 0,   // biar tombol batch bisa muncul
              maxPerDay: b.maxPerDay || 0,
              status: b.status,                  // simpan status global (active/paused/stopped)
            }));
  
            // kondisi selesai → semua recipient status final
            if (doneCount >= totalRecipients && pendingCount === 0) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
              setBlastId(null);
              localStorage.removeItem("currentBlastId");
              setCurrentBlast((prev) => ({
                ...prev,
                loading: false,
                statusText: "🎉 Blast selesai! Semua batch sudah terkirim.",
              }));
            }
          }
        } catch (err) {
          console.error("Gagal fetch blast progress:", err);
        }
      }, 5000);
  
      return () => {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      };
    }, [blastId, token, setCurrentBlast]);
  
  // helper: sama seperti backend
  const normalizePhone = (raw) => {
    if (!raw) return "";
    let p = String(raw).trim().replace(/\D/g, "");
    if (p.startsWith("62")) return p;
    if (p.startsWith("0")) return "62" + p.slice(1);
    if (p.startsWith("8")) return "62" + p;
    return p;
  };

  // index penerima by phone → buat lookup cepat (nama, sekolah)
  const recipientsIndexRef = useRef(new Map());
  useEffect(() => {
    const map = new Map();
    (recipients || []).forEach(r => {
      const key = normalizePhone(r.phone || r.number);
      if (key) map.set(key, r);
    });
    recipientsIndexRef.current = map;
  }, [recipients]);
  // socket listener
  useEffect(() => {
    if (!socket) return;

    // mapping prioritas status (jangan nurunin status kalau udah lebih tinggi)
    const statusPriority = {
      sent: 1,
      delivered: 2,
      read: 3,
      played: 4,
      failed: 100,
    };

    // status terakhir per nomor
    const recipientStatus = new Map();

    const statusLabel = {
      sent: "terkirim",
      delivered: "sudah diterima",
      read: "sudah dibaca",
      played: "media diputar",
      failed: "gagal",
    };

    const handleStatus = (data) => {
      // 1) normalisasi & validasi phone
      const phoneNorm = normalizePhone(data.phone || data.to || "");
      if (!phoneNorm) return;                           // 🔒 skip event tanpa nomor
      if (!recipientsIndexRef.current.has(phoneNorm)) { // 🔒 skip kalau bukan bagian blast ini
        return;
      }

      const status = (data.status || "").toLowerCase();
      const prev = recipientStatus.get(phoneNorm);
      if (!prev || statusPriority[status] >= statusPriority[prev]) {
        recipientStatus.set(phoneNorm, status);
      }

      // 2) ambil meta penerima dari index (biar ada nama & sekolah)
      const rec = recipientsIndexRef.current.get(phoneNorm);

      // 3) update log (hindari duplikasi nomor+status)

      setBlastLogs((prev) => {
        const exists = prev.some(
          (l) => l.number === phoneNorm && l.status === statusLabel[status]
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            name: rec?.name || data.name || "-",
            number: phoneNorm,
            school: rec?.school || data.school || "",
            status: statusLabel[status] || status,
          },
        ];
      });

      // hitung ulang counter dari semua nomor yang ada di map
      setCurrentBlast((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };

        let sent = 0, delivered = 0, read = 0, played = 0, failed = 0;
        recipientStatus.forEach((s, num) => {
          if (!recipientsIndexRef.current.has(num)) return;
          if (s === "failed") {
            failed++;
          } else if (s === "played") {
            played++; read++; delivered++; sent++;
          } else if (s === "read") {
            read++; delivered++; sent++;
          } else if (s === "delivered") {
            delivered++; sent++;
          } else if (s === "sent") {
            sent++;
          }
        });

        updated.sent = sent;
        updated.delivered = delivered;
        updated.read = read;
        updated.played = played;
        updated.failed = failed;

        const uniqueCount = Array.from(recipientStatus.keys())
          .filter((num) => recipientsIndexRef.current.has(num)).length;

        updated.current = uniqueCount;
        updated.progress = Math.min(
          100,
          Math.round((uniqueCount / (updated.total || 1)) * 100)
        );
        return updated;
      });
    };

    socket.on("message:status", handleStatus);
    return () => socket.off("message:status", handleStatus);
  }, [socket, recipients, setCurrentBlast, setBlastLogs]);

  // send blast
  const handleSend = async () => {
    if (!waConnected) {
      alert("⚠️ WhatsApp belum terhubung!");
      return;
    }
    if (!attachment && !message && (!randomTemplate || selectedTemplates.length === 0)) {
      alert("Harus isi pesan manual ATAU pilih template acak ATAU upload file!");
      return;
    }
    if (recipients.length === 0) {
      alert("Kontak wajib diisi!");
      return;
    }

    try {
      let mediaUrl = null, mimetype = null;
      if (attachment) {
        const formData = new FormData();
        formData.append("file", attachment);
        const { data: uploadData } = await api.post("/api/upload", formData, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
        });
        if (uploadData.ok) {
          mediaUrl = uploadData.filename;
          mimetype = uploadData.mimetype;
        }
      }

      const { data } = await api.post("/api/blasts", {
        contacts: recipients.map((r) => ({
          name: r.name || r.fullname || r.phone, // fallback biar aman
          phone: r.phone || r.number || "",      // WAJIB isi phone
          school: r.school || "",
          lulus: r.lulus || "",
          beasiswa: r.beasiswa || "",
          kelas: r.kelas || "",
          prestasi: r.prestasi || "",
          orangtua: r.orangtua || "",
          birthdate: r.birthdate || "",
        })),
        templates: randomTemplate
          ? templates.filter((tpl) => selectedTemplates.includes(tpl._id)).map((tpl) => tpl.message)
          : [message],
        delayMin: randomDelay ? minDelay : delay,
        delayMax: randomDelay ? maxDelay : delay,
        pauseEvery,
        pauseDuration,
        maxPerBatch,
        maxPerDay,
        content: { text: message, mediaUrl, mimetype },
        randomTemplate,
        randomMode,
        perN,
        selectedTemplates,
      }, { headers: { Authorization: `Bearer ${token}` } });


      if (data.ok) {
        console.log("🚀 Blast ID:", data.blastId);
        setBlastId(data.blastId);
        localStorage.setItem("currentBlastId", data.blastId);
      }
    } catch (err) {
      console.error("Error send blast:", err);
    }
  };

  // continue / cancel / stop batch
  const handleContinueBatch = async () => {
    await api.post(`/api/blasts/continue/${currentBlast.blastId}`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  const handleCancelBatch = async () => {
    await api.post(`/api/blasts/${currentBlast.blastId}/cancel`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  const handleStopBlast = async () => {
    await api.post(`/api/blasts/${currentBlast.blastId}/stop`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  const sampleRecipient = recipients.length > 0 ? recipients[0] : null;

  const handleAttachment = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachment(file);
    }
  };

  // handle upload kontak dari file Excel/CSV
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      // mapping data sesuai kolom di Excel
      const mapped = rows.map((row) => {
        const fullname = toTitleCase(row["NAMA LENGKAP"] || row["Nama"] || row["fullname"] || "");
        return {
          phone: row["NO HANDPHONE"] || row["Handphone"] || row["HP"] || "", // 🔥 WAJIB
          name: fullname,
          school: toTitleCase(row["ASAL SEKOLAH"] || row["Sekolah"] || ""),
          kelas: toTitleCase(row["KELAS"] || ""),
          lulus: row["LULUS"] || row["Tahun Lulus"] || "",
          beasiswa: toUpper(row["KODE BEASISWA"] || row["Beasiswa"] || ""), // 🔥 CAPSLOCK only
          prestasi: toTitleCase(row["PRESTASI"] || ""),
          orangtua: toTitleCase(row["PEKERJAAN ORANGTUA"] || row["Orangtua"] || ""),
          birthdate: formatDate(row["TANGGAL LAHIR"] || row["Tanggal Lahir"] || ""),
        };
      });

      setRecipients(mapped);
      console.log("✅ Kontak berhasil dimuat:", mapped.length, "kontak");
      console.log("📦 Sample data:", mapped[0]);
    } catch (err) {
      console.error("❌ Gagal baca file kontak:", err);
      alert("Format file tidak valid! Pastikan pakai template yang benar.");
    }
  };

  // === Placeholder & Emoji ===
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

  const emojis = [
    "😀","😁","😂","🤣","😊","😍","😘","🤩","😎","👍",
    "🙏","🎉","🔥","❤️","💯"
  ];

  // === Render message dengan placeholder ===
  const renderMessage = (template, data) => {
    if (!template || !data) return template;
    return template
      .replace(/{{fullname}}/g, data.fullname || "")
      .replace(/{{first_name}}/g, data.first_name || "")
      .replace(/{{middle_name}}/g, data.middle_name || "")
      .replace(/{{last_name}}/g, data.last_name || "")
      .replace(/{{birthdate}}/g, data.birthdate || "")
      .replace(/{{school}}/g, data.school || "")
      .replace(/{{beasiswa}}/g, data.beasiswa || "")
      .replace(/{{kelas}}/g, data.kelas || "")
      .replace(/{{lulus}}/g, data.lulus || "")
      .replace(/{{prestasi}}/g, data.prestasi || "")
      .replace(/{{orangtua}}/g, data.orangtua || "");
  };

  // === Insert teks ke cursor textarea ===
  const insertAtCursor = (text) => {
    const textarea = document.getElementById("kirim-message");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMessage =
      message.slice(0, start) + text + message.slice(end);

    setMessage(newMessage);
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }, 0);
  };

  // === Format teks Bold/Italic ===
  const formatText = (style) => {
    const textarea = document.getElementById("kirim-message");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = message.slice(start, end);
    if (!selected) return;

    let wrapped = selected;
    if (style === "bold") wrapped = `*${selected}*`;
    if (style === "italic") wrapped = `_${selected}_`;

    setMessage(message.slice(0, start) + wrapped + message.slice(end));
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start;
      textarea.selectionEnd = start + wrapped.length;
    }, 0);
  };
  // random template config
  const [randomTemplate, setRandomTemplate] = useState(false);
  const [randomMode, setRandomMode] = useState("per_message");
  const [perN, setPerN] = useState(5);
  const [selectedTemplates, setSelectedTemplates] = useState([]);

  
  return (
    <div className="page p-4 lg:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            Kirim Pesan Blast
            <span
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                waConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
            >
              <Smartphone className="w-3 h-3" />
              {waConnected ? "WA Terhubung" : "Belum Scan"}
            </span>
          </h3>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setShowPlaceholder((s) => !s)} className="px-3 py-1 border rounded flex items-center">
              <Variable className="w-4 h-4 mr-1" /> Placeholder
              <ChevronDown className="w-4 h-4" />
            </button>
            <button onClick={() => setShowEmoji((s) => !s)} className="px-3 py-1 border rounded flex items-center">
              <Smile className="w-4 h-4 mr-1" /> Emoji
            </button>
            <button onClick={() => setShowTemplateModal(true)} className="px-3 py-1 border rounded flex items-center">
              📑 Template
            </button>
            <button onClick={() => formatText("italic")} className="px-3 py-1 border rounded flex items-center">
              <Italic className="w-4 h-4 mr-1" /> Italic
            </button>
            <button onClick={() => formatText("bold")} className="px-3 py-1 border rounded flex items-center">
              <Bold className="w-4 h-4 mr-1" /> Bold
            </button>
            <label className="px-3 py-1 border rounded flex items-center cursor-pointer">
              <Paperclip className="w-4 h-4 mr-1" /> Media/Doc
              <input type="file" onChange={handleAttachment} className="hidden" />
            </label>
            <button onClick={() => setShowPreviewModal(true)} className="px-3 py-1 border rounded flex items-center">
              <Eye className="w-4 h-4 mr-1" /> Preview
            </button>
          </div>

          {/* Placeholder List */}
          {showPlaceholder && (
            <div className="border rounded-md p-3 mb-3 bg-gray-50 dark:bg-gray-700 shadow-sm">
              <h4 className="text-xs font-semibold mb-2 text-gray-500 dark:text-gray-300">
                Pilih Placeholder
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {placeholders.map((ph) => (
                  <button
                    key={ph.key}
                    onClick={() => insertAtCursor(ph.key)}
                    className="text-left px-2 py-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  >
                    {ph.label} <span className="text-gray-400">({ph.key})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Emoji Picker */}
          {showEmoji && (
            <div className="border rounded p-2 mb-2 bg-white dark:bg-gray-700 flex flex-wrap gap-2">
              {emojis.map((em, idx) => (
                <button key={idx} onClick={() => insertAtCursor(em)} className="text-xl hover:scale-110">
                  {em}
                </button>
              ))}
            </div>
          )}
          {/* Modal Preview */}
          {showPreviewModal && sampleRecipient && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex justify-center items-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-4">
                <div className="relative w-full mx-auto bg-gray-200 dark:bg-gray-900 rounded-3xl border-8 border-gray-700 dark:border-gray-600">
                  <div className="h-6 bg-gray-700 dark:bg-gray-600 rounded-t-2xl flex justify-center items-center">
                    <div className="w-12 h-1.5 bg-gray-800 dark:bg-gray-700 rounded-full"></div>
                  </div>
                  <div className="h-80 bg-[#ece5dd]">
                    <div className="p-3 flex flex-col h-full">
                      <div className="flex-grow overflow-y-auto pr-2">
                        <div className="flex justify-end mb-3">
                          <div className="max-w-xs">
                            <div className="bg-[#dcf8c6] dark:bg-green-900 text-gray-800 dark:text-gray-200 p-2.5 rounded-xl rounded-tr-none shadow whitespace-pre-wrap">
                              <p>{renderMessage(message, sampleRecipient)}</p>
                              <p className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
                                10:35 AM{" "}
                                <CheckCheck className="inline-block w-4 h-4 text-blue-500" />
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <button onClick={() => setShowPreviewModal(false)} className="py-2 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Template */}
          {showTemplateModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
                <h4 className="text-lg font-semibold mb-4">Pilih Template</h4>
                {templates.length === 0 ? (
                  <p className="text-gray-500">Belum ada template...</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {templates.map((tpl) => (
                      <button
                        key={tpl._id}
                        onClick={() => {
                          setMessage(tpl.message);
                          setShowTemplateModal(false);
                        }}
                        className="block w-full text-left border p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <h5 className="font-bold">{tpl.title}</h5>
                        <p className="text-sm text-gray-500 truncate">{tpl.message}</p>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex justify-end mt-4">
                  <button onClick={() => setShowTemplateModal(false)} className="px-4 py-2 bg-gray-200 rounded-md">
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}
    
          {/* Pesan */}
          <textarea
            id="kirim-message"
            rows="8"
            className="w-full p-3 border rounded-lg min-h-[160px] resize-y"
            placeholder="Tulis pesan... gunakan {{first_name}} untuk nama awal"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {attachment && <p className="text-sm text-gray-600 mt-2">📎 {attachment.name}</p>}

          {/* Progress */}
          {currentBlast && (
            <div className="mt-6">
              {/* 🔥 Kontrol Tombol */}
              <div className="mt-3 flex gap-2">
                {/* Tampilkan Lanjutkan Batch / Batalkan Batch
                    hanya kalau maxPerBatch diaktifkan DAN ada pending */}
                {currentBlast?.pending > 0 &&
                currentBlast?.maxPerBatch > 0 &&
                currentBlast?.maxPerBatch < currentBlast?.total &&
                currentBlast?.status !== "active" ? (
                  <>
                    <button
                      onClick={handleContinueBatch}
                      className="px-3 py-2 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      Lanjutkan Batch ({currentBlast.pending})
                    </button>
                    <button
                      onClick={handleCancelBatch}
                      className="px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Batalkan Batch
                    </button>
                  </>
                ) : (
                  (currentBlast?.current < currentBlast?.total) && (
                    <>
                      {currentBlast?.status === "active" && (
                        <button
                          onClick={handlePauseBlast}
                          className="px-3 py-2 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          Jeda
                        </button>
                      )}
                      {currentBlast?.status === "paused" && (
                        <button
                          onClick={handleResumeBlast}
                          className="px-3 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Lanjutkan
                        </button>
                      )}
                      <button
                        onClick={handleStopBlast}
                        className="px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Stop
                      </button>
                    </>
                  )
                )}
              </div>
              <h4 className="font-semibold mb-2 mt-4">Progress Pengiriman</h4>

              {/* Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                <div
                  className="bg-indigo-600 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, currentBlast.progress || 0)}%` }}
                ></div>
              </div>

              {/* Detail */}
              <p className="text-sm mt-2">
                {currentBlast.current}/{currentBlast.total} selesai
              </p>
              <p className="text-sm mt-1">{currentBlast.statusText}</p>
              {/* Log pengiriman realtime */}
              {blastLogs.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <h4 className="font-semibold mb-2 text-sm text-gray-700">Aktivitas Pengiriman</h4>
                  <div className="max-h-40 overflow-y-auto text-sm space-y-1">
                    {blastLogs.slice(-10).reverse().map((log, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded ${
                          log.status === "gagal"
                            ? "bg-red-50 text-red-700"
                            : "bg-green-50 text-green-700"
                        }`}
                      >
                        <div className="flex-1">
                          <p className="font-medium">
                            Sedang mengirim pesan ke{" "}
                            <span className="text-gray-800 font-semibold">{log.number}</span>{" "}
                            - {log.name}
                          </p>
                          {log.school && (
                            <p className="text-xs text-gray-500 mt-0.5">{log.school}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 ml-2 text-xs font-bold uppercase">
                          {log.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Floating Chat */}
        <button onClick={() => setShowChatDrawer(true)} className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 z-50">
          💬
        </button>

        {showChatDrawer && (
          <div className="fixed inset-0 bg-black/30 flex justify-end z-50">
            <div className="w-full sm:w-[400px] h-full bg-white shadow-lg flex flex-col">
              <div className="p-3 border-b flex justify-between items-center">
                <h3 className="font-bold">Live Chat Presenter {user?.username || "Guest"}</h3>
                <button onClick={() => setShowChatDrawer(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <LiveChat mini />
              </div>
            </div>
          </div>
        )}
        {/* Right Pengaturan */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md lg:sticky lg:top-4 h-fit">
          <h3 className="font-semibold mb-4">Pengaturan</h3>
          <div className="space-y-4">
            {/* Upload Kontak */}
            <div>
              <label className="block text-sm font-medium">Kontak Tujuan</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="mt-1 block w-full text-sm text-gray-500"
              />
              {recipients.length > 0 && (
                <p className="text-sm text-gray-600 mt-2">{recipients.length} kontak berhasil dimuat</p>
              )}
            </div>
            {/* Delay Settings */}
            <div className={`relative ${currentBlast?.blastId && currentBlast?.status === "active" ? "opacity-60 pointer-events-none" : ""}`}>
              <label className="block text-sm font-medium">Delay per Pesan</label>

              {/* Checkbox Random Delay */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="randomDelay"
                  checked={randomDelay}
                  onChange={(e) => setRandomDelay(e.target.checked)}
                  disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                />
                <label htmlFor="randomDelay" className="text-sm">Aktifkan Random Delay</label>
              </div>

              {!randomDelay && (
                <input
                  type="number"
                  value={delay}
                  min={1}
                  onChange={(e) => setDelay(Number(e.target.value))}
                  className="mt-2 block w-full border rounded-md p-2"
                  disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                />
              )}

              {randomDelay && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="number"
                    value={minDelay}
                    min={1}
                    onChange={(e) => setMinDelay(Number(e.target.value))}
                    className="w-20 border rounded p-2"
                    placeholder="Min"
                    disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                  />
                  <input
                    type="number"
                    value={maxDelay}
                    min={minDelay + 1}
                    onChange={(e) => setMaxDelay(Number(e.target.value))}
                    className="w-20 border rounded p-2"
                    placeholder="Max"
                    disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                  />
                </div>
              )}

              <div className="mt-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Mode delay:{" "}
                  <span className="font-medium">
                    {randomDelay ? `Random (${minDelay}-${maxDelay} detik)` : `Fixed (${delay} detik)`}
                  </span>
                </p>
              </div>
            </div>

            {/* Anti-ban Settings */}
            <div className={`mt-4 space-y-3 ${currentBlast?.blastId && currentBlast?.status === "active" ? "opacity-60 pointer-events-none" : ""}`}>
              <div>
                <label className="block text-sm font-medium">Pause Every</label>
                <input
                  type="number"
                  value={pauseEvery}
                  onChange={(e) => setPauseEvery(Number(e.target.value))}
                  className="mt-1 block w-full border rounded-md p-2"
                  disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                />
                <p className="text-xs text-gray-500">Berhenti setiap {pauseEvery} pesan</p>
              </div>

              <div>
                <label className="block text-sm font-medium">Pause Duration (detik)</label>
                <input
                  type="number"
                  value={pauseDuration}
                  onChange={(e) => setPauseDuration(Number(e.target.value))}
                  className="mt-1 block w-full border rounded-md p-2"
                  disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Max Per Batch</label>
                <input
                  type="number"
                  value={maxPerBatch}
                  onChange={(e) => setMaxPerBatch(Number(e.target.value))}
                  className="mt-1 block w-full border rounded-md p-2"
                  disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Max Per Day</label>
                <input
                  type="number"
                  value={maxPerDay}
                  onChange={(e) => setMaxPerDay(Number(e.target.value))}
                  className="mt-1 block w-full border rounded-md p-2"
                  disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                />
              </div>
            </div>

            {/* Random Template Settings */}
            <div className={`mt-4 space-y-3 border-t pt-3 ${currentBlast?.blastId && currentBlast?.status === "active" ? "opacity-60 pointer-events-none" : ""}`}>
              <label className="block text-sm font-medium">Random Template</label>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="randomTemplate"
                  checked={randomTemplate}
                  onChange={(e) => setRandomTemplate(e.target.checked)}
                  disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                />
                <label htmlFor="randomTemplate" className="text-sm">Aktifkan Random Template</label>
              </div>

              {randomTemplate && (
                <>
                  <div>
                    <label className="block text-sm font-medium">Mode Random</label>
                    <select
                      value={randomMode}
                      onChange={(e) => setRandomMode(e.target.value)}
                      className="mt-1 block w-full border rounded-md p-2"
                      disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                    >
                      <option value="per_message">Per Pesan (acak tiap pesan)</option>
                      <option value="per_n">Per N Pesan</option>
                    </select>
                  </div>

                  {randomMode === "per_n" && (
                    <div>
                      <label className="block text-sm font-medium">Ganti setiap N pesan</label>
                      <input
                        type="number"
                        value={perN}
                        min={1}
                        onChange={(e) => setPerN(Number(e.target.value))}
                        className="mt-1 block w-full border rounded-md p-2"
                        disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium">Pilih Template Acak</label>
                    <div className="mt-1 max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                      {templates.length === 0 ? (
                        <p className="text-gray-500 text-sm">Belum ada template tersimpan.</p>
                      ) : (
                        templates.map((tpl) => (
                          <label key={tpl._id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTemplates.includes(tpl._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTemplates([...selectedTemplates, tpl._id]);
                                } else {
                                  setSelectedTemplates(selectedTemplates.filter((id) => id !== tpl._id));
                                }
                              }}
                              disabled={currentBlast?.blastId && currentBlast?.status === "active"}
                            />
                            <span className="text-sm">{tpl.title || tpl.message.slice(0, 40)}...</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleSend}
                disabled={
                  currentBlast?.loading ||
                  !waConnected ||
                  (currentBlast?.blastId && currentBlast?.status === "active")
                }
                className={`w-full flex justify-center py-2 px-4 rounded-md text-white ${
                  currentBlast?.blastId && currentBlast?.status === "active"
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                <Send className="w-4 h-4 mr-2" />
                {currentBlast?.blastId && currentBlast?.status === "active"
                  ? "Sedang Mengirim..."
                  : currentBlast?.loading
                  ? "Mengirim..."
                  : waConnected
                  ? "Kirim Sekarang"
                  : "WA Belum Terhubung"}
              </button>

              <button
                className="w-full flex justify-center py-2 px-4 border rounded-md text-gray-700 bg-white hover:bg-gray-50"
                disabled={currentBlast?.blastId && currentBlast?.status === "active"}
              >
                <Save className="w-4 h-4 mr-2" /> Simpan Draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
