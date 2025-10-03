export default function Bantuan() {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
      <h3 className="text-xl font-semibold mb-4">Pusat Bantuan</h3>

      <div className="space-y-6">
        {/* FAQ */}
        <div>
          <h4 className="font-semibold text-lg">FAQ (Frequently Asked Questions)</h4>
          <div className="mt-2 space-y-2">
            <details className="p-3 border rounded-lg dark:border-gray-700">
              <summary className="font-medium cursor-pointer">
                Bagaimana cara import kontak?
              </summary>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Kamu bisa mengimpor kontak dari file CSV atau Excel pada halaman{" "}
                <b>Kirim Pesan</b>. Pastikan format kolom sesuai (Nomor WA, Nama, dll).
              </p>
            </details>

            <details className="p-3 border rounded-lg dark:border-gray-700">
              <summary className="font-medium cursor-pointer">Apa itu placeholder?</summary>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Placeholder seperti{" "}
                <code className="bg-gray-200 px-1 rounded">&#123;&#123;nama&#125;&#125;</code>{" "}
                akan otomatis terganti dengan data dari kolom kontak kamu.
              </p>
            </details>
          </div>
        </div>

        {/* Kontak Support */}
        <div>
          <h4 className="font-semibold text-lg">Kontak Support</h4>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Jika mengalami kendala, hubungi pembuat aplikasi ini dengan cara email ke {" "}
            <a
              href="mailto:it@lp3i.ac.id"
              className="text-indigo-600 hover:underline"
            >
              lharlivandiz@gmail.com
            </a>
            .
          </p>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Lilip Harlivandi Zakaria
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            LinkedIn:{" "}
            <a
              href="https://www.linkedin.com/in/harli-visudo?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              Harli .Z
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
