import { useState, useEffect, useCallback } from 'react'
import { Folder, FolderOpen, File, Upload, Download, Plus, Trash2, Edit2, RefreshCw, ChevronRight, ArrowUp, Home, Eye, EyeOff, FileText } from 'lucide-react'
import type { SFTPEntry } from '../../../shared/types'
import SFTPEditorModal from './SFTPEditorModal'
import './SFTP.css'

interface Props { hostId: string; sessionId: string }

export default function SFTPPanel({ hostId, sessionId }: Props) {
  const [entries, setEntries] = useState<SFTPEntry[]>([])
  const [path, setPath] = useState('/')
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [transfers, setTransfers] = useState<{ path: string; pct: number }[]>([])
  const [editingFile, setEditingFile] = useState<SFTPEntry | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (!e.dataTransfer || !e.dataTransfer.files) return

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      const localPath = (file as any).path
      if (!localPath) continue
      const name = file.name
      const remotePath = path.endsWith('/') ? path + name : path + '/' + name
      await window.actionshell.sftp.upload(sessionId, localPath, remotePath)
    }
    loadDir(path)
  }

  useEffect(() => {
    connect()
    const removeProgress = window.actionshell.sftp.onProgress(({ remotePath, transferred, total }) => {
      const pct = Math.round((transferred / total) * 100)
      setTransfers(t => {
        const exists = t.find(x => x.path === remotePath)
        if (exists) return t.map(x => x.path === remotePath ? { ...x, pct } : x)
        return [...t, { path: remotePath, pct }]
      })
      if (pct >= 100) setTimeout(() => setTransfers(t => t.filter(x => x.path !== remotePath)), 1500)
    })
    return () => {
      removeProgress()
      window.actionshell.sftp.disconnect(sessionId)
    }
  }, [])

  const connect = async () => {
    setLoading(true); setError('')
    try {
      const res = await window.actionshell.sftp.connect(sessionId, hostId)
      if (res.success) { setConnected(true); loadDir('/') }
      else setError(res.error || 'Connection failed')
    } catch { setError('Connection failed') }
    finally { setLoading(false) }
  }

  const loadDir = async (p: string) => {
    setLoading(true); setError(''); setSelected(new Set())
    try {
      const res = await window.actionshell.sftp.list(sessionId, p)
      if (res.success) { setEntries(res.data as SFTPEntry[]); setPath(p) }
      else setError(res.error || 'Failed to list directory')
    } catch { setError('Failed to list directory') }
    finally { setLoading(false) }
  }

  const navigate = (entry: SFTPEntry) => {
    if (entry.type === 'directory') loadDir(entry.path)
  }

  const goUp = () => {
    const parent = path.split('/').slice(0, -1).join('/') || '/'
    loadDir(parent)
  }

  const upload = async () => {
    const res = await window.actionshell.sftp.pickFiles()
    if (!res.success || !res.data) return
    for (const localPath of res.data as string[]) {
      const name = localPath.split(/[\\/]/).pop()!
      const remotePath = path.endsWith('/') ? path + name : path + '/' + name
      await window.actionshell.sftp.upload(sessionId, localPath, remotePath)
    }
    loadDir(path)
  }

  const download = async (entry: SFTPEntry) => {
    const res = await window.actionshell.sftp.pickSaveDir()
    if (!res.success || !res.data) return
    const localPath = (res.data as string) + '/' + entry.name
    await window.actionshell.sftp.download(sessionId, entry.path, localPath)
  }

  const deleteEntry = async (entry: SFTPEntry) => {
    if (!confirm(`Delete ${entry.name}?`)) return
    await window.actionshell.sftp.delete(sessionId, entry.path, entry.type === 'directory')
    loadDir(path)
  }

  const mkdir = async () => {
    const name = prompt('New folder name:')
    if (!name) return
    const remotePath = path.endsWith('/') ? path + name : path + '/' + name
    await window.actionshell.sftp.mkdir(sessionId, remotePath)
    loadDir(path)
  }

  const startRename = (entry: SFTPEntry) => {
    setRenaming(entry.path); setNewName(entry.name)
  }

  const commitRename = async (entry: SFTPEntry) => {
    if (!newName || newName === entry.name) { setRenaming(null); return }
    const newPath = entry.path.replace(/[^/]+$/, newName)
    await window.actionshell.sftp.rename(sessionId, entry.path, newPath)
    setRenaming(null)
    loadDir(path)
  }

  const displayed = showHidden ? entries : entries.filter(e => !e.isHidden)
  const pathParts = path.split('/').filter(Boolean)

  const octalMode = (perms: number) => perms.toString(8).padStart(3, '0')

  if (!connected) return (
    <div className="sftp-panel-center">
      {loading ? <><div className="spinner"/><span style={{marginTop:'12px',color:'var(--color-text-500)'}}>Connecting SFTP...</span></> :
        error ? <><p style={{color:'var(--color-danger-500)'}}>{error}</p><button className="btn btn-primary btn-sm" onClick={connect}>Retry</button></> : null}
    </div>
  )

  return (
    <div className="sftp-panel">
      {/* SFTP Toolbar */}
      <div className="sftp-toolbar">
        <button className="btn btn-icon btn-sm" onClick={() => loadDir('/')} title="Home"><Home size={13}/></button>
        <button className="btn btn-icon btn-sm" onClick={goUp} title="Up" disabled={path === '/'}><ArrowUp size={13}/></button>
        <button className="btn btn-icon btn-sm" onClick={() => loadDir(path)} title="Refresh"><RefreshCw size={13}/></button>
        <div className="sftp-path-bar">
          <span style={{color:'var(--color-text-600)'}}>/</span>
          {pathParts.map((part, i) => (
            <span key={i} style={{display:'flex',alignItems:'center',gap:'2px'}}>
              <button className="sftp-path-part"
                onClick={() => loadDir('/' + pathParts.slice(0,i+1).join('/'))}>
                {part}
              </button>
              {i < pathParts.length-1 && <ChevronRight size={10} style={{color:'var(--color-text-700)'}}/>}
            </span>
          ))}
        </div>
        <button className="btn btn-icon btn-sm" onClick={() => setShowHidden(!showHidden)} title={showHidden?'Hide hidden':'Show hidden'}>
          {showHidden ? <EyeOff size={13}/> : <Eye size={13}/>}
        </button>
        <button className="btn btn-icon btn-sm" onClick={mkdir} title="New folder"><Plus size={13}/></button>
        <button className="btn btn-primary btn-sm" onClick={upload}><Upload size={12}/> Upload</button>
      </div>

      {/* Transfer Progress */}
      {transfers.length > 0 && (
        <div style={{padding:'4px 8px',borderBottom:'1px solid var(--color-border-subtle)'}}>
          {transfers.map(t => (
            <div key={t.path} style={{marginBottom:'4px'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'var(--text-xs)',color:'var(--color-text-500)',marginBottom:'2px'}}>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{t.path.split('/').pop()}</span>
                <span>{t.pct}%</span>
              </div>
              <div className="progress-bar"><div className="progress-bar-fill" style={{width:`${t.pct}%`}}/></div>
            </div>
          ))}
        </div>
      )}

      {/* File listing */}
      {loading ? (
        <div className="sftp-panel-center"><div className="spinner"/></div>
      ) : error ? (
        <div className="sftp-panel-center"><p style={{color:'var(--color-danger-500)'}}>{error}</p></div>
      ) : (
        <div
          className={`sftp-file-list scrollable ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {displayed.map(entry => (
            <div key={entry.path}
              className={`sftp-file-row ${selected.has(entry.path) ? 'selected' : ''}`}
              onClick={() => setSelected(s => { const n=new Set(s); n.has(entry.path)?n.delete(entry.path):n.add(entry.path); return n })}
              onDoubleClick={() => navigate(entry)}>
              <div className="sftp-file-icon">
                {entry.type === 'directory' ? <FolderOpen size={14} style={{color:'var(--color-warning-500)'}}/> : <File size={14} style={{color:'var(--color-text-600)'}}/>}
              </div>
              <div className="sftp-file-name">
                {renaming === entry.path ? (
                  <input className="form-input" value={newName} autoFocus
                    style={{padding:'1px 4px',height:'20px',fontSize:'var(--text-sm)'}}
                    onChange={e => setNewName(e.target.value)}
                    onBlur={() => commitRename(entry)}
                    onKeyDown={e => { if(e.key==='Enter') commitRename(entry); if(e.key==='Escape') setRenaming(null) }}
                    onClick={e => e.stopPropagation()} />
                ) : (
                  <span style={{color:entry.isHidden?'var(--color-text-600)':'var(--color-text-300)'}}>{entry.name}</span>
                )}
              </div>
              <div className="sftp-file-meta mono">{octalMode(entry.permissions)}</div>
              <div className="sftp-file-meta">{entry.type==='file' ? formatSize(entry.size) : ''}</div>
              <div className="sftp-file-actions">
                {entry.type === 'file' && (
                  <>
                    <button className="btn btn-icon" style={{width:'20px',height:'20px',padding:'2px'}}
                      onClick={e => { e.stopPropagation(); setEditingFile(entry) }} title="Edit File">
                      <FileText size={11}/>
                    </button>
                    <button className="btn btn-icon" style={{width:'20px',height:'20px',padding:'2px'}}
                      onClick={e => { e.stopPropagation(); download(entry) }} title="Download">
                      <Download size={11}/>
                    </button>
                  </>
                )}
                <button className="btn btn-icon" style={{width:'20px',height:'20px',padding:'2px'}}
                  onClick={e => { e.stopPropagation(); startRename(entry) }} title="Rename">
                  <Edit2 size={11}/>
                </button>
                <button className="btn btn-icon" style={{width:'20px',height:'20px',padding:'2px',color:'var(--color-danger-500)'}}
                  onClick={e => { e.stopPropagation(); deleteEntry(entry) }} title="Delete">
                  <Trash2 size={11}/>
                </button>
              </div>
            </div>
          ))}
          {displayed.length === 0 && (
            <div className="empty-state" style={{padding:'40px'}}>
              <Folder size={28} className="empty-state-icon"/>
              <p className="empty-state-title">Empty directory</p>
            </div>
          )}
        </div>
      )}
      {editingFile && (
        <SFTPEditorModal
          sessionId={sessionId}
          remotePath={editingFile.path}
          onClose={() => setEditingFile(null)}
          onSave={() => loadDir(path)}
        />
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB'
  if (bytes < 1024*1024*1024) return (bytes/1024/1024).toFixed(1) + ' MB'
  return (bytes/1024/1024/1024).toFixed(2) + ' GB'
}
