import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default function TerminalPanel({ folderPath }: { folderPath?: string | null }) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e' },
      scrollback: 2000,
      convertEol: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", Menlo, monospace',
      allowTransparency: false,
      windowsPty: {
        backend: 'conpty',
        buildNumber: 19000,
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(divRef.current!);
    fitAddon.fit();
    term.focus();   // Critical: give xterm keyboard focus so keys reach the PTY

    (window as any).electronAPI.terminalCreate(folderPath ?? undefined);

    (window as any).electronAPI.onTerminalData((data: string) => {
      term.write(data);
    });

    term.onData((data) => {
      (window as any).electronAPI.terminalWrite(data);
    });

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      const { cols, rows } = term;
      (window as any).electronAPI.terminalResize(cols, rows);
    });
    observer.observe(divRef.current!);

    return () => {
      observer.disconnect();
      term.dispose();
    };
  }, [folderPath]);

  return <div ref={divRef} style={{ height: '100%', width: '100%' }} />;
}
