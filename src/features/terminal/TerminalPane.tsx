import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import type { TerminalTab } from '../../store/terminal.store'
import { useTerminalStore } from '../../store/terminal.store'

const DARK_THEME = {
  background: '#0A0E1A', foreground: '#CDD6F4', cursor: '#00D4FF',
  cursorAccent: '#0A0E1A', selectionBackground: '#1E3A5F',
  black: '#181825', red: '#F38BA8', green: '#A6E3A1', yellow: '#F9E2AF',
  blue: '#89B4FA', magenta: '#CBA6F7', cyan: '#00D4FF', white: '#BAC2DE',
  brightBlack: '#585B70', brightRed: '#F38BA8', brightGreen: '#A6E3A1',
  brightYellow: '#F9E2AF', brightBlue: '#89B4FA', brightMagenta: '#CBA6F7',
  brightCyan: '#94E2D5', brightWhite: '#A6ADC8'
}

interface Props { tab: TerminalTab; active: boolean }

export default function TerminalPane({ tab, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const { updateTab } = useTerminalStore()
  const spawnedRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || xtermRef.current) return

    const xterm = new XTerm({
      theme: DARK_THEME,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      allowTransparency: true,
      allowProposedApi: true,
    })

    const fit = new FitAddon()
    const webLinks = new WebLinksAddon()
    const search = new SearchAddon()

    xterm.loadAddon(fit)
    xterm.loadAddon(webLinks)
    xterm.loadAddon(search)
    xterm.open(containerRef.current)
    fit.fit()

    xtermRef.current = xterm
    fitRef.current = fit

    // Send input
    xterm.onData((data) => {
      window.actionshell.terminal.input(tab.sessionId, data, tab.isLocal || false)
    })

    // Terminal output listener
    const removeOutput = window.actionshell.terminal.onOutput(({ sessionId, data }) => {
      if (sessionId === tab.sessionId) xterm.write(data)
    })

    // Terminal close listener
    const removeClose = window.actionshell.terminal.onClose(({ sessionId }) => {
      if (sessionId === tab.sessionId) {
        xterm.write('\r\n\x1b[90m[Connection closed]\x1b[0m\r\n')
        updateTab(tab.id, { status: 'closed' })
      }
    })

    // Terminal error listener
    const removeError = window.actionshell.terminal.onError(({ sessionId, error }) => {
      if (sessionId === tab.sessionId) {
        xterm.write(`\r\n\x1b[31m[Error: ${error}]\x1b[0m\r\n`)
        updateTab(tab.id, { status: 'error' })
      }
    })

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit()
        const { cols, rows } = xterm
        window.actionshell.terminal.resize(tab.sessionId, cols, rows, tab.isLocal || false)
      } catch {}
    })
    if (containerRef.current) resizeObserver.observe(containerRef.current)

    // Spawn the session
    if (!spawnedRef.current) {
      spawnedRef.current = true
      const { cols, rows } = xterm
      if (tab.isLocal) {
        window.actionshell.terminal.spawnLocal(tab.sessionId, undefined, cols, rows)
          .then(res => updateTab(tab.id, { status: res.success ? 'connected' : 'error' }))
      } else if (tab.hostId) {
        xterm.write(`\x1b[90mConnecting to ${tab.hostname}...\x1b[0m\r\n`)
        window.actionshell.terminal.spawnSSH(tab.sessionId, tab.hostId, cols, rows, '')
          .then(res => updateTab(tab.id, { status: res.success ? 'connected' : 'error' }))
          .catch(err => {
            xterm.write(`\r\n\x1b[31mConnection failed: ${err.message}\x1b[0m\r\n`)
            updateTab(tab.id, { status: 'error' })
          })
      }
    }

    return () => {
      removeOutput()
      removeClose()
      removeError()
      resizeObserver.disconnect()
    }
  }, [])

  // Focus when active
  useEffect(() => {
    if (active) xtermRef.current?.focus()
  }, [active])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        display: active ? 'block' : 'none',
        background: '#0A0E1A',
        padding: '4px'
      }}
    />
  )
}
