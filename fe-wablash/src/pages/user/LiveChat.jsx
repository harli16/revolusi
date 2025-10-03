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
  const [totalUnread, setTotalUnread] = useState(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
  // Ambil riwayat chat saat pilih kontak
  // ==========================
  const loadHistory = async (waNumber) => {
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
        }));
        setMessages(normalized);
      }

      // ✅ auto mark-as-read
      try {
        await api.post(`/api/chat/read/${waNumber}`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error("❌ Failed to mark history as read:", err);
      }

      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      console.error("❌ Error fetch history:", err);
    }
  };

  // ==========================
  // Kirim pesan (teks / file)
  // ==========================
  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !activeContact) return;

    try {
      const formData = new FormData();
      formData.append("waNumber", activeContact);
      if (newMessage.trim()) formData.append("message", newMessage);
      if (selectedFile) formData.append("file", selectedFile);

      await api.post("/api/chat/send", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNewMessage("");
      setSelectedFile(null);
      setShowEmojiPicker(false);
    } catch (err) {
      console.error("❌ Error send message:", err);
    }
  };

  // ==========================
  // Socket listener
  // ==========================
  useEffect(() => {
    socket.on("chat:new", (payload) => {
      const {
        id,
        waNumber,
        message,
        text,
        createdAt,
        ts,
        direction,
        fromSelf,
        waName,
        providerId,
        status,
      } = payload;

      if (waNumber === activeContact) {
        setMessages((prev) => {
          const exists = id && prev.some((m) => m.id === id);
          if (exists) return prev;
          return [
            ...prev,
            {
              id,
              providerId,
              waNumber,
              message: message || text,
              createdAt: createdAt || new Date(),
              direction: direction || (fromSelf ? "out" : "in"),
              status: status || "pending",
            },
          ];
        });

        api.post(`/api/chat/read/${waNumber}`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch((err) => console.error("❌ Failed to mark realtime as read:", err));
      }

      setContacts((prev) => {
        const filtered = prev.filter((c) => c._id !== waNumber);
        const existing = prev.find((c) => c._id === waNumber);

        const updated = [
          {
            _id: waNumber,
            name: waName || existing?.name || waNumber,
            lastMessage: message || text,
            lastAt: createdAt || ts || new Date(),
            unread: waNumber === activeContact
              ? 0
              : (existing?.unread || 0) + 1,
          },
          ...filtered,
        ];

        return updated.sort(
          (a, b) => new Date(b.lastAt) - new Date(a.lastAt)
        );
      });
    });

    socket.on("message:status", ({ providerId, status }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.providerId === providerId ? { ...m, status } : m
        )
      );
    });

    return () => {
      socket.off("chat:new");
      socket.off("message:status");
    };
  }, [activeContact, token]);

  // Auto-scroll tiap ada message baru
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      // Kalau belum pilih contact: tampilkan LIST (1 kolom)
      !activeContact ? (
        <div className="h-full bg-white flex flex-col">
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

          {/* Search */}
          <div className="p-3 bg-white border-b border-gray-100">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari atau mulai chat baru"
                className="w-full bg-gray-100 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 ? (
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
                  {/* Avatar */}
                  <img
                    src={`https://placehold.co/48x48/2563eb/ffffff?text=${c.name?.[0] || "?"}`}
                    alt={c.name || c._id}
                    className="rounded-full w-10 h-10 mr-3 flex-shrink-0"
                  />

                  {/* Info Kontak */}
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
        // Kalau sudah pilih contact: tampilkan CHAT WINDOW (1 kolom) + tombol back
        <div className="h-full bg-white flex flex-col">
          {/* Header Chat */}
          <header className="bg-gray-100 p-3 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center">
              <button
                onClick={() => setActiveContact(null)}
                className="text-gray-500 hover:text-gray-700 mr-3"
              >
                <FaArrowLeft />
              </button>
              <img
                src={`https://placehold.co/40x40/2563eb/ffffff?text=${
                  contacts.find((c) => c._id === activeContact)?.name?.[0] || "?"
                }`}
                alt={activeContact}
                className="rounded-full w-9 h-9 mr-3"
              />
              <div>
                <h2 className="font-semibold text-gray-800">
                  {contacts.find((c) => c._id === activeContact)?.name || activeContact}
                </h2>
                <p className="text-xs text-gray-500">online</p>
              </div>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 chat-bg bg-gray-200">
            {messages.map((m, idx) => (
              <div
                key={m._id || m.id || idx}
                className={`flex ${m.direction === "out" ? "justify-end" : ""}`}
              >
                <div
                  className={`rounded-lg p-3 max-w-[80%] shadow ${
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
                      <span className="text-xs">
                        {m.status === "pending" && "Terkirim"}
                        {m.status === "sent" && "✓"}
                        {m.status === "delivered" && "✓✓"}
                        {m.status === "read" && <span className="text-blue-500">✓✓</span>}
                        {m.status === "played" && "Terkirim"}
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
              <div className="flex items-center justify-between bg-gray-200 px-3 py-2 mb-2 rounded-lg text-sm text-gray-700">
                <span className="truncate max-w-xs">
                  📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="ml-3 text-red-500 hover:text-red-700 text-xs"
                >
                  ❌ Batal
                </button>
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
                  onChange={(e) => setSelectedFile(e.target.files[0])}
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
      /* ===== DESKTOP MODE (2 kolom) ===== */
      <div className="flex h-full w-full rounded-lg shadow bg-white">
        {/* Sidebar Kontak */}
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
                placeholder="Cari atau mulai chat baru"
                className="w-full bg-gray-100 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 ? (
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
                  {/* Avatar */}
                  <img
                    src={`https://placehold.co/48x48/2563eb/ffffff?text=${c.name?.[0] || "?"}`}
                    alt={c.name || c._id}
                    className="rounded-full w-12 h-12 mr-4 flex-shrink-0"
                  />

                  {/* Info Kontak */}
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
          {activeContact ? (
            <>
              {/* Header Chat */}
              <header className="bg-gray-100 p-3 flex items-center justify-between border-b border-gray-200">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveContact(null)}
                    className="md:hidden text-gray-500 hover:text-gray-700 mr-3"
                  >
                    <FaArrowLeft />
                  </button>
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
              </header>

              {/* Messages */}
              <div className="flex-1 p-6 overflow-y-auto space-y-3 chat-bg">
                {Array.isArray(messages) && messages.length > 0 ? (
                  messages.map((m, idx) => (
                    <div key={m._id || m.id || idx} className={`flex ${m.direction === "out" ? "justify-end" : ""}`}>
                      <div
                        className={`rounded-lg p-3 max-w-[80%] shadow ${
                          m.direction === "out" ? "bg-[#dcf8c6]" : "bg-white"
                        }`}
                      >
                        <p className="text-gray-800">
                          {typeof m.message === "string" ? m.message : JSON.stringify(m.message)}
                        </p>
                        {/* timestamp & status tetap */}
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
                {selectedFile && (
                  <div className="flex items-center justify-between bg-gray-200 px-3 py-2 mb-2 rounded-lg text-sm text-gray-700">
                    <span className="truncate max-w-xs">
                      📎 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="ml-3 text-red-500 hover:text-red-700 text-xs"
                    >
                      ❌ Batal
                    </button>
                  </div>
                )}

                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
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
                      onChange={(e) => setSelectedFile(e.target.files[0])}
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
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Pilih kontak untuk memulai chat
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);


}
