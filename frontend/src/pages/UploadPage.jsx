import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BACKEND_URL = 'http://localhost:8000'

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function UploadPage() {
  const [backendStatus, setBackendStatus] = useState('checking')
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadState, setUploadState] = useState('idle') // idle | uploading | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // ── health check ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json() })
      .then((data) => setBackendStatus(data.status === 'ok' ? 'connected' : 'error'))
      .catch(() => setBackendStatus('error'))
  }, [])

  // ── drag & drop ───────────────────────────────────────────────────────────
  const onDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true) }, [])
  const onDragLeave = useCallback(() => setIsDragging(false), [])
  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) setSelectedFiles(prev => [...prev, ...files])
  }, [])

  const onFileInput = (e) => {
    const files = Array.from(e.target.files)
    if (files.length) setSelectedFiles(prev => [...prev, ...files])
  }

  const removeFile = (idx) =>
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx))

  // ── upload ────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFiles.length) return
    setUploadState('uploading')
    setErrorMsg('')

    try {
      const form = new FormData()
      selectedFiles.forEach(f => form.append('files', f))

      const res = await fetch(`${BACKEND_URL}/upload/scan`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      setUploadState('done')
      setTimeout(() => navigate('/dashboard'), 800)
    } catch (err) {
      setUploadState('error')
      setErrorMsg(err.message || 'Upload failed')
    }
  }

  // ── status badge ──────────────────────────────────────────────────────────
  const statusConfig = {
    checking: { text: 'Connecting…', cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30', dot: 'bg-yellow-400 animate-pulse' },
    connected: { text: 'Backend connected', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
    error:     { text: 'Backend unreachable', cls: 'bg-red-500/15 text-red-300 border-red-500/30', dot: 'bg-red-400' },
  }
  const sc = statusConfig[backendStatus]

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-12 flex flex-col items-center gap-8">

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
          Scan Your Files
        </h1>
        <p className="text-gray-400 text-base max-w-md">
          Upload any collection of files — StorageIQ will detect duplicates and help you reclaim wasted space.
        </p>
      </div>

      {/* ── Health badge ──────────────────────────────────────────────── */}
      <div className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-medium border ${sc.cls}`}>
        <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
        {sc.text}
      </div>

      {/* ── Drop zone ─────────────────────────────────────────────────── */}
      <div
        id="drop-zone"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          w-full max-w-2xl rounded-2xl border-2 border-dashed cursor-pointer
          flex flex-col items-center justify-center gap-4 p-12 transition-all duration-200
          ${isDragging
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
            : 'border-gray-700 bg-gray-900/60 hover:border-indigo-500/60 hover:bg-gray-900'}
        `}
      >
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-gray-200 font-medium">Drop files here or <span className="text-indigo-400 underline underline-offset-2">browse</span></p>
          <p className="text-gray-500 text-sm mt-1">Any file type, multiple files supported</p>
        </div>
        <input
          ref={inputRef}
          id="file-input"
          type="file"
          multiple
          className="hidden"
          onChange={onFileInput}
        />
      </div>

      {/* ── Selected file list ────────────────────────────────────────── */}
      {selectedFiles.length > 0 && (
        <div className="w-full max-w-2xl space-y-2">
          <p className="text-sm text-gray-400 font-medium">{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</p>
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800 max-h-56 overflow-y-auto">
            {selectedFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 uppercase font-mono flex-shrink-0">
                    {f.name.split('.').pop()}
                  </span>
                  <span className="text-sm text-gray-200 truncate">{f.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-xs text-gray-500">{formatBytes(f.size)}</span>
                  <button
                    id={`remove-file-${i}`}
                    onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                    className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upload button ─────────────────────────────────────────────── */}
      <button
        id="upload-btn"
        onClick={handleUpload}
        disabled={!selectedFiles.length || uploadState === 'uploading' || uploadState === 'done'}
        className={`
          px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2
          ${!selectedFiles.length
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
            : uploadState === 'uploading'
              ? 'bg-indigo-600/70 text-white cursor-wait'
              : uploadState === 'done'
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02]'}
        `}
      >
        {uploadState === 'uploading' && (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {uploadState === 'done' && '✓ '}
        {{
          idle:      'Scan for Duplicates →',
          uploading: 'Scanning…',
          done:      'Done! Redirecting…',
          error:     'Retry Upload',
        }[uploadState]}
      </button>

      {/* ── Error message ─────────────────────────────────────────────── */}
      {uploadState === 'error' && errorMsg && (
        <div className="w-full max-w-2xl bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 text-red-300 text-sm">
          ⚠ {errorMsg}
        </div>
      )}
    </main>
  )
}
