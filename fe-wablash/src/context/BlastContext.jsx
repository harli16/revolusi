import { createContext, useContext, useState } from "react";

const BlastContext = createContext();

export function BlastProvider({ children }) {
  // 🔹 pesan yang lagi diedit/diisi
  const [message, setMessage] = useState("");

  // 🔹 blast yang sedang berjalan / aktif
  const [currentBlast, setCurrentBlast] = useState(null);
  // contoh currentBlast:
  // { id: "abc123", total: 10, current: 4, progress: 40, statusText: "Sending..." }

  // 🔹 statusMap: menyimpan status realtime per nomor (read, played, failed, dst)
  const [statusMap, setStatusMap] = useState({});
  // contoh isi: { "6285117591609": "played", "6282129328462": "read" }

  return (
    <BlastContext.Provider
      value={{
        message,
        setMessage,
        currentBlast,
        setCurrentBlast,
        statusMap,       // 🔥 tambahkan ini biar bisa dibaca di seluruh halaman
        setStatusMap,    // 🔥 tambahkan ini biar bisa diupdate realtime dari socket
      }}
    >
      {children}
    </BlastContext.Provider>
  );
}

export const useBlast = () => useContext(BlastContext);