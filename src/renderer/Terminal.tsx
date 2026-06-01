import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default function TerminalPanel({ folderPath }: { folderPath?: string | null }) {
  const divRef = useRef<HTMLDivElement>(null);
  const dataHandlerRef = useRef<((data: string) => void) | null>(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e' },
      scrollback: 2000,
      convertEol: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", Menlo, monospace',
      allowTransparency: false,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    if (divRef.current) {
      term.open(divRef.current);
      fitAddon.fit();
      term.focus();
    }

    const dataHandler = (data: string) => term.write(data);
    dataHandlerRef.current = dataHandler;
    (window as any).electronAPI.onTerminalData(dataHandler);

    term.onData((data) => {
      (window as any).electronAPI.terminalWrite(data);
    });

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      const { cols, rows } = term;
      (window as any).electronAPI.terminalResize(cols, rows);
    });
    if (divRef.current) observer.observe(divRef.current);

    // Give the layout one frame to compute real size, then fit + tell PTY the real dimensions, then start shell.
    // For very large folders this helps the shell start with correct size instead of a tiny viewport.
    requestAnimationFrame(() => {
      if (divRef.current) {
        fitAddon.fit();
        const { cols, rows } = term;
        // Only send resize if we have a reasonable size (prevents starting shell in 1x1 or 0x0)
        if (cols > 4 && rows > 4) {
          (window as any).electronAPI.terminalResize(cols, rows);
        }
      }

      const createTerminal = async () => {
        try {
          await (window as any).electronAPI.terminalCreate(folderPath ?? undefined);

          // Extra safety resize ~300ms after spawn. Helps when opening very large folders
          // where the first layout measurement was still settling.
          setTimeout(() => {
            if (divRef.current) {
              fitAddon.fit();
              const { cols, rows } = term;
              if (cols > 4 && rows > 4) {
                (window as any).electronAPI.terminalResize(cols, rows);
              }
            }
          }, 300);
        } catch (e) {
          console.error('Terminal creation failed', e);
        }
      };
      createTerminal();
    });

    return () => {
      (window as any).electronAPI.terminalDestroy?.();
      if (dataHandlerRef.current) {
        dataHandlerRef.current = null;
      }
      observer.disconnect();
      term.dispose();
    };
  }, [folderPath]);

  return <div ref={divRef} style={{ height: '100%', width: '100%' }} />;
}
