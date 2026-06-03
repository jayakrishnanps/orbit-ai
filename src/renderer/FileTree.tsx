import { useState } from 'react';

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

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
                <span className="tree-item__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                </span>
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
              <span className="tree-item__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              </span>
              {node.name}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
