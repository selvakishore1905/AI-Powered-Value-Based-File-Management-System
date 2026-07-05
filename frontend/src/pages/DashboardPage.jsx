import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BACKEND_URL = 'http://localhost:8000'

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtPct(sim) { return `${Math.round(sim * 100)}%` }

function simColor(sim) {
  if (sim >= 0.95) return 'text-red-300 bg-red-500/10 border-red-500/25'
  if (sim >= 0.90) return 'text-orange-300 bg-orange-500/10 border-orange-500/25'
  return 'text-yellow-300 bg-yellow-500/10 border-yellow-500/25'
}

// ── Score Badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span className="text-gray-600">—</span>
  const color = score > 70
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    : score >= 40
      ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
      : 'bg-red-500/20 text-red-300 border-red-500/30'
  return <span className={`text-xs px-2.5 py-1 rounded-lg border font-bold ${color}`}>{Math.round(score)}</span>
}

// ── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  const map = {
    indigo: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/20 text-indigo-300',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-300',
    amber:  'from-amber-500/20  to-amber-500/5  border-amber-500/20  text-amber-300',
    sky:    'from-sky-500/20    to-sky-500/5    border-sky-500/20    text-sky-300',
    rose:   'from-rose-500/20   to-rose-500/5   border-rose-500/20   text-rose-300',
  }
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 flex flex-col gap-1 ${map[accent]}`}>
      <span className="text-[11px] font-semibold uppercase tracking-widest opacity-60">{label}</span>
      <span className="text-2xl font-bold text-white mt-1">{value}</span>
      {sub && <span className="text-xs opacity-50 mt-0.5">{sub}</span>}
    </div>
  )
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, count, accent }) {
  const accentCls = { amber: 'text-amber-400', violet: 'text-violet-400', sky: 'text-sky-400', rose: 'text-rose-400' }
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xl ${accentCls[accent]}`}>{icon}</span>
      <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
      {count > 0 && (
        <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">{count}</span>
      )}
    </div>
  )
}

// ── EmptySection ──────────────────────────────────────────────────────────────

