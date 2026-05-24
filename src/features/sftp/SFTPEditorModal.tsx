import { useState, useEffect, useRef } from 'react'
import { X, Save, Edit3, Eye, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import './SFTP.css'

interface Props {
  sessionId: string
  remotePath: string
  onClose: () => void
  onSave?: () => void
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const diff: DiffLine[] = []
  
  let i = 0, j = 0
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        diff.push({ type: 'unchanged', text: oldLines[i] })
        i++
        j++
      } else {
        // Look ahead (up to 10 lines) to match alignments
        let foundMatch = false
        for (let k = 1; k <= 10; k++) {
          if (i + k < oldLines.length && oldLines[i + k] === newLines[j]) {
            // Deletions detected
            for (let d = 0; d < k; d++) {
              diff.push({ type: 'removed', text: oldLines[i + d] })
            }
            i += k
            foundMatch = true
            break
          }
          if (j + k < newLines.length && oldLines[i] === newLines[j + k]) {
            // Insertions detected
            for (let ins = 0; ins < k; ins++) {
              diff.push({ type: 'added', text: newLines[j + ins] })
            }
            j += k
            foundMatch = true
            break
          }
        }
        if (!foundMatch) {
          // Mismatch, treat as replacement
          diff.push({ type: 'removed', text: oldLines[i] })
          diff.push({ type: 'added', text: newLines[j] })
          i++
          j++
        }
      }
    } else if (i < oldLines.length) {
      diff.push({ type: 'removed', text: oldLines[i] })
      i++
    } else {
      diff.push({ type: 'added', text: newLines[j] })
      j++
    }
  }
  return diff
}

export default function SFTPEditorModal({ sessionId, remotePath, onClose, onSave }: Props) {
  const [originalContent, setOriginalContent] = useState('')
  const [currentContent, setCurrentContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadContent()
  }, [remotePath])

  const loadContent = async () => {
    setLoading(true)
    setStatus(null)
    try {
      const res = await window.actionshell.sftp.readTextFile(sessionId, remotePath)
      if (res.success) {
        setOriginalContent(res.data)
        setCurrentContent(res.data)
      } else {
        setStatus({ type: 'error', message: res.error || 'Failed to fetch file contents' })
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'An error occurred' })
    } finally {
      setLoading(false)
    }
  }

  const saveContent = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const res = await window.actionshell.sftp.writeTextFile(sessionId, remotePath, currentContent)
      if (res.success) {
        setOriginalContent(currentContent)
        setStatus({ type: 'success', message: 'File saved successfully' })
        setTimeout(() => setStatus(null), 3000)
        onSave?.()
      } else {
        setStatus({ type: 'error', message: res.error || 'Failed to save file' })
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'An error occurred' })
    } finally {
      setSaving(false)
    }
  }

  const syncScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const lineCount = currentContent.split('\n').length
  const linesArray = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1)
  const diffLines = showDiff ? computeLineDiff(originalContent, currentContent) : []

  return (
    <div className="sftp-editor-overlay">
      <div className="sftp-editor-container animate-scaleIn">
        {/* Editor Header */}
        <div className="sftp-editor-header">
          <div className="sftp-editor-title">
            <FileText size={16} className="text-accent-500" />
            <span className="file-name">{remotePath.split('/').pop()}</span>
            <span className="file-path">{remotePath}</span>
          </div>
          
          <div className="sftp-editor-actions">
            <button
              className={`btn btn-sm ${showDiff ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setShowDiff(!showDiff)}
              disabled={loading}
            >
              {showDiff ? <Edit3 size={13} style={{marginRight:'4px'}}/> : <Eye size={13} style={{marginRight:'4px'}}/>}
              {showDiff ? 'Back to Editor' : 'Compare Diff'}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={saveContent}
              disabled={loading || saving || originalContent === currentContent}
            >
              <Save size={13} style={{marginRight:'4px'}} />
              {saving ? 'Saving...' : 'Save File'}
            </button>
            <button className="btn btn-icon btn-sm" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <div className="sftp-editor-body">
          {loading ? (
            <div className="sftp-editor-loading">
              <div className="spinner" />
              <span>Fetching remote file contents...</span>
            </div>
          ) : showDiff ? (
            <div className="sftp-diff-viewer scrollable">
              {diffLines.map((line, idx) => (
                <div key={idx} className={`sftp-diff-line ${line.type}`}>
                  <span className="diff-marker">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <pre className="diff-text">{line.text || ' '}</pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="sftp-textarea-wrapper">
              <div ref={lineNumbersRef} className="sftp-line-numbers scrollable-hidden">
                {linesArray.map(n => (
                  <div key={n} className="line-num">{n}</div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                className="sftp-textarea mono"
                value={currentContent}
                onChange={e => setCurrentContent(e.target.value)}
                onScroll={syncScroll}
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Editor Status Bar */}
        <div className="sftp-editor-footer">
          <div className="status-message">
            {status && (
              <span className={`status-tag ${status.type}`}>
                {status.type === 'success' ? (
                  <CheckCircle size={12} style={{marginRight:'4px'}} />
                ) : (
                  <AlertCircle size={12} style={{marginRight:'4px'}} />
                )}
                {status.message}
              </span>
            )}
          </div>
          <div className="editor-info">
            <span>UTF-8</span>
            <span>Lines: {lineCount}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
