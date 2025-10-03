import { createContext, useContext, useState } from "react";

const BlastContext = createContext();

export function BlastProvider({ children }) {
  const [message, setMessage] = useState(""); // pesan yang lagi diedit/diisi
  const [currentBlast, setCurrentBlast] = useState(null); 
  // contoh currentBlast:
  // { id: "abc123", total: 10, current: 4, progress: 40, statusText: "Sending..." }

  return (
    <BlastContext.Provider
      value={{
        message,
        setMessage,
        currentBlast,
        setCurrentBlast,
      }}
    >
      {children}
    </BlastContext.Provider>
  );
}

export const useBlast = () => useContext(BlastContext);
