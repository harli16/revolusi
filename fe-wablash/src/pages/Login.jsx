import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { User, Lock } from "lucide-react"
import logo from "../assets/DyaVanMsgLogo.png"

export default function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await login(username, password)
    if (ok) {
      const user = JSON.parse(localStorage.getItem("user"))
      if (user.role === "superadmin") navigate("/superadmin")
      else if (user.role === "admin") navigate("/admin")
      else navigate("/user")
    } else {
      alert("Login gagal!")
    }
  }

  const necessaryStyles = `
    .input-field { 
      display: block; 
      width: 100%; 
      border-radius: 0.5rem; 
      border: 1px solid #d1d5db; 
      font-size: 0.875rem; 
      background-color: #f9fafb; 
      transition: all 0.2s; 
    }
    .input-field:focus { outline: none; border-color: #4f46e5; }
    .btn-primary { padding: 0.75rem 1.5rem; border: 1px solid transparent; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; color: #ffffff; background-color: #4f46e5; transition: background-color 0.2s; }
    .btn-primary:hover { background-color: #4338ca; }
  `

  return (
    <>
      <style>{necessaryStyles}</style>
      <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <img
              src="DyaVanMsgLogo.png"
              onError={(e) => (e.target.src = logo)} // fallback ke lokal
              alt="Logo LP3I"
              className="mx-auto w-32"
            />

            <h1 className="text-3xl font-bold text-indigo-600">
              DyaVan Msg Pro
            </h1>
            <p className="text-gray-500 mt-2">
              Silakan login untuk melanjutkan
            </p>
          </div>

          {/* Card Login */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Username
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="username"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-field py-3 pr-4 pl-10"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field py-3 pr-4 pl-10"
                    required
                  />
                </div>
              </div>

              {/* Remember me + Forgot */}
              {/* <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-gray-900"
                  >
                    Ingat saya
                  </label>
                </div>
                <a
                  href="#"
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  Lupa password?
                </a>
              </div> */}

              {/* Tombol Login */}
              <div>
                <button
                  type="submit"
                  className="w-full btn-primary flex justify-center"
                >
                  Login
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-gray-500 mt-8">
            Copyright&copy;2025 - Lilip Harlivandi Zakaria
          </p>
        </div>
      </div>
    </>
  )
}