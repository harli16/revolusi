import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { socket } from "../../utils/socket";
import { Check, CheckCheck, Clock, XCircle, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "../../fonts/NotoSans-Regular-normal.js";
import api from "../../utils/api"; // 🔥 axios instance

export default function LogPengiriman() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  // filter state
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // fungsi bersihin emoji/karakter aneh
  const sanitizeText = (str) => {
    if (!str) return "";
    return str.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      "-"
    );
  };

  const translateStatus = (status) => {
    switch (status) {
      case "delivered":
      case "sent":
        return "Terkirim";
      case "read":
        return "Dibaca";
      case "played":
        return "Diputar";
      case "failed":
        return "Gagal";
      case "pending":
        return "Menunggu";
      default:
        return status;
    }
  };

  // fetch log dari backend
  const fetchLogs = async () => {
    try {
      let url = "/api/message/logs?";
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (startDate) url += `start=${startDate}&`;
      if (endDate) url += `end=${endDate}&`;

      const res = await api.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      if (data.ok && Array.isArray(data.items)) {
        setLogs(data.items);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error("Gagal fetch logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    socket.on("message:status", (update) => {
      console.log("📩 Dapet update dari socket:", update);
      setLogs((prev) =>
        prev.map((log) => {
          if (log.providerId === update.providerId || log._id === update.logId) {
            return { ...log, status: update.status, providerId: update.providerId };
          }
          return log;
        })
      );
    });
    return () => socket.off("message:status");
  }, [token, search, startDate, endDate]);

  // ✅ Export ke PDF
  const handleExport = () => {
    if (logs.length === 0) {
      alert("Tidak ada data untuk diexport");
      return;
    }

    const doc = new jsPDF("landscape", "mm", "a4");
    doc.setFont("NotoSans-Regular", "normal");
    doc.setFontSize(14);
    doc.text("Laporan Log Pengiriman Pesan", 14, 15);

    const tableColumn = ["Waktu", "Penerima", "Pesan", "Status"];
    const tableRows = logs.map((log) => [
      new Date(log.createdAt).toLocaleString("id-ID"),
      sanitizeText(
        log.recipientName ? `${log.recipientName} (${log.to})` : log.to
      ),
      sanitizeText(log.message || ""),
      translateStatus(log.status),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 25,
      styles: {
        font: "NotoSans-Regular",
        fontSize: 9,
        cellPadding: 2,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 50 },
        2: { cellWidth: 160 },
        3: { cellWidth: 30 },
      },
    });

    doc.save("log_pengiriman.pdf");
  };

  const statusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
            <Clock className="w-3.5 h-3.5 text-yellow-600" /> Menunggu
          </span>
        );
      case "sent":
        return (
          <span className="flex items-center gap-1 bg-gray-200 text-gray-800 px-2 py-1 rounded-full">
            <Check className="w-3.5 h-3.5 text-gray-700" /> Masih Ceklis
          </span>
        );
      // case "delivered":
      //   return (
      //     <span className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full">
      //       <CheckCheck className="w-3.5 h-3.5 text-green-600" /> Sukses
      //     </span>
      //   );
      case "read":
        return (
          <span className="flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
            <CheckCheck className="w-3.5 h-3.5 text-orange-700" /> Terkirim
          </span>
        );
      case "played":
        return (
          <span className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
            <CheckCheck className="w-3.5 h-3.5 text-blue-600" /> Dibaca
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded-full">
            <XCircle className="w-3.5 h-3.5 text-red-600" /> Gagal
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
            <Clock className="w-3.5 h-3.5 text-gray-500" /> Tidak diketahui
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div>
          <h3 className="text-xl font-semibold">Log Pengiriman Pesan</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tampilan riwayat pesan yang dikirim.
          </p>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5"
          />
          <input
            type="search"
            placeholder="Cari nomor / nama / pesan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm rounded-lg p-2.5"
          />
          <button
            type="button"
            onClick={handleExport}
            className="p-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <p className="text-gray-500">Memuat log...</p>
        ) : logs.length === 0 ? (
          <p className="text-gray-500">Belum ada log pengiriman</p>
        ) : (
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3">Waktu</th>
                <th className="px-6 py-3">Penerima</th>
                <th className="px-6 py-3">Pesan</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log._id}
                  className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("id-ID")}
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {log.recipientName
                      ? `${log.recipientName} (${log.to})`
                      : log.to}
                  </td>
                  <td className="px-6 py-4 max-w-sm truncate">{log.message}</td>
                  <td className="px-6 py-4">{statusBadge(log.status)}</td>
                  <td className="px-6 py-4">
                    <button
                      className="font-medium text-indigo-600 dark:text-indigo-500 hover:underline"
                      onClick={() => setSelectedLog(log)}
                    >
                      Preview
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Preview Modal */}
      {selectedLog && (
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
                          <p>{selectedLog.message}</p>
                          <p className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {selectedLog.status === "read" ? (
                              <CheckCheck className="inline-block w-4 h-4 text-blue-500" />
                            ) : selectedLog.status === "played" ? (
                              <CheckCheck className="inline-block w-4 h-4 text-purple-500" />
                            ) : selectedLog.status === "delivered" ? (
                              <CheckCheck className="inline-block w-4 h-4 text-green-500" />
                            ) : selectedLog.status === "sent" ? (
                              <Check className="inline-block w-4 h-4 text-gray-500" />
                            ) : selectedLog.status === "failed" ? (
                              <XCircle className="inline-block w-4 h-4 text-red-500" />
                            ) : (
                              <Clock className="inline-block w-4 h-4 text-yellow-500" />
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={() => setSelectedLog(null)}
                className="py-2 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
