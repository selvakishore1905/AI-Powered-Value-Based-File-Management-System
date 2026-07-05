import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <BrowserRouter>
      <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 px-6 py-3.5 flex items-center gap-6">
        {/* Logo */}
        <span className="font-bold text-lg tracking-tight mr-auto">
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            StorageIQ
          </span>
        </span>

        <NavLink
          to="/"
          end
          id="nav-upload"
          className={({ isActive }) =>
            `text-sm font-medium px-3 py-1.5 rounded-lg transition-all ${
              isActive
                ? 'bg-indigo-500/15 text-indigo-300'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`
          }
        >
          Upload
        </NavLink>

        <NavLink
          to="/dashboard"
          id="nav-dashboard"
          className={({ isActive }) =>
            `text-sm font-medium px-3 py-1.5 rounded-lg transition-all ${
              isActive
                ? 'bg-indigo-500/15 text-indigo-300'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`
          }
        >
          Dashboard
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  )
}
