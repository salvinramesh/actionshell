import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import type { TerminalTab } from '../../store/terminal.store'
import { useTerminalStore } from '../../store/terminal.store'
import { useUIStore } from '../../store/ui.store'

const THEMES: Record<string, any> = {
  dark: {
    background: '#0A0E1A', foreground: '#CDD6F4', cursor: '#00D4FF',
    cursorAccent: '#0A0E1A', selectionBackground: '#1E3A5F',
    black: '#181825', red: '#F38BA8', green: '#A6E3A1', yellow: '#F9E2AF',
    blue: '#89B4FA', magenta: '#CBA6F7', cyan: '#00D4FF', white: '#BAC2DE',
    brightBlack: '#585B70', brightRed: '#F38BA8', brightGreen: '#A6E3A1',
    brightYellow: '#F9E2AF', brightBlue: '#89B4FA', brightMagenta: '#CBA6F7',
    brightCyan: '#94E2D5', brightWhite: '#A6ADC8'
  },
  light: {
    background: '#F8FAFF', foreground: '#2A3252', cursor: '#00B8D9',
    cursorAccent: '#F8FAFF', selectionBackground: '#9AAAD6',
    black: '#0A0E1A', red: '#F43F5E', green: '#10D98A', yellow: '#F59E0B',
    blue: '#4B619A', magenta: '#7C93D8', cyan: '#00B8D9', white: '#516090',
    brightBlack: '#616A8C', brightRed: '#FB7185', brightGreen: '#22E89A',
    brightYellow: '#FBBF24', brightBlue: '#6B80C0', brightMagenta: '#8DA6F0',
    brightCyan: '#26DCFF', brightWhite: '#1A2238'
  },
  nord: {
    background: '#2e3440', foreground: '#d8dee9', cursor: '#88c0d0',
    cursorAccent: '#2e3440', selectionBackground: '#434c5e',
    black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
    blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
    brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b', brightBlue: '#81a1c1', brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb', brightWhite: '#eceff4'
  },
  dracula: {
    background: '#282a36', foreground: '#f8f8f2', cursor: '#bd93f9',
    cursorAccent: '#282a36', selectionBackground: '#44475a',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#6272a4', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
    brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
    brightCyan: '#a4ffff', brightWhite: '#ffffff'
  },
  solarized: {
    background: '#002b36', foreground: '#839496', cursor: '#586e75',
    cursorAccent: '#002b36', selectionBackground: '#073642',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
    blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75',
    brightYellow: '#657b83', brightBlue: '#839496', brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1', brightWhite: '#fdf6e3'
  }
}

function highlightLogs(data: string): string {
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
  const parts = data.split(ansiRegex)
  const matches = data.match(ansiRegex) || []
  
  const highlightedParts = parts.map(part => {
    if (!part) return part
    return part
      .replace(/\b(ERROR|FAIL)\b/g, '\x1b[1;31m$1\x1b[22m\x1b[39m')
      .replace(/\b(SUCCESS)\b/g, '\x1b[1;32m$1\x1b[22m\x1b[39m')
      .replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, '\x1b[1;36m$1\x1b[22m\x1b[39m')
  })
  
  let result = ''
  for (let i = 0; i < highlightedParts.length; i++) {
    result += highlightedParts[i]
    if (i < matches.length) {
      result += matches[i]
    }
  }
  return result
}

interface Props { tab: TerminalTab; active: boolean }

export default function TerminalPane({ tab, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const { updateTab } = useTerminalStore()
  const spawnedRef = useRef(false)

  const { termTheme, termFontSize, termFontFamily, logHighlightActive } = useUIStore()

  // Update configuration dynamically
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = THEMES[termTheme] || THEMES.dark
      xtermRef.current.options.fontSize = termFontSize
      xtermRef.current.options.fontFamily = termFontFamily
      try {
        fitRef.current?.fit()
      } catch {}
    }
  }, [termTheme, termFontSize, termFontFamily])

  useEffect(() => {
    if (!containerRef.current || xtermRef.current) return

    const xterm = new XTerm({
      theme: THEMES[termTheme] || THEMES.dark,
      fontFamily: termFontFamily,
      fontSize: termFontSize,
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
      // Keystroke broadcasting logic
      const terminalStore = useTerminalStore.getState()
      if (terminalStore.broadcastActive) {
        terminalStore.tabs.forEach(t => {
          if (t.status === 'connected') {
            window.actionshell.terminal.input(t.sessionId, data, t.isLocal || false)
          }
        })
      } else {
        window.actionshell.terminal.input(tab.sessionId, data, tab.isLocal || false)
      }
    })

    // Terminal output listener
    const removeOutput = window.actionshell.terminal.onOutput(({ sessionId, data }) => {
      if (sessionId === tab.sessionId) {
        if (useUIStore.getState().logHighlightActive) {
          xterm.write(highlightLogs(data))
        } else {
          xterm.write(data)
        }
      }
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

  const activeTheme = THEMES[termTheme] || THEMES.dark

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        display: active ? 'block' : 'none',
        background: activeTheme.background,
        padding: '4px'
      }}
    />
  )
}
