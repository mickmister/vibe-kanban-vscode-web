import React, { useState, useMemo } from 'react';
import { ChromeTabs } from './ChromeTabs';
import type { TabProperties } from './chrome-tabs';

/**
 * HorizontalTabGroupsV2 - Chrome-style tab groups with lazy-loaded iframes
 *
 * Iframe Rendering Strategy:
 * - Tabs are NOT loaded until first activation (lazy load)
 * - Once loaded, iframes stay in memory with display:none when inactive
 * - Use React Portals (or "reverse-react-portals") to render iframes off-screen
 * - Show loading indicator until iframe onLoad completes
 * - Loaded iframes persist for instant tab switching
 *
 * Close Behavior:
 * - Unloaded tabs: close immediately (no dialog)
 * - Loaded tabs: show confirmation (iframe is in memory)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TabGroupMetadata {
  id: string;
  label: string;
  color: string;
  collapsed: boolean;
}

export interface TabWithGroup extends TabProperties {
  groupId: string;
  customName?: string; // For active tabs
  loaded?: boolean; // Whether iframe has been loaded (lazy load on first activation)
  url?: string; // URL to load in iframe
}

export interface HorizontalTabGroupsV2State {
  groups: TabGroupMetadata[];
  tabs: TabWithGroup[];
}

interface ContextMenuState {
  x: number;
  y: number;
  tabId: string;
  groupId: string;
}

interface ConfirmDialog {
  message: string;
  options: Array<{ label: string; action: () => void; variant?: 'primary' | 'danger' }>;
}

// ============================================================================
// SMART COMPONENT
// ============================================================================

export interface HorizontalTabGroupsV2Props {
  initialState?: HorizontalTabGroupsV2State;
  darkMode?: boolean;
}

export function HorizontalTabGroupsV2({ initialState, darkMode = false }: HorizontalTabGroupsV2Props) {
  const [state, setState] = useState<HorizontalTabGroupsV2State>(
    initialState || { groups: [], tabs: [] }
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);

  // Build visual tab list: group labels + visible tabs
  const visualTabs = useMemo(() => {
    const result: (TabProperties & { isGroupLabel?: boolean; groupId?: string })[] = [];

    state.groups.forEach((group) => {
      // Add group label as a special "tab"
      result.push({
        id: `group-label-${group.id}`,
        title: group.label,
        active: false,
        isGroupLabel: true,
        groupId: group.id,
        isCloseIconVisible: false,
      });

      // Add tabs if group is not collapsed
      if (!group.collapsed) {
        const groupTabs = state.tabs.filter((t) => t.groupId === group.id);
        groupTabs.forEach((tab) => {
          result.push({
            ...tab,
            title: tab.customName || tab.title,
          });
        });
      }
    });

    return result;
  }, [state.groups, state.tabs]);

  const handleTabActive = (tabId: string) => {
    // Check if it's a group label
    if (tabId.startsWith('group-label-')) {
      const groupId = tabId.replace('group-label-', '');
      // Toggle collapse
      setState((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
        ),
      }));
      return;
    }

    // Regular tab activation - mark as loaded if first time
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => ({
        ...t,
        active: t.id === tabId,
        loaded: t.id === tabId ? true : t.loaded, // Mark as loaded on first activation
      })),
    }));
  };

  const handleTabClose = (tabId: string) => {
    // Ignore if it's a group label
    if (tabId.startsWith('group-label-')) return;

    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.filter((t) => t.id !== tabId),
    }));
  };

  const handleContextMenu = (tabId: string, event: MouseEvent) => {
    event.preventDefault();

    // Ignore if it's a group label
    if (tabId.startsWith('group-label-')) return;

    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      tabId,
      groupId: tab.groupId,
    });
  };

  const handleDuplicateTab = () => {
    if (!contextMenu) return;

    const originalTab = state.tabs.find((t) => t.id === contextMenu.tabId);
    if (!originalTab) return;

    const newTab: TabWithGroup = {
      ...originalTab,
      id: `${originalTab.id}-copy-${Date.now()}`,
      title: `${originalTab.title} (Copy)`,
      active: false,
    };

    setState((prev) => {
      // Find index of original tab and insert after it
      const originalIndex = prev.tabs.findIndex((t) => t.id === contextMenu.tabId);
      const newTabs = [...prev.tabs];
      newTabs.splice(originalIndex + 1, 0, newTab);
      return { ...prev, tabs: newTabs };
    });

    setContextMenu(null);
  };

  const handleNewTabInGroup = () => {
    if (!contextMenu) return;

    const group = state.groups.find((g) => g.id === contextMenu.groupId);
    if (!group) return;

    const newTab: TabWithGroup = {
      id: `tab-${Date.now()}`,
      title: 'New Tab',
      active: false,
      groupId: contextMenu.groupId,
    };

    setState((prev) => {
      // Add to end of group's tabs
      const groupTabs = prev.tabs.filter((t) => t.groupId === contextMenu.groupId);
      const lastGroupTabIndex = prev.tabs.findIndex(
        (t) => t.id === groupTabs[groupTabs.length - 1]?.id
      );
      const newTabs = [...prev.tabs];
      newTabs.splice(lastGroupTabIndex + 1, 0, newTab);
      return { ...prev, tabs: newTabs };
    });

    setContextMenu(null);
  };

  const handleCloseTab = () => {
    if (!contextMenu) return;

    const tab = state.tabs.find((t) => t.id === contextMenu.tabId);
    if (!tab) return;

    // Only show confirm dialog if tab is loaded (has iframe in memory)
    if (tab.loaded) {
      setConfirmDialog({
        message: 'This tab is loaded in memory. Close it?',
        options: [
          {
            label: 'Cancel',
            action: () => setConfirmDialog(null),
          },
          {
            label: 'Close Tab',
            action: () => {
              setState((prev) => ({
                ...prev,
                tabs: prev.tabs.filter((t) => t.id !== contextMenu.tabId),
              }));
              setConfirmDialog(null);
            },
            variant: 'danger',
          },
        ],
      });
    } else {
      // Not loaded - just close immediately
      setState((prev) => ({
        ...prev,
        tabs: prev.tabs.filter((t) => t.id !== contextMenu.tabId),
      }));
    }

    setContextMenu(null);
  };

  return (
    <div
      style={{
        backgroundColor: darkMode ? '#202124' : '#dee1e6',
        padding: '8px',
        minHeight: '50px',
      }}
      onClick={() => setContextMenu(null)}
    >
      {/* Single ChromeTabs instance managing everything */}
      <ChromeTabs
        tabs={visualTabs}
        darkMode={darkMode}
        onTabActive={handleTabActive}
        onTabClose={handleTabClose}
        onContextMenu={handleContextMenu}
        draggable={true}
      />

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '180px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem onClick={handleDuplicateTab}>Duplicate Tab</MenuItem>
          <MenuItem onClick={handleNewTabInGroup}>New Tab in Group</MenuItem>
          <MenuDivider />
          <MenuItem onClick={handleCloseTab} danger>
            Close Tab
          </MenuItem>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => setConfirmDialog(null)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '16px', fontSize: '14px' }}>
              {confirmDialog.message}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              {confirmDialog.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={opt.action}
                  style={{
                    padding: '8px 16px',
                    backgroundColor:
                      opt.variant === 'danger'
                        ? '#ea4335'
                        : opt.variant === 'primary'
                        ? '#4285f4'
                        : '#f0f0f0',
                    color: opt.variant ? '#fff' : '#000',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Visual styling for group labels */}
      <style>{`
        .chrome-tab[data-tab-id^="group-label-"] {
          background: linear-gradient(to bottom, #e8eaed 0%, #dadce0 100%) !important;
          font-weight: 600;
          cursor: pointer;
        }
        .chrome-tab[data-tab-id^="group-label-"] .chrome-tab-background {
          display: none;
        }
        .chrome-tab[data-tab-id^="group-label-"]:hover {
          background: linear-gradient(to bottom, #d0d3d8 0%, #c8cbcf 100%) !important;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// MENU COMPONENTS
// ============================================================================

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        fontSize: '13px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: danger ? '#ea4335' : '#000',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {children}
    </div>
  );
}

function MenuDivider() {
  return (
    <div
      style={{
        height: '1px',
        backgroundColor: '#e0e0e0',
        margin: '4px 0',
      }}
    />
  );
}
