import { useState } from 'react';

interface Tab {
  path: string;
  name: string;
  saved: boolean;
}

interface EditorTabsProps {
  tabs: Tab[];
  activeTabPath: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
}

export default function EditorTabs({ tabs, activeTabPath, onTabClick, onTabClose }: EditorTabsProps) {
  return (
    <div className="ide-tabs">
      {tabs.map(tab => (
        <div
          key={tab.path}
          className={`ide-tab ${tab.path === activeTabPath ? 'active' : ''}`}
          onClick={() => onTabClick(tab.path)}
        >
          <span>{tab.name}</span>
          {!tab.saved && <span className="unsaved">●</span>}
          <button
            className="ide-tab-close"
            onClick={(e) => { e.stopPropagation(); onTabClose(tab.path); }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
