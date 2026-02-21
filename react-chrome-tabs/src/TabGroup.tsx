import React from 'react';
import { ChromeTabs, type TabProperties } from './ChromeTabs';

export interface TabGroupData {
  id: string;
  label: string;
  color: string;
  collapsed: boolean;
  tabs: TabProperties[];
}

export interface TabGroupProps {
  group: TabGroupData;
  darkMode?: boolean;
  onToggleCollapse?: (groupId: string) => void;
  onTabActive?: (groupId: string, tabId: string) => void;
  onTabClose?: (groupId: string, tabId: string) => void;
  onTabReorder?: (groupId: string, tabId: string, fromIndex: number, toIndex: number) => void;
}

export function TabGroup({
  group,
  darkMode = false,
  onToggleCollapse,
  onTabActive,
  onTabClose,
  onTabReorder,
}: TabGroupProps) {
  const handleToggle = () => {
    onToggleCollapse?.(group.id);
  };

  const handleTabActive = (tabId: string) => {
    onTabActive?.(group.id, tabId);
  };

  const handleTabClose = (tabId: string) => {
    onTabClose?.(group.id, tabId);
  };

  const handleTabReorder = (tabId: string, fromIndex: number, toIndex: number) => {
    onTabReorder?.(group.id, tabId, fromIndex, toIndex);
  };

  return (
    <div className="tab-group-container" style={{ marginBottom: '8px' }}>
      {/* Group label with colored dot */}
      <div
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: darkMode ? '#202124' : '#dee1e6',
          borderRadius: group.collapsed ? '4px' : '4px 4px 0 0',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = darkMode ? '#292b2e' : '#d0d3d8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = darkMode ? '#202124' : '#dee1e6';
        }}
      >
        {/* Colored dot */}
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: group.color,
            flexShrink: 0,
          }}
        />

        {/* Group label */}
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: darkMode ? '#f1f3f4' : '#45474a',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {group.label}
        </span>

        {/* Collapse/expand indicator */}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '10px',
            color: darkMode ? '#9ca1a7' : '#5f6368',
            transform: group.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          ▼
        </span>

        {/* Tab count when collapsed */}
        {group.collapsed && (
          <span
            style={{
              fontSize: '11px',
              color: darkMode ? '#9ca1a7' : '#5f6368',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            ({group.tabs.length})
          </span>
        )}
      </div>

      {/* Tabs (only shown when expanded) */}
      {!group.collapsed && (
        <ChromeTabs
          tabs={group.tabs}
          darkMode={darkMode}
          onTabActive={handleTabActive}
          onTabClose={handleTabClose}
          onTabReorder={handleTabReorder}
          draggable={true}
        />
      )}
    </div>
  );
}
