import React, { useState, useEffect } from 'react'
import { useConnectionsStore } from '../../store/connections.store'
import { Network, Plus, Trash2, Play, Square, Activity, ArrowRight, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import './Tunnels.css'

interface Tunnel {
  id: string
  hostId: string
  name: string
  type: 'local' | 'remote' | 'dynamic'
  localPort: number
  remoteHost: string
  remotePort: number
  status: 'active' | 'inactive' | 'error'
  error?: string
  connectionsCount: number
  bytesTransferred: number
}

export default function TunnelsManager() {
  const { hosts } = useConnectionsStore()
  const [tunnels, setTunnels] = useState<Tunnel[]>([])
  
  // Form states
  const [hostId, setHostId] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'local' | 'remote' | 'dynamic'>('local')
  const [localPort, setLocalPort] = useState(8080)
  const [remoteHost, setRemoteHost] = useState('127.0.0.1')
  const [remotePort, setRemotePort] = useState(80)
  
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (hosts.length > 0) {
      setHostId(hosts[0].id)
    }
  }, [hosts])

  useEffect(() => {
    loadTunnels()
    const timer = setInterval(loadTunnels, 1500)
    return () => clearInterval(timer)
  }, [])

  const loadTunnels = async () => {
    try {
      const res = await window.actionshell.tunnels.list()
      if (res.success) {
        setTunnels(res.data as Tunnel[])
      }
    } catch {}
  }

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    if (!hostId) {
      setError('Please select a server host')
      return
    }
    if (!name.trim()) {
      setError('Please provide a tunnel name')
      return
    }

    const tunnelConfig = {
      id: Math.random().toString(36).substring(2, 9),
      hostId,
      name,
      type,
      localPort: Number(localPort),
      remoteHost,
      remotePort: Number(remotePort)
    }

    setRefreshing(true)
    try {
      const res = await window.actionshell.tunnels.start(tunnelConfig)
      if (res.success) {
        setSuccess(`Tunnel "${name}" started successfully!`)
        setName('')
        // Clear success message after 4s
        setTimeout(() => setSuccess(''), 4000)
        loadTunnels()
      } else {
        setError(res.error || 'Failed to start tunnel')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setRefreshing(false)
    }
  }

  const handleStop = async (id: string) => {
    try {
      const res = await window.actionshell.tunnels.stop(id)
      if (res.success) {
        loadTunnels()
      }
    } catch {}
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getHostName = (id: string): string => {
    const host = hosts.find(h => h.id === id)
    return host ? host.name : 'Unknown Host'
  }

  return (
    <div className="tunnels-layout animate-fadeIn">
      {/* Left panel: Add Tunnel Form */}
      <div className="tunnels-form-panel">
        <div className="tunnels-panel-header">
          <Network className="text-accent-500" size={16} />
          <h2>Configure Port Forwarding</h2>
        </div>
        
        <form onSubmit={handleStart} className="tunnels-form">
          <div className="form-group">
            <label className="form-label">SSH Server Host</label>
            <select className="form-input form-select" value={hostId} onChange={e => setHostId(e.target.value)}>
              {hosts.map(h => (
                <option key={h.id} value={h.id}>{h.name} ({h.hostname})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tunnel Name</label>
            <input 
              className="form-input" 
              placeholder="e.g. Postgres DB, Web Server proxy" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tunnel Type</label>
            <select 
              className="form-input form-select" 
              value={type} 
              onChange={e => setType(e.target.value as any)}
            >
              <option value="local">Local Forwarding (Remote port to Local Port)</option>
              <option value="remote">Remote Forwarding (Reverse: Local server to Public Remote)</option>
              <option value="dynamic">Dynamic SOCKS5 Proxy Server</option>
            </select>
          </div>

          <div className="tunnel-ports-grid">
            <div className="form-group">
              <label className="form-label">Local Port</label>
              <input 
                className="form-input" 
                type="number" 
                value={localPort} 
                onChange={e => setLocalPort(Number(e.target.value))} 
                min={1} 
                max={65535} 
                required
              />
            </div>

            {type !== 'dynamic' && (
              <>
                <div className="form-group">
                  <label className="form-label">Remote Host</label>
                  <input 
                    className="form-input" 
                    value={remoteHost} 
                    onChange={e => setRemoteHost(e.target.value)} 
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Remote Port</label>
                  <input 
                    className="form-input" 
                    type="number" 
                    value={remotePort} 
                    onChange={e => setRemotePort(Number(e.target.value))} 
                    min={1} 
                    max={65535} 
                    required
                  />
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="tunnel-msg error">
              <AlertCircle size={14} style={{flexShrink:0}} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="tunnel-msg success">
              <CheckCircle size={14} style={{flexShrink:0}} />
              <span>{success}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={refreshing}>
            {refreshing ? <span className="spinner" /> : <><Plus size={14} style={{marginRight:'4px'}}/> Create & Start Tunnel</>}
          </button>
        </form>
      </div>

      {/* Right panel: Active Tunnels Grid */}
      <div className="tunnels-dashboard">
        <div className="tunnels-panel-header">
          <Activity className="text-success-500" size={16} />
          <h2>Active Tunnels</h2>
          <button className="btn btn-ghost btn-sm" onClick={loadTunnels} title="Refresh Statistics">
            <RefreshCw size={13} />
          </button>
        </div>

        {tunnels.length === 0 ? (
          <div className="tunnels-empty-state">
            <Network size={36} className="empty-icon" />
            <h3>No Active SSH Tunnels</h3>
            <p>Configure and start a tunnel on the left to securely route database, web, or proxy traffic through your servers.</p>
          </div>
        ) : (
          <div className="tunnels-list scrollable">
            {tunnels.map(t => (
              <div key={t.id} className={`tunnel-card ${t.status}`}>
                <div className="tunnel-card-header">
                  <div className="tunnel-info">
                    <span className="tunnel-card-title">{t.name}</span>
                    <span className="tunnel-server-name">{getHostName(t.hostId)}</span>
                  </div>
                  <span className={`tunnel-type-tag ${t.type}`}>{t.type.toUpperCase()}</span>
                </div>

                <div className="tunnel-route">
                  {t.type === 'local' && (
                    <>
                      <div className="route-node">
                        <span className="node-label">Local Bind</span>
                        <span className="node-val">127.0.0.1:{t.localPort}</span>
                      </div>
                      <ArrowRight size={14} className="route-arrow text-accent-500" />
                      <div className="route-node">
                        <span className="node-label">Remote Target</span>
                        <span className="node-val">{t.remoteHost}:{t.remotePort}</span>
                      </div>
                    </>
                  )}
                  {t.type === 'remote' && (
                    <>
                      <div className="route-node">
                        <span className="node-label">Local Host</span>
                        <span className="node-val">{t.remoteHost}:{t.localPort}</span>
                      </div>
                      <ArrowRight size={14} className="route-arrow text-success-500" />
                      <div className="route-node">
                        <span className="node-label">Remote Bind</span>
                        <span className="node-val">remote:{t.remotePort}</span>
                      </div>
                    </>
                  )}
                  {t.type === 'dynamic' && (
                    <div className="route-node">
                      <span className="node-label">SOCKS5 Proxy server</span>
                      <span className="node-val">socks5://127.0.0.1:{t.localPort}</span>
                    </div>
                  )}
                </div>

                <div className="tunnel-stats">
                  <div className="stat-item">
                    <span className="stat-lbl">Active Connections</span>
                    <span className="stat-val">{t.connectionsCount}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-lbl">Data Transferred</span>
                    <span className="stat-val">{formatBytes(t.bytesTransferred)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-lbl">Status</span>
                    <span className="status-indicator">
                      <span className={`status-dot ${t.status === 'active' ? 'connected' : 'error'}`} />
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {t.error && (
                  <div className="tunnel-card-error">
                    <AlertCircle size={11} style={{flexShrink:0}} />
                    <span>{t.error}</span>
                  </div>
                )}

                <div className="tunnel-card-actions">
                  <button onClick={() => handleStop(t.id)} className="btn btn-secondary btn-sm text-danger-400">
                    <Square size={11} style={{marginRight:'4px'}} /> Stop Tunnel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
