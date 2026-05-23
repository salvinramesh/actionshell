import { useState, useEffect, useRef } from 'react'
import { Search, X, Zap, Play, Tag } from 'lucide-react'
import { useUIStore } from '../../store/ui.store'
import { useAuthStore } from '../../store/auth.store'
import { useTerminalStore } from '../../store/terminal.store'
import type { Snippet } from '../../../shared/types'

export default function SnippetPalette() {
  const { setShowSnippetPalette } = useUIStore()
  const { session } = useAuthStore()
  const { tabs, activeTabId } = useTerminalStore()
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    if (session) {
      window.actionshell.snippets.list(session.userId, session.role)
        .then(res => { if (res.success) setSnippets(res.data as Snippet[]) })
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSnippetPalette(false)
      if (e.key === 'ArrowDown') setSelected(s => Math.min(s+1, filtered.length-1))
      if (e.key === 'ArrowUp') setSelected(s => Math.max(s-1, 0))
      if (e.key === 'Enter') executeSelected()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected, query])

  const filtered = snippets.filter(s =>
    !query || s.title.toLowerCase().includes(query.toLowerCase()) ||
    s.command.toLowerCase().includes(query.toLowerCase()) ||
    s.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
  )

  const executeSnippet = async (snippet: Snippet) => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (!activeTab || activeTab.status !== 'connected') return
    
    let command = snippet.command
    if (snippet.variables?.length > 0) {
      for (const v of snippet.variables) {
        const val = prompt(`${v.description || v.name} (default: ${v.default}):`) ?? v.default
        command = command.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), val)
      }
    }
    
    await window.actionshell.terminal.input(activeTab.sessionId, command + '\r', activeTab.isLocal || false)
    setShowSnippetPalette(false)
  }

  const executeSelected = () => {
    if (filtered[selected]) executeSnippet(filtered[selected])
  }

  return (
    <div className="modal-overlay" onClick={() => setShowSnippetPalette(false)}>
      <div className="snippet-palette animate-scaleIn" onClick={e => e.stopPropagation()}>
        {/* Search */}
        <div className="snippet-search">
          <Zap size={14} style={{color:'var(--color-accent-500)',flexShrink:0}}/>
          <input ref={inputRef} className="snippet-input" placeholder="Search snippets…"
            value={query} onChange={e => { setQuery(e.target.value); setSelected(0) }} />
          <button className="btn btn-icon btn-sm" onClick={() => setShowSnippetPalette(false)}>
            <X size={13}/>
          </button>
        </div>

        {/* Results */}
        <div className="snippet-list scrollable" style={{maxHeight:'400px'}}>
          {filtered.length === 0 && (
            <div className="empty-state" style={{padding:'32px'}}>
              <Zap size={24} className="empty-state-icon"/>
              <p className="empty-state-title">No snippets found</p>
            </div>
          )}
          {filtered.map((s, i) => (
            <div key={s.id}
              className={`snippet-item ${i === selected ? 'selected' : ''}`}
              onClick={() => executeSnippet(s)}
              onMouseEnter={() => setSelected(i)}>
              <div className="snippet-item-header">
                <span className="snippet-item-title">{s.title}</span>
                <div style={{display:'flex',gap:'4px'}}>
                  {s.tags.map(t => <span key={t} className="tag">{t}</span>)}
                  <span className={`badge ${s.scope==='global'?'badge-cyan':s.scope==='team'?'badge-slate':'badge-slate'}`} style={{fontSize:'10px'}}>
                    {s.scope}
                  </span>
                </div>
              </div>
              <code className="snippet-item-cmd mono">{s.command}</code>
              {s.description && <p className="snippet-item-desc">{s.description}</p>}
            </div>
          ))}
        </div>

        <div className="snippet-footer">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Execute</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>

      <style>{`
        .snippet-palette { background:var(--color-base-750); border:1px solid var(--color-border-default); border-radius:var(--radius-xl); width:600px; box-shadow:var(--shadow-xl); overflow:hidden; }
        .snippet-search { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid var(--color-border-subtle); }
        .snippet-input { flex:1; background:none; border:none; outline:none; font-size:var(--text-md); color:var(--color-text-100); }
        .snippet-input::placeholder { color:var(--color-text-700); }
        .snippet-list { padding:4px; }
        .snippet-item { padding:10px 12px; border-radius:var(--radius-md); cursor:pointer; transition:background 80ms; margin-bottom:2px; }
        .snippet-item.selected { background:var(--color-base-650); }
        .snippet-item-header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; }
        .snippet-item-title { font-size:var(--text-sm); font-weight:var(--weight-semibold); color:var(--color-text-200); }
        .snippet-item-cmd { display:block; font-size:var(--text-xs); color:var(--color-accent-500); background:var(--color-base-800); padding:4px 8px; border-radius:var(--radius-sm); margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .snippet-item-desc { font-size:var(--text-xs); color:var(--color-text-600); margin-top:4px; }
        .snippet-footer { display:flex; gap:16px; padding:8px 16px; border-top:1px solid var(--color-border-subtle); font-size:var(--text-xs); color:var(--color-text-600); }
        .snippet-footer kbd { background:var(--color-base-600); border:1px solid var(--color-border-strong); border-radius:3px; padding:1px 5px; font-family:var(--font-mono); font-size:10px; color:var(--color-text-300); margin-right:3px; }
      `}</style>
    </div>
  )
}
