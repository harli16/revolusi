import { useEffect, useState, useRef } from "react";
import { socket } from "../../utils/socket";
import { useAuth } from "../../context/AuthContext";
import {
  FaSearch,
  FaArrowLeft,
  FaPaperclip,
  FaPaperPlane,
  FaGrin,
} from "react-icons/fa";
import { Smartphone } from "lucide-react";
import { IoSend } from "react-icons/io5";
import EmojiPicker from "emoji-picker-react"; // 🔥 emoji picker
import DyaVanMsgLogo from "../../assets/DyaVanMsgLogo.png";
import api from "../../utils/api"; // ✅ axios instance

export default function LiveChat({ mini = false }) {
  const { user, token } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [waConnected, setWaConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const emojiRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [mediaTab, setMediaTab] = useState("media"); // "media" | "document" | "link"
  const [mediaItems, setMediaItems] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Tutup panel media otomatis saat ganti kontak
  useEffect(() => {
    setShowMediaPanel(false);
  }, [activeContact]);

  // ==========================
  // Fetch total unread
  // ==========================
  useEffect(() => {
    if (!waConnected) return;
    const fetchUnread = async () => {
      try {
        const res = await api.get("/api/chat/unread", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.ok) setTotalUnread(res.data.totalUnread);
      } catch (err) {
        console.error("❌ Error fetch total unread:", err);
      }
    };
    fetchUnread();
  }, [token, waConnected, contacts]);

  // Tutup emoji picker kalau klik luar
  useEffect(() => {
    function handleClickOutside(e) {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    }

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // ==========================
  // Cek WA status
  // ==========================
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.get("/api/wa/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.ok) setWaConnected(res.data.connected);
      } catch (err) {
        console.error("❌ Error cek WA status:", err);
      }
    };
    fetchStatus();
  }, [token]);

  // ==========================
  // Ambil daftar kontak
  // ==========================
  useEffect(() => {
    if (!waConnected) return;
    const fetchContacts = async () => {
      try {
        const res = await api.get("/api/chat/contacts", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.ok) setContacts(res.data.data);
      } catch (err) {
        console.error("❌ Error fetch contacts:", err);
      }
    };
    fetchContacts();
  }, [token, waConnected]);

  // ==========================
  // Ambil riwayat chat saat pilih kontak (dengan highlight support)
  // ==========================
  const loadHistory = async (waNumber, highlightText = "") => {
    try {
      setActiveContact(waNumber);
      setContacts((prev) =>
        prev.map((c) => (c._id === waNumber ? { ...c, unread: 0 } : c))
      );

      const res = await api.get(`/api/chat/history/${waNumber}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.ok) {
        const normalized = res.data.data.map((m) => ({
          ...m,
          direction: m.direction || (m.fromSelf ? "out" : "in"),
          status: m.status || "pending",
          providerId: m.providerId || null,
        }));

        setMessages(normalized);

        // 🔥 tunggu render dulu (pakai observer bukan timeout biasa)
        setTimeout(() => {
          if (highlightText) {
            const query = highlightText.toLowerCase();
            const tryScroll = () => {
              const target = document.querySelector(
                `.chat-message[data-message*="${query}"]`
              );
              if (target) {
                console.log("🎯 Found highlight target:", query);
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                target.classList.add("bg-yellow-100");
                setTimeout(() => target.classList.remove("bg-yellow-500"), 2000);
                return true;
              }
              return false;
            };

            // coba beberapa kali karena React render asinkron
            let attempts = 0;
            const interval = setInterval(() => {
              if (tryScroll() || attempts > 10) clearInterval(interval);
              attempts++;
            }, 200);
          } else {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }
        }, 500);
      }

      await api.post(`/api/chat/read/${waNumber}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      console.error("❌ Error fetch history:", err);
    }
    scrollToBottom();
  };

  // ==========================
  // Global search (chat + contact)
  // ==========================
  const handleSearch = async (e) => {
    const term = e.target.value;
    setSearchTerm(term.toLowerCase());

    if (!term.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await api.get(`/api/chat/search?q=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.ok) {
        setSearchResults(res.data.data);
      }
    } catch (err) {
      console.error("❌ Error search global:", err);
    }
  };

  // ==========================
  // Socket listener (FINAL FIXED)
  // ==========================
  useEffect(() => {
    // Pastikan socket connect
    // if (!socket.connected) socket.connect();
    // ✅ Join ke room user
    if (user?._id || user?.id) {
      socket.emit("join", user?._id || user?.id);
      console.log("✅ Joined socket room:", user?._id || user?.id);
    }

    // Debug koneksi
    socket.on("connect", () => console.log("✅ Socket connected"));
    socket.on("disconnect", (r) => console.log("❌ Socket disconnected:", r));

    // 🔥 Debug semua event
    socket.onAny((event, data) => {
      console.log("📩 SOCKET EVENT:", event, data);
    });

    // ✅ Realtime pesan baru (FIX: badge + stay chat logic)
    socket.on("chat:new", (payload) => {
      const {
        id,
        waNumber,
        message,
        text,
        fileUrl,
        fileName,
        mimeType,
        createdAt,
        ts,
        direction,
        fromSelf,
        waName,
        providerId,
        status,
      } = payload;

      // ❗Lewatin kalau pesan keluar (outgoing)
      if (fromSelf || direction === "out") return;

      // ===== Tambah ke daftar pesan aktif =====
      setMessages((prev) => {
        const exists =
          (id && prev.some((m) => m.id === id)) ||
          (providerId && prev.some((m) => m.providerId === providerId));
        if (exists) return prev;

        return [
          ...prev,
          {
            id,
            providerId,
            waNumber,
            message: message || text,
            fileUrl,
            fileName,
            mimeType,
            createdAt: createdAt || new Date(),
            direction: direction || "in",
            status: status || "pending",
          },
        ];
      });

      // ===== Update daftar kontak (badge logic fix) =====
      setContacts((prev) => {
        const filtered = prev.filter((c) => c._id !== waNumber);
        const existing = prev.find((c) => c._id === waNumber);
        const isActive = activeContact === waNumber;

        const updated = [
          {
            _id: waNumber,
            name: waName || existing?.name || waNumber,
            lastMessage: message || text,
            lastAt: createdAt || ts || new Date(),
            // 🧠 kalau sedang buka obrolan ini → jangan tambah unread
            unread: isActive ? 0 : (existing?.unread || 0) + 1,
          },
          ...filtered,
        ];

        // langsung urutkan biar chat aktif tetap di atas
        return updated.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
      });

      // ===== Kalau chat ini sedang aktif → auto mark-read backend =====
      if (activeContact === waNumber) {
        api
          .post(`/api/chat/read/${waNumber}`, {}, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch((err) => console.error("❌ Failed mark read:", err));
        setContacts((prev) =>
          prev.map((c) =>
            c._id === waNumber ? { ...c, unread: 0 } : c
          )
        );
      }
    });

    // ✅ Realtime update status centang
    socket.on("message:status", ({ providerId, status, phone }) => {
      console.log("📬 Update status masuk:", { providerId, status, phone });

      setMessages((prev) =>
        prev.map((m) => {
          const sameProvider =
            (m.providerId || "").toLowerCase() === (providerId || "").toLowerCase();
          const samePhone =
            phone && m.waNumber === phone && m.direction === "out";

          if (sameProvider || samePhone) {
            return {
              ...m,
              status,
              read:
                status === "read" || status === "played" ? true : m.read,
            };
          }
          return m;
        })
      );
    });

    // Cleanup listener sekali aja
    return () => {
      socket.off("chat:new");
      socket.off("message:status");
      socket.offAny();
    };
  }, []); // ⬅️ penting: dependency kosong, biar listener cuma sekali aja

  // Auto-scroll tiap ada message baru
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ==========================
  // Kirim pesan (teks / file)
  // ==========================
  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !activeContact) return;
      if (!activeContact) {
          console.warn("❌ Tidak ada kontak aktif, pesan tidak dikirim");
          return;
        }
        if (!newMessage.trim() && !selectedFile) {
          console.warn("❌ Pesan kosong, tidak dikirim");
          return;
        }
    try {
      const formData = new FormData();
      formData.append("waNumber", activeContact);
      if (newMessage.trim()) formData.append("message", newMessage);
      if (selectedFile) formData.append("file", selectedFile);

      const res = await api.post("/api/chat/send", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("🚀 Kirim pesan hasil backend:", res.data.data);

      // ✅ Tambahkan providerId biar bisa diupdate statusnya
      if (res.data.ok && res.data.data) {
        const { waNumber, message, providerId, fileUrl, fileName, mimeType } = res.data.data;
        setMessages((prev) => [
          ...prev,
          {
            waNumber,
            message,
            fileUrl,
            fileName,
            mimeType,
            direction: "out",
            providerId,
            status: "pending",
            createdAt: new Date(),
          },
        ]);
        // 🔥 langsung reset badge kontak aktif
        setContacts((prev) =>
          prev.map((c) =>
            c._id === activeContact ? { ...c, unread: 0 } : c
          )
        );
      }

      setNewMessage("");
      setSelectedFile(null);
      setShowEmojiPicker(false);
    } catch (err) {
      console.error("❌ Error send message:", err);
    }
  };

  // 🧩 Fungsi fetchMedia
  const fetchMedia = async (waNumber, tab = "media") => {
    setLoadingMedia(true); // 🔥 indikator loading ON
    try {
      const res = await api.get(`/api/chat/${waNumber}/media?type=${tab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list = res.data.medias || res.data.data || res.data.results || [];
      console.log("📸 Data media diterima:", list, "Tab:", tab);

      // ✅ Tambahan fallback: kalau tab media kosong, ambil semua file
      if (list.length === 0 && tab === "media") {
        const resAll = await api.get(`/api/chat/${waNumber}/media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const allList = resAll.data.medias || [];
        setMediaItems(allList);
      } else {
        setMediaItems(list);
      }
    } catch (err) {
      console.error("❌ Error fetch media:", err);
    } finally {
      setLoadingMedia(false); // 🔥 indikator loading OFF
    }
  };

  // ==========================
  // Render
  // ==========================
  if (!waConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[85vh] bg-white rounded-lg shadow">
        <Smartphone className="w-10 h-10 text-red-500 mb-3" />
        <h2 className="text-lg font-semibold text-red-600">
          WhatsApp belum terhubung
        </h2>
        <p className="text-gray-500 mt-1 text-center px-4">
          Silakan scan QR di halaman utama untuk mengaktifkan live chat.
        </p>
      </div>
    );
  }

  return (
    <div className={`${mini ? "h-[85vh]" : "flex h-[85vh] rounded-lg shadow bg-white"}`}>
      {/* ===== MINI MODE (drawer) ===== */}
      {mini ? (
        !activeContact ? (
          <div className="h-full bg-white flex flex-col">
            {/* Header */}
            <header className="bg-gray-100 p-3 flex items-center border-b border-gray-200">
              <img
                src={DyaVanMsgLogo}
                alt="Logo"
                className="rounded-full w-8 h-8 object-contain mr-3"
              />
              <span className="font-semibold text-gray-800">
                Live Chat Account {user?.username || "Guest"}
                {totalUnread > 0 && (
                  <span className="ml-2 text-sm bg-green-500 text-white rounded-full px-2 py-0.5">
                    {totalUnread}
                  </span>
                )}
              </span>
            </header>

            {/* Search Bar */}
            <div className="p-3 bg-white border-b border-gray-100">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari kontak atau isi chat..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full bg-gray-100 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              {isSearching ? (
                searchResults.length > 0 ? (
                  searchResults.map((r) => (
                    <div
                      key={r._id}
                      onClick={() => loadHistory(r._id, r.lastMatch)}
                      className="flex items-center p-3 cursor-pointer hover:bg-gray-50"
                    >
                      <img
                        src={`https://placehold.co/48x48/2563eb/ffffff?text=${r.name?.[0] || "?"}`}
                        alt={r.name}
                        className="rounded-full w-10 h-10 mr-3"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{r.name || r._id}</h3>
                        <p className="text-sm text-gray-600 truncate">
                          {r.lastMatch || "Hasil chat ditemukan"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="p-3 text-gray-500 italic">
                    Tidak ditemukan hasil untuk “{searchTerm}”
                  </p>
                )
              ) : contacts.length === 0 ? (
                <p className="p-3 text-gray-500">Belum ada kontak</p>
              ) : (
                contacts.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => loadHistory(c._id)}
                    className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 ${
                      activeContact === c._id ? "bg-teal-50" : ""
                    }`}
                  >
                    <img
                      src={`https://placehold.co/48x48/2563eb/ffffff?text=${c.name?.[0] || "?"}`}
                      alt={c.name || c._id}
                      className="rounded-full w-10 h-10 mr-3 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold truncate">{c.name || c._id}</h3>
                        <div className="flex flex-col items-end flex-shrink-0 ml-2">
                          <span className="text-xs text-gray-500">
                            {c.lastAt
                              ? new Date(c.lastAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                          {c.unread > 0 && (
                            <span className="bg-green-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                              {c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                      <p
                        className={`text-sm ${
                          c.unread > 0 ? "font-semibold text-gray-900" : "text-gray-600"
                        } truncate`}
                        style={{ maxWidth: "200px" }}
                      >
                        {c.lastMessage}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* ===== MINI MODE: Chat Window ===== */
          <div className="h-full bg-white flex flex-col">
            <header className="bg-gray-100 p-3 flex items-center justify-between border-b border-gray-200">
              <div className="flex items-center">
                <img
                  src={`https://placehold.co/40x40/2563eb/ffffff?text=${
                    contacts.find((c) => c._id === activeContact)?.name?.[0] || "?"
                  }`}
                  alt={activeContact}
                  className="rounded-full w-10 h-10 mr-3"
                />
                <div>
                  <h2 className="font-semibold text-gray-800">
                    {contacts.find((c) => c._id === activeContact)?.name || activeContact}
                  </h2>
                  <p className="text-xs text-gray-500">online</p>
                </div>
              </div>

              {/* Tombol Media 📸 */}
              <button
                onClick={() => {
                  setShowMediaPanel(true);
                  fetchMedia(activeContact, "media");
                }}
                className="text-sm bg-teal-500 text-white px-3 py-1 rounded-lg hover:bg-teal-600"
              >
                📎 Media
              </button>
            </header>


            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-200">
              {messages.map((m, idx) => (
                <div
                  key={(m.providerId || m._id || m.id || idx) + m.status}
                  className={`flex ${m.direction === "out" ? "justify-end" : ""}`}
                >
                  <div
                    data-message={(m.message || "").toLowerCase()}
                    className={`chat-message rounded-lg p-3 max-w-[80%] shadow ${
                      m.direction === "out" ? "bg-[#dcf8c6]" : "bg-white"
                    }`}
                  >
                    <p className="text-gray-800">{m.message || m.text}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs text-gray-400">
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                      {m.direction === "out" && (
                        <span className="text-xs ml-1 select-none">
                          {(() => {
                            const st = (m.status || "pending").toLowerCase();
                            if (st === "pending") return "⏳";
                            if (st === "sent") return "✓";
                            if (st === "delivered")
                              return <span className="text-blue-500">✓✓</span>;
                            if (st === "read")
                              return <span className="text-gray-600">✓✓</span>;
                            if (st === "played")
                              return <span className="text-blue-500">✓✓</span>;
                            if (st === "failed")
                              return <span className="text-red-500">❌</span>;
                            return null;
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <footer className="bg-gray-100 p-3 flex flex-col">
              {selectedFile && (
                <div className="flex flex-col bg-gray-200 px-3 py-2 mb-2 rounded-lg text-sm text-gray-700">
                  <div className="flex justify-between items-center mb-1">
                    <span className="truncate">
                      📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="ml-3 text-red-500 hover:text-red-700 text-xs"
                    >
                      ❌ Batal
                    </button>
                  </div>
                  {selectedFile.type.startsWith("image/") && (
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="preview"
                      className="rounded-lg max-w-[200px] shadow"
                    />
                  )}
                </div>
              )}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((p) => !p)}
                  className="text-gray-500 hover:text-gray-700 mx-2"
                >
                  <FaGrin className="w-5 h-5" />
                </button>
                {showEmojiPicker && (
                  <div
                    ref={emojiRef}
                    className="absolute bottom-14 right-3 z-50 shadow-lg bg-white rounded"
                  >
                    <EmojiPicker
                      onEmojiClick={(emoji) => {
                        setNewMessage((prev) => prev + emoji.emoji);
                        inputRef.current?.focus();
                      }}
                    />
                  </div>
                )}
                <label className="text-gray-500 hover:text-gray-700 mx-2 cursor-pointer">
                  <FaPaperclip className="w-5 h-5" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        console.log("📎 File selected:", file.name);
                      }
                    }}
                  />
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Ketik pesan..."
                  className="w-full bg-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  onClick={sendMessage}
                  className="bg-[#25D366] hover:bg-[#20b954] text-white rounded-full p-3 flex items-center justify-center ml-3 transition shadow"
                >
                  <IoSend className="w-5 h-5 transform -rotate-45" />
                </button>
              </div>
            </footer>
          </div>
        )
      ) : (
        <div className="flex h-full w-full rounded-lg shadow bg-white">
          {/* Sidebar */}
          <div className="w-1/3 flex flex-col">
            <header className="bg-gray-100 p-3 flex items-center border-b border-gray-200">
              <img
                src={DyaVanMsgLogo}
                alt="Logo"
                className="rounded-full w-10 h-10 object-contain mr-3"
              />
              <span className="font-semibold text-gray-800">
                Live Chat Presenter {user?.username || "Guest"}
              </span>
            </header>

            {/* Search */}
            <div className="p-3 bg-white border-b border-gray-100">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari kontak atau isi chat..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full bg-gray-100 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Contact / Search Result */}
            <div className="flex-1 overflow-y-auto">
              {isSearching ? (
                searchResults.length > 0 ? (
                  searchResults.map((r) => (
                    <div
                      key={r._id}
                      onClick={() => loadHistory(r._id, r.lastMatch)}
                      className="flex items-center p-3 cursor-pointer hover:bg-gray-50"
                    >
                      <img
                        src={`https://placehold.co/48x48/2563eb/ffffff?text=${r.name?.[0] || "?"}`}
                        alt={r.name}
                        className="rounded-full w-10 h-10 mr-3"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{r.name || r._id}</h3>
                        <p className="text-sm text-gray-600 truncate">
                          {r.lastMatch || "Hasil chat ditemukan"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="p-3 text-gray-500 italic">
                    Tidak ditemukan hasil untuk “{searchTerm}”
                  </p>
                )
              ) : contacts.length === 0 ? (
                <p className="p-3 text-gray-500">Belum ada kontak</p>
              ) : (
                contacts.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => loadHistory(c._id)}
                    className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 ${
                      activeContact === c._id ? "bg-teal-50" : ""
                    }`}
                  >
                    <img
                      src={`https://placehold.co/48x48/2563eb/ffffff?text=${c.name?.[0] || "?"}`}
                      alt={c.name || c._id}
                      className="rounded-full w-12 h-12 mr-4 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold truncate">{c.name || c._id}</h3>
                        <div className="flex flex-col items-end flex-shrink-0 ml-2">
                          <span className="text-xs text-gray-500">
                            {c.lastAt
                              ? new Date(c.lastAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                          {c.unread > 0 && (
                            <span className="bg-green-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                              {c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                      <p
                        className={`text-sm ${
                          c.unread > 0 ? "font-semibold text-gray-900" : "text-gray-600"
                        } truncate`}
                        style={{ maxWidth: "200px" }}
                      >
                        {c.lastMessage}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className="w-2/3 flex flex-col bg-gray-200 relative">
            {!activeContact ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Pilih kontak untuk memulai chat
              </div>
            ) : (
              <>
                <header className="bg-gray-100 p-3 flex items-center justify-between border-b border-gray-200">
                  <div className="flex items-center">
                    <img
                      src={`https://placehold.co/40x40/2563eb/ffffff?text=${
                        contacts.find((c) => c._id === activeContact)?.name?.[0] || "?"
                      }`}
                      alt={activeContact}
                      className="rounded-full w-10 h-10 mr-3"
                    />
                    <div>
                      <h2 className="font-semibold text-gray-800">
                        {contacts.find((c) => c._id === activeContact)?.name || activeContact}
                      </h2>
                      <p className="text-xs text-gray-500">online</p>
                    </div>
                  </div>

                  {/* Tombol Media 📸 */}
                  <button
                    onClick={() => {
                      setShowMediaPanel(true);
                      fetchMedia(activeContact, "media");
                    }}
                    className="text-sm bg-teal-500 text-white px-3 py-1 rounded-lg hover:bg-teal-600"
                  >
                    📎 Media
                  </button>
                </header>


                {/* Messages */}
                <div className="flex-1 p-6 overflow-y-auto space-y-3 chat-bg">
                  {messages.length > 0 ? (
                    messages.map((m, idx) => (
                      <div
                        key={`${m.providerId || m._id || m.id || idx}-${m.status}`}
                        className={`flex ${m.direction === "out" ? "justify-end" : ""}`}
                      >
                        <div
                          data-message={(m.message || "").toLowerCase()}
                          className={`chat-message rounded-lg p-3 max-w-[80%] shadow ${
                            m.direction === "out" ? "bg-[#dcf8c6]" : "bg-white"
                          }`}
                        >
                        {m.fileUrl ? (
                          <div className="flex flex-col items-start">
                            {/* 🖼️ Gambar */}
                            {m.mimeType?.startsWith("image/") && (
                              <img
                                src={m.fileUrl}
                                alt={m.fileName || "Gambar"}
                                className="rounded-xl max-w-[220px] border border-gray-200 shadow-sm hover:brightness-105 transition"
                                onClick={() => setPreviewImage(m.fileUrl)}
                              />
                            )}

                            {/* 🎬 Video */}
                            {m.mimeType?.startsWith("video/") && (
                              <video
                                controls
                                className="rounded-lg max-w-[250px] shadow"
                              >
                                <source src={m.fileUrl} type={m.mimeType} />
                              </video>
                            )}

                            {/* 🎵 Audio */}
                            {m.mimeType?.startsWith("audio/") && (
                              <audio controls className="mt-2">
                                <source src={m.fileUrl} type={m.mimeType} />
                              </audio>
                            )}

                            {/* 📄 PDF */}
                            {m.mimeType?.includes("pdf") && (
                              <a
                                href={m.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline mt-1 text-sm"
                              >
                                📄 {m.fileName || "Buka Dokumen PDF"}
                              </a>
                            )}

                            {/* 🗂️ File lain */}
                            {!m.mimeType?.startsWith("image/") &&
                              !m.mimeType?.startsWith("video/") &&
                              !m.mimeType?.startsWith("audio/") &&
                              !m.mimeType?.includes("pdf") && (
                                <a
                                  href={m.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 underline mt-1 text-sm break-all"
                                >
                                  📎 {m.fileName || "Download File"}
                                </a>
                              )}

                            {/* 💬 Caption / pesan */}
                            {m.message && (
                              <p className="text-gray-800 text-sm mt-1 break-words">{m.message}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-800">{m.message}</p>
                        )}
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-xs text-gray-400">
                              {m.createdAt
                                ? new Date(m.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                            {m.direction === "out" && (
                              <span className="text-xs ml-1 select-none">
                                {(() => {
                                  const st = (m.status || "pending").toLowerCase();
                                  if (st === "pending") return "⏳";
                                  if (st === "sent") return "✓";
                                  if (st === "delivered")
                                    return <span className="text-blue-500">✓✓</span>;
                                  if (st === "read")
                                    return <span className="text-gray-600">✓✓</span>;
                                  if (st === "played")
                                    return <span className="text-blue-500">✓✓</span>;
                                  if (st === "failed")
                                    return <span className="text-red-500">❌</span>;
                                  return null;
                                })()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center">Belum ada pesan</p>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                {/* Input */}
                <footer className="bg-gray-100 p-3 flex flex-col">

                  {/* 🔥 Tambahkan blok preview di sini */}
                  {selectedFile && (
                    <div className="flex flex-col bg-gray-200 px-3 py-2 mb-2 rounded-lg text-sm text-gray-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="truncate">
                          📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="ml-3 text-red-500 hover:text-red-700 text-xs"
                        >
                          ❌ Batal
                        </button>
                      </div>
                      {selectedFile.type.startsWith("image/") && (
                        <img
                          src={URL.createObjectURL(selectedFile)}
                          alt="preview"
                          className="rounded-lg max-w-[200px] shadow"
                        />
                      )}
                    </div>
                  )}

                  {/* Input bar */}
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((p) => !p)}
                      className="text-gray-500 hover:text-gray-700 mx-2"
                    >
                      <FaGrin className="w-5 h-5" />
                    </button>
                    {showEmojiPicker && (
                      <div
                        ref={emojiRef}
                        className="absolute bottom-14 right-3 z-50 shadow-lg bg-white rounded"
                      >
                        <EmojiPicker
                          onEmojiClick={(emoji) => {
                            setNewMessage((prev) => prev + emoji.emoji);
                            inputRef.current?.focus();
                          }}
                        />
                      </div>
                    )}
                    <label className="text-gray-500 hover:text-gray-700 mx-2 cursor-pointer">
                      <FaPaperclip className="w-5 h-5" />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedFile(file);
                            console.log("📎 File selected:", file.name);
                          }
                        }}
                      />
                    </label>

                    <input
                      ref={inputRef}
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Ketik pesan..."
                      className="w-full bg-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      onClick={sendMessage}
                      className="bg-[#25D366] hover:bg-[#20b954] text-white rounded-full p-3 flex items-center justify-center ml-3 transition shadow"
                    >
                      <IoSend className="w-5 h-5 transform -rotate-45" />
                    </button>
                  </div>

                </footer>
              </>
            )}
          </div>
          {/* Panel Media */}
          {showMediaPanel && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition-opacity duration-300">
              <div className="bg-gray-50 rounded-xl shadow-xl w-[95%] max-w-4xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Media & File dari{" "}
                    {contacts.find((c) => c._id === activeContact)?.name || activeContact}
                  </h3>
                  <button
                    onClick={() => setShowMediaPanel(false)}
                    className="text-gray-400 hover:text-gray-800 hover:bg-gray-200 rounded-full p-1"
                  >
                    ✖
                  </button>
                </div>

                {/* Tabs */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex gap-2">
                    {[
                      { id: "media", label: "Media" },
                      { id: "document", label: "Dokumen" },
                      { id: "link", label: "Tautan" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setMediaTab(tab.id);
                          fetchMedia(activeContact, tab.id);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          mediaTab === tab.id
                            ? "bg-teal-500 text-white shadow"
                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                        }`}
                      >
                        {tab.id === "media" && "🖼️"}
                        {tab.id === "document" && "📄"}
                        {tab.id === "link" && "🔗"}
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Isi Panel */}
                <div className="flex-1 p-4 overflow-y-auto min-h-[50vh]">
                  {loadingMedia ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <span className="animate-spin text-3xl mb-2">⏳</span>
                      <span>Memuat...</span>
                    </div>
                  ) : mediaItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <p className="text-4xl mb-2">📂</p>
                      <p className="font-semibold">Belum ada {mediaTab}</p>
                      <p className="text-sm">File yang dibagikan akan muncul di sini.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {mediaItems.map((item, i) => (
                        <div
                          key={i}
                          className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden group transition-shadow hover:shadow-lg"
                        >
                          {/* Media type check */}
                          {(item.mimeType?.startsWith("image/") ||
                            item.mimeType?.startsWith("video/")) ? (
                            <div className="relative aspect-square w-full">
                              <img
                                loading="lazy"
                                src={item.fileUrl}
                                alt={item.fileName}
                                className="w-full h-full object-cover"
                                onClick={() => setPreviewImage(item.fileUrl)}
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                <a
                                  href={item.fileUrl}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-white bg-black/40 rounded-full p-2 hover:bg-black/60"
                                >
                                  ⬇️
                                </a>
                                <button
                                  onClick={() => setPreviewImage(item.fileUrl)}
                                  className="text-white bg-black/40 rounded-full p-2 hover:bg-black/60"
                                >
                                  🔍
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-between p-3 aspect-square">
                              <div className="text-center">
                                {mediaTab === "link" ? (
                                  <p className="text-4xl">🔗</p>
                                ) : (
                                  <p className="text-4xl">📄</p>
                                )}
                                <a
                                  href={item.fileUrl || item.message}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold text-gray-700 break-all line-clamp-3 hover:text-teal-600"
                                >
                                  {item.fileName || item.message}
                                </a>
                              </div>
                              <div className="text-center mt-2 w-full">
                                <p className="text-xs text-gray-400">
                                  {new Date(item.createdAt).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </p>
                                <a
                                  href={item.fileUrl || item.message}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded flex items-center justify-center gap-1"
                                >
                                  ⬇️ Unduh
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Animasi tambahan */}
              <style>{`
                @keyframes fade-in-scale {
                  from { transform: scale(0.95); opacity: 0; }
                  to { transform: scale(1); opacity: 1; }
                }
                .animate-fade-in-scale { animation: fade-in-scale 0.2s ease-out forwards; }
              `}</style>
            </div>
          )}
          {previewImage && (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] animate-fade-in"
              onClick={() => setPreviewImage(null)}
            >
              <div
                className="relative bg-transparent p-3 rounded-xl max-w-5xl max-h-[90vh] flex flex-col items-center"
                onClick={(e) => e.stopPropagation()} // biar klik di gambar gak nutup modal
              >
                {/* Tombol close */}
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute -top-4 -right-4 text-white bg-gray-800/70 hover:bg-gray-700 rounded-full p-2 transition"
                  title="Tutup"
                >
                  ✖
                </button>

                {/* Gambar */}
                <img
                  src={previewImage}
                  alt="Preview"
                  className="max-h-[85vh] max-w-full rounded-lg shadow-2xl object-contain transition-transform duration-300 hover:scale-[1.02]"
                />

                {/* Footer Info */}
                <div className="mt-3 text-gray-300 text-sm">
                  Klik di luar gambar untuk menutup
                </div>
              </div>

              {/* Animasi */}
              <style>{`
                @keyframes fade-in {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                .animate-fade-in {
                  animation: fade-in 0.2s ease-out forwards;
                }
              `}</style>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