function EmptySection({ message }) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 py-8 flex flex-col items-center gap-2 text-center">
      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-emerald-300 text-sm font-medium">{message}</p>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null
  const isSuccess = toast.type === 'success'
  return (
    <div className={`fixed bottom-24 right-6 z-50 flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl border max-w-sm transition-all ${
      isSuccess ? 'bg-emerald-900/95 border-emerald-500/40 text-emerald-200' : 'bg-red-900/95 border-red-500/40 text-red-200'
    }`}>
      <span className="text-lg flex-shrink-0">{isSuccess ? '✓' : '✗'}</span>
      <p className="text-sm font-medium">{toast.message}</p>
      <button onClick={onDismiss} className="ml-auto text-current opacity-50 hover:opacity-100">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ size = 5 }) {
  return (
    <svg className={`w-${size} h-${size} animate-spin text-indigo-400`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // Core data
  const [allFiles,    setAllFiles]    = useState([])
  const [dupGroups,   setDupGroups]   = useState([])
  const [simPairs,    setSimPairs]    = useState([])
  const [simImages,   setSimImages]   = useState([])
  const [scoredFiles, setScoredFiles] = useState([])
  const [stats,       setStats]       = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [keepChoices, setKeepChoices] = useState({})

  // Actions
  const [isScoring,   setIsScoring]   = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [toast,        setToast]        = useState(null)

  // Search
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching,   setIsSearching]   = useState(false)

  // Filter & Sort
  const [filter,  setFilter]  = useState('All')
  const [sortBy,  setSortBy]  = useState('score')
  const [sortDir, setSortDir] = useState('asc')

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set())

  const navigate = useNavigate()

  // ── Fetch all data
  const fetchAll = useCallback(async () => {
    try {
      const [files, dups, similar, simImgs, scored, statsData] = await Promise.all([
        fetch(`${BACKEND_URL}/files/all`).then(r => r.json()),
        fetch(`${BACKEND_URL}/files/duplicates`).then(r => r.json()),
        fetch(`${BACKEND_URL}/files/similar`).then(r => r.json()),
        fetch(`${BACKEND_URL}/files/similar-images`).then(r => r.json()),
        fetch(`${BACKEND_URL}/files/scored`).then(r => r.json()),
        fetch(`${BACKEND_URL}/files/stats`).then(r => r.json()),
      ])
      setAllFiles(files)
      setDupGroups(dups)
      setSimPairs(similar)
      setSimImages(simImgs)
      setScoredFiles(Array.isArray(scored) ? scored : [])
      setStats(statsData)
      const defaults = {}
      dups.forEach(g => { defaults[g.filehash] = g.files[0].id })
      setKeepChoices(defaults)
    } catch {
      setError('Failed to load data from backend.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Score all files
  const handleScoreAll = async () => {
    setIsScoring(true)
    try {
      const res = await fetch(`${BACKEND_URL}/files/score-all`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const [scored, statsData] = await Promise.all([
        fetch(`${BACKEND_URL}/files/scored`).then(r => r.json()),
        fetch(`${BACKEND_URL}/files/stats`).then(r => r.json()),
      ])
      setScoredFiles(Array.isArray(scored) ? scored : [])
      setStats(statsData)
      setToast({ type: 'success', message: 'All files scored successfully!' })
    } catch {
      setToast({ type: 'error', message: 'Scoring failed. Check that the backend is running.' })
    } finally {
      setIsScoring(false)
    }
  }

  // ── Search
  const handleSearch = async (e) => {
    e && e.preventDefault()
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const res = await fetch(`${BACKEND_URL}/files/search?q=${encodeURIComponent(searchQuery.trim())}`)
      if (!res.ok) throw new Error()
      setSearchResults(await res.json())
    } catch {
      setToast({ type: 'error', message: 'Search failed. Score files first to build the search index.' })
    } finally {
      setIsSearching(false)
    }
  }

  const clearSearch = () => { setSearchResults(null); setSearchQuery('') }

  // ── Filter & Sort
  const FILTERS = ['All', 'Safe to delete', 'Archive', 'Keep']

  const filteredFiles = scoredFiles.filter(f => {
    if (filter === 'All') return true
    return f.recommendation && f.recommendation.startsWith(filter)
  })

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let va, vb
    if (sortBy === 'score') { va = a.value_score ?? 999; vb = b.value_score ?? 999 }
    else if (sortBy === 'name') { va = a.filename.toLowerCase(); vb = b.filename.toLowerCase() }
    else if (sortBy === 'size') { va = a.filesize; vb = b.filesize }
    else { va = a.modified_date; vb = b.modified_date }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span className="opacity-20 ml-1">↕</span>
    return <span className="ml-1 text-indigo-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Checkboxes
  const activeInView = sortedFiles.filter(f => f.status === 'active')
  const allSelected  = activeInView.length > 0 && activeInView.every(f => selectedIds.has(f.id))

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(activeInView.map(f => f.id)))
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Simulate delete
  const selectedList  = sortedFiles.filter(f => selectedIds.has(f.id))
  const selectedBytes = selectedList.reduce((s, f) => s + f.filesize, 0)

  const handleSimulateDelete = async () => {
    if (selectedIds.size === 0) return
    setIsSimulating(true)
    try {
      const res = await fetch(`${BACKEND_URL}/files/simulate-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_ids: [...selectedIds] }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const [scored, statsData] = await Promise.all([
        fetch(`${BACKEND_URL}/files/scored`).then(r => r.json()),
        fetch(`${BACKEND_URL}/files/stats`).then(r => r.json()),
      ])
      setScoredFiles(Array.isArray(scored) ? scored : [])
      setStats(statsData)
      setSelectedIds(new Set())
      setToast({ type: 'success', message: `✓ Freed up ${data.recoverable_mb} MB! ${data.marked_count} files marked for deletion.` })
    } catch {
      setToast({ type: 'error', message: 'Cleanup simulation failed.' })
    } finally {
      setIsSimulating(false)
    }
  }

  // ── Loading state
  if (loading) return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <svg className="w-10 h-10 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p className="text-gray-400 text-sm">Loading dashboard…</p>
      </div>
    </main>
  )

  // ── Error state
  if (error) return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center max-w-sm">
        <p className="text-red-300 font-medium">{error}</p>
        <button onClick={() => window.location.reload()}
          className="mt-4 px-5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm transition-colors">
          Retry
        </button>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10 pb-32">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-gray-400 mt-1 text-sm">Storage analysis, value scoring &amp; cleanup simulation</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              id="score-all-btn"
              onClick={handleScoreAll}
              disabled={isScoring}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all hover:scale-[1.02]"
            >
              {isScoring ? <><Spinner size={4} /> Scoring…</> : '🧠 Score All Files'}
            </button>
            <button id="go-upload-btn" onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all hover:scale-[1.02] shadow-lg shadow-indigo-500/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              Scan More Files
            </button>
          </div>
        </div>

        {/* ── Stats Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Storage"
            value={stats ? `${stats.total_storage_mb.toFixed(1)} MB` : '—'}
            sub={`${stats?.total_files ?? 0} files`}
            accent="indigo"
          />
          <StatCard
            label="Duplicates Found"
            value={dupGroups.length}
            sub={`${dupGroups.length} group${dupGroups.length !== 1 ? 's' : ''}`}
            accent="violet"
          />
          <StatCard
            label="Safe to Delete"
            value={stats?.safe_to_delete_count ?? 0}
            sub="scored files"
            accent="rose"
          />
          <StatCard
            label="Recoverable Space"
            value={stats ? `${stats.recoverable_mb.toFixed(1)} MB` : '—'}
            sub="if safe files removed"
            accent="amber"
          />
        </div>

        {/* ── Search Bar ──────────────────────────────────────────────────── */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Try: find my latest resume, old screenshots…"
              className="w-full pl-11 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition"
            />
          </div>
          <button
            id="search-btn"
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition"
          >
            {isSearching ? <Spinner size={4} /> : null}
            {isSearching ? 'Searching…' : 'Search'}
          </button>
          {searchResults !== null && (
            <button type="button" onClick={clearSearch}
              className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition">
              Clear
            </button>
          )}
        </form>

        {/* ── Search Results ───────────────────────────────────────────────── */}
        {searchResults !== null && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-indigo-300 flex items-center gap-2">
                <span>🔍</span> Search Results
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {searchResults.length}
                </span>
              </h2>
              <button onClick={clearSearch} className="text-xs text-gray-500 hover:text-gray-300 transition">
                Clear search ×
              </button>
            </div>
            {searchResults.length === 0 ? (
              <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6 text-center text-gray-500 text-sm">
                No results found for that query.
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((result, i) => (
                  <div key={i} className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex items-center gap-4 hover:bg-indigo-500/8 transition-colors">
                    <div className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-xl border border-indigo-500/30 bg-indigo-500/10">
                      <span className="text-indigo-300 font-bold text-lg">{fmtPct(result.similarity_score)}</span>
                      <span className="text-[10px] text-indigo-400 opacity-70">match</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-200 truncate">{result.file.filename}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 uppercase font-mono">{result.file.filetype}</span>
                        <span className="text-xs text-gray-500">{formatBytes(result.file.filesize)}</span>
                        <ScoreBadge score={result.file.value_score} />
                      </div>
                      {result.file.recommendation && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{result.file.recommendation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Value Score Table ────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
              🗂️ File Value Scores
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                {sortedFiles.length}
              </span>
            </h2>
            {/* Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {FILTERS.map(f => (
                <button
                  key={f}
                  id={`filter-${f.toLowerCase().replace(/ /g, '-')}`}
                  onClick={() => { setFilter(f); setSelectedIds(new Set()) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                    filter === f
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {scoredFiles.length === 0 ? (
            <div className="rounded-2xl border border-gray-700 bg-gray-900 p-10 flex flex-col items-center gap-3 text-center">
              <span className="text-4xl">🧠</span>
              <p className="text-gray-300 font-semibold">No files scored yet</p>
              <p className="text-gray-500 text-sm">Click "Score All Files" to analyze your files and get cleanup recommendations.</p>
              <button
                onClick={handleScoreAll}
                disabled={isScoring}
                className="mt-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-xl transition disabled:opacity-50"
              >
                {isScoring ? 'Scoring…' : '🧠 Score All Files'}
              </button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="rounded-2xl border border-gray-700 bg-gray-900 p-8 text-center text-gray-500 text-sm">
              No files match the "{filter}" filter.
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800 bg-gray-800/50">
                    <th className="px-4 py-3 text-center w-10">
                      <input
                        id="select-all-checkbox"
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="accent-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left cursor-pointer hover:text-gray-300 select-none transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      Filename <SortIcon col="name" />
                    </th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">Type</th>
                    <th
                      className="px-4 py-3 text-right hidden md:table-cell cursor-pointer hover:text-gray-300 select-none transition-colors"
                      onClick={() => handleSort('size')}
                    >
                      Size <SortIcon col="size" />
                    </th>
                    <th
                      className="px-4 py-3 text-left hidden lg:table-cell cursor-pointer hover:text-gray-300 select-none transition-colors"
                      onClick={() => handleSort('date')}
                    >
                      Modified <SortIcon col="date" />
                    </th>
                    <th
                      className="px-4 py-3 text-center cursor-pointer hover:text-gray-300 select-none transition-colors"
                      onClick={() => handleSort('score')}
                    >
                      Score <SortIcon col="score" />
                    </th>
                    <th className="px-4 py-3 text-left">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {sortedFiles.map(file => {
                    const isPending  = file.status === 'pending_delete'
                    const isSelected = selectedIds.has(file.id)
                    return (
                      <tr
                        key={file.id}
                        id={`file-row-${file.id}`}
                        className={`transition-colors ${
                          isPending  ? 'opacity-40 bg-gray-900' :
                          isSelected ? 'bg-indigo-500/5' :
                          'hover:bg-gray-800/30'
                        }`}
                      >
                        <td className="px-4 py-3 text-center">
                          {!isPending && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(file.id)}
                              className="accent-indigo-500 w-4 h-4 cursor-pointer"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-200 font-medium truncate max-w-[200px]">{file.filename}</p>
                          <p className="text-xs text-gray-600 mt-0.5 truncate max-w-[200px]">{file.filepath}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 uppercase font-mono">
                            {file.filetype || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell text-gray-400 text-xs">
                          {formatBytes(file.filesize)}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                          {fmtDate(file.modified_date)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ScoreBadge score={file.value_score} />
                        </td>
                        <td className="px-4 py-3">
                          {isPending ? (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-gray-700 text-gray-400 border border-gray-600 font-medium">
                              pending deletion
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 line-clamp-2">
                              {file.recommendation || '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* EXACT DUPLICATES                                                  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <SectionHeader icon="⚠️" title="Exact Duplicate Files" count={dupGroups.length} accent="amber" />

          {dupGroups.length === 0
            ? <EmptySection message="No exact duplicates found" />
            : (
              <div className="space-y-4">
                {dupGroups.map((group, gi) => (
                  <div key={group.filehash} id={`dup-group-${gi}`}
                    className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 bg-gray-800/60 border-b border-gray-800">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-xs font-mono text-gray-400 truncate max-w-[180px] sm:max-w-xs">
                          {group.filehash.slice(0, 16)}…
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-gray-400">{group.count} copies</span>
                        <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                          {formatBytes(group.wasted_bytes)} wasted
                        </span>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                          <th className="px-5 py-3 text-left w-8">Keep</th>
                          <th className="px-5 py-3 text-left">Filename</th>
                          <th className="px-5 py-3 text-left hidden sm:table-cell">Type</th>
                          <th className="px-5 py-3 text-right hidden sm:table-cell">Size</th>
                          <th className="px-5 py-3 text-left hidden md:table-cell">Uploaded</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {group.files.map(file => {
                          const isKept = keepChoices[group.filehash] === file.id
                          return (
                            <tr key={file.id} className={`transition-colors ${isKept ? 'bg-indigo-500/5' : 'hover:bg-gray-800/40'}`}>
                              <td className="px-5 py-3.5">
                                <input id={`keep-${group.filehash}-${file.id}`}
                                  type="radio" name={`keep-${group.filehash}`}
                                  checked={isKept}
                                  onChange={() => setKeepChoices(p => ({ ...p, [group.filehash]: file.id }))}
                                  className="accent-indigo-500 w-4 h-4 cursor-pointer" />
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-200 font-medium">{file.filename}</span>
                                  {isKept && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">keep</span>}
                                </div>
                                <p className="text-xs text-gray-600 mt-0.5 truncate max-w-xs">{file.filepath}</p>
                              </td>
                              <td className="px-5 py-3.5 hidden sm:table-cell">
                                <span className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400 uppercase font-mono">{file.filetype || '—'}</span>
                              </td>
                              <td className="px-5 py-3.5 text-right hidden sm:table-cell text-gray-400">{formatBytes(file.filesize)}</td>
                              <td className="px-5 py-3.5 hidden md:table-cell text-gray-500 text-xs">{new Date(file.created_date).toLocaleString()}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )
          }
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SIMILAR DOCUMENTS                                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <SectionHeader icon="📄" title="Similar Documents" count={simPairs.length} accent="sky" />
          <p className="text-xs text-gray-500">
            Files with similar content that aren't byte-identical (cosine similarity ≥ 85%).
            Detected using the <span className="font-mono text-gray-400">all-MiniLM-L6-v2</span> embedding model.
          </p>

          {simPairs.length === 0
            ? <EmptySection message="No similar documents found" />
            : (
              <div className="space-y-3">
                {simPairs.map((pair, i) => (
                  <div key={i} id={`sim-pair-${i}`}
                    className="rounded-2xl border border-gray-800 bg-gray-900 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className={`flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-2xl border font-bold text-2xl ${simColor(pair.similarity)}`}>
                      {fmtPct(pair.similarity)}
                      <span className="text-[10px] font-normal mt-0.5 opacity-70">similar</span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[pair.file_a, pair.file_b].map((f, fi) => (
                          <div key={fi} className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2.5">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 uppercase font-mono flex-shrink-0">{f.filetype}</span>
                            <div className="min-w-0">
                              <p className="text-sm text-gray-200 font-medium truncate">{f.filename}</p>
                              <p className="text-xs text-gray-500">{formatBytes(f.filesize)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-sky-400/80">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        {pair.suggestion}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SIMILAR IMAGES                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <SectionHeader icon="🖼️" title="Similar Images" count={simImages.length} accent="rose" />
          <p className="text-xs text-gray-500">
            Images that look visually similar but aren't byte-identical (perceptual hash Hamming distance ≤ 10).
          </p>

          {simImages.length === 0
            ? <EmptySection message="No similar images found" />
            : (
              <div className="space-y-3">
                {simImages.map((pair, i) => (
                  <div key={i} id={`sim-img-${i}`}
                    className="rounded-2xl border border-gray-800 bg-gray-900 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-300 font-bold text-2xl">
                      {pair.hamming_distance}
                      <span className="text-[10px] font-normal mt-0.5 opacity-70">bits diff</span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[pair.file_a, pair.file_b].map((f, fi) => (
                          <div key={fi} className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2.5">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 uppercase font-mono flex-shrink-0">{f.filetype}</span>
                            <div className="min-w-0">
                              <p className="text-sm text-gray-200 font-medium truncate">{f.filename}</p>
                              <p className="text-xs text-gray-500">{formatBytes(f.filesize)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-rose-400/80">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        {pair.suggestion}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </section>

        {/* ── Empty all-files state ────────────────────────────────────────── */}
        {allFiles.length === 0 && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-10 flex flex-col items-center gap-3 text-center">
            <p className="text-gray-400 font-medium">No files scanned yet.</p>
            <button onClick={() => navigate('/')}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl transition-all">
              Upload Files
            </button>
          </div>
        )}

      </div>

      {/* ── Sticky Cleanup Bar ──────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800 bg-gray-950/98 backdrop-blur-md px-6 py-4 shadow-2xl">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-white">
                {selectedIds.size} file{selectedIds.size !== 1 ? 's' : ''} selected
              </p>
              <p className="text-xs text-gray-400">
                {formatBytes(selectedBytes)} will be marked for deletion
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition"
              >
                Cancel
              </button>
              <button
                id="cleanup-btn"
                onClick={handleSimulateDelete}
                disabled={isSimulating}
                className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-rose-500/20"
              >
                {isSimulating
                  ? <><Spinner size={4} /> Simulating…</>
                  : `🗑️ Clean Up ${selectedIds.size} File${selectedIds.size !== 1 ? 's' : ''} · ${formatBytes(selectedBytes)}`
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />

    </main>
  )
}
