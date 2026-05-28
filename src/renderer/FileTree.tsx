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

  const handleContextMenu = async (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    const isDirectory = node.isDirectory;
    const parentPath = isDirectory ? node.path : node.path.substring(0, node.path.lastIndexOf(/[/\\]/) || 0);
    
    const menu = new (window as any).electronAPI.showContextMenu ? 
      (window as any).electronAPI.showContextMenu() : null; // we'll use native Menu in main later if needed
    // Simple confirm for now - can be upgraded to native Menu later
    const choice = confirm(`Create New ${isDirectory ? 'File' : 'Item'} in ${node.name}?`);
    if (!choice) return;
    
    const name = prompt('Enter name:');
    if (!name) return;

    const fullPath = `${parentPath}\\${name}`;
    if (isDirectory) {
      await (window as any).electronAPI.createFile(fullPath, ''); // new file
    } else {
      await (window as any).electronAPI.createDirectory(fullPath);
    }
    // Refresh tree after creation (call the refresh function you already have in FileTree)
  };

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
                onContextMenu={(e) => handleContextMenu(e, node)}
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
              onContextMenu={(e) => handleContextMenu(e, node)}
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
