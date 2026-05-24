import { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

// ── FileTree ─────────────────────────────────────────────────────────────────
interface FileTreeProps {
  nodes: FileNode[];
  depth: number;
  currentFile: string | null;
  onFileClick: (path: string) => void;
}

export function FileTree({ nodes, depth, currentFile, onFileClick }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (p: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  return (
    <>
      {nodes.map(node => (
        <div key={node.path}>
          {node.type === 'directory' ? (
            <>
              <div
                className="tree-item tree-item--dir"
                style={{ paddingLeft: 8 + depth * 12 }}
                onClick={() => toggle(node.path)}
              >
                <span className="tree-item__arrow">
                  {expanded.has(node.path) ? '▾' : '▸'}
                </span>
                <span className="tree-item__icon">📁</span>
                {node.name}
              </div>
              {expanded.has(node.path) && node.children && (
                <FileTree
                  nodes={node.children}
                  depth={depth + 1}
                  currentFile={currentFile}
                  onFileClick={onFileClick}
                />
              )}
            </>
          ) : (
            <div
              className={`tree-item tree-item--file${currentFile === node.path ? ' tree-item--active' : ''}`}
              style={{ paddingLeft: 20 + depth * 12 }}
              onClick={() => onFileClick(node.path)}
            >
              <span className="tree-item__icon">📄</span>
              {node.name}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
