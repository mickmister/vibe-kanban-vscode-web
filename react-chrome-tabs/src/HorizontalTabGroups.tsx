import React, { useState } from 'react';
import type { TabProperties } from './chrome-tabs';

// ============================================================================
// TYPES
// ============================================================================

export interface TabGroupData {
  id: string;
  label: string;
  color: string;
  collapsed: boolean;
  tabs: TabData[];
}

export interface TabData extends TabProperties {
  customName?: string; // For active tabs - user can rename
}

export interface ActiveTabReference {
  id: string; // unique ID for this reference
  originalTabId: string;
  originalGroupId: string;
  customName?: string;
}

export interface HorizontalTabGroupsState {
  groups: TabGroupData[];
  activeTabReferences: ActiveTabReference[];
}

// ============================================================================
// DUMB COMPONENTS
// ============================================================================

interface TabItemProps {
  tab: TabData;
  active: boolean;
  isReference?: boolean;
  onActivate: () => void;
  onClose: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function TabItem({ tab, active, isReference, onActivate, onClose, onContextMenu }: TabItemProps) {
  const displayName = tab.customName || tab.title;

  return (
    <div
      onClick={onActivate}
      onContextMenu={onContextMenu}
      className={`tab-item ${active ? 'active' : ''} ${isReference ? 'reference' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        cursor: 'pointer',
        userSelect: 'none',
        backgroundColor: active ? '#fff' : isReference ? '#e8f0fe' : '#f4f5f6',
        borderRadius: '8px 8px 0 0',
        position: 'relative',
        transition: 'background-color 0.15s',
        fontSize: '12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        border: isReference ? '2px solid #4285f4' : 'none',
        boxShadow: isReference ? '0 0 8px rgba(66, 133, 244, 0.3)' : 'none',
      }}
    >
      {tab.favicon && (
        <div
          style={{
            width: '16px',
            height: '16px',
            backgroundImage: typeof tab.favicon === 'string' ? `url(${tab.favicon})` : undefined,
            backgroundSize: 'contain',
          }}
        />
      )}
      <span style={{ flexGrow: 1, whiteSpace: 'nowrap' }}>{displayName}</span>
      {!tab.isCloseIconVisible && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

interface CollapsedGroupProps {
  group: TabGroupData;
  onExpand: () => void;
}

function CollapsedGroup({ group, onExpand }: CollapsedGroupProps) {
  return (
    <div
      onClick={onExpand}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        cursor: 'pointer',
        userSelect: 'none',
        backgroundColor: '#dee1e6',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: group.color,
        }}
      />
      <span>{group.label}</span>
      <span style={{ fontSize: '10px' }}>▶</span>
      <span style={{ fontSize: '11px', color: '#5f6368' }}>({group.tabs.length})</span>
    </div>
  );
}

interface ExpandedGroupProps {
  group: TabGroupData;
  activeTabId: string | null;
  onCollapse: () => void;
  onTabActivate: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabContextMenu?: (tabId: string, e: React.MouseEvent) => void;
}

function ExpandedGroup({
  group,
  activeTabId,
  onCollapse,
  onTabActivate,
  onTabClose,
  onTabContextMenu,
}: ExpandedGroupProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {/* Group label */}
      <div
        onClick={onCollapse}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: '#dee1e6',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: group.color,
          }}
        />
        <span>{group.label}</span>
        <span style={{ fontSize: '10px' }}>▼</span>
      </div>

      {/* Tabs */}
      {group.tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          active={tab.id === activeTabId}
          onActivate={() => onTabActivate(tab.id)}
          onClose={() => onTabClose(tab.id)}
          onContextMenu={onTabContextMenu ? (e) => onTabContextMenu(tab.id, e) : undefined}
        />
      ))}
    </div>
  );
}

// ============================================================================
// SMART COMPONENT
// ============================================================================

export interface HorizontalTabGroupsProps {
  initialState?: HorizontalTabGroupsState;
  darkMode?: boolean;
}

export function HorizontalTabGroups({ initialState, darkMode = false }: HorizontalTabGroupsProps) {
  const [state, setState] = useState<HorizontalTabGroupsState>(
    initialState || { groups: [], activeTabReferences: [] }
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
    groupId: string;
    isReference?: boolean;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const [renameDialog, setRenameDialog] = useState<{
    referenceId: string;
    currentName: string;
  } | null>(null);

  // Find active tab across all groups
  const activeTab = state.groups
    .flatMap((g) => g.tabs)
    .find((t) => t.active);

  const handleToggleCollapse = (groupId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
      ),
    }));
  };

  const handleTabActivate = (groupId: string, tabId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => ({
        ...g,
        tabs: g.tabs.map((t) => ({
          ...t,
          active: g.id === groupId && t.id === tabId,
        })),
      })),
    }));
  };

  const handleTabClose = (groupId: string, tabId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? { ...g, tabs: g.tabs.filter((t) => t.id !== tabId) }
          : g
      ),
    }));
  };

  const handleTabContextMenu = (groupId: string, tabId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId,
      groupId,
    });
  };

  const handleAddToActiveTabs = (groupId: string, tabId: string) => {
    const newRef: ActiveTabReference = {
      id: `ref-${Date.now()}`,
      originalTabId: tabId,
      originalGroupId: groupId,
    };
    setState((prev) => ({
      ...prev,
      activeTabReferences: [...prev.activeTabReferences, newRef],
    }));
    setContextMenu(null);
  };

  const handleRevealInMainTabs = (groupId: string, tabId: string) => {
    // Expand the group and activate the tab
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => ({
        ...g,
        collapsed: g.id === groupId ? false : g.collapsed,
        tabs: g.tabs.map((t) => ({
          ...t,
          active: g.id === groupId && t.id === tabId,
        })),
      })),
    }));
    setContextMenu(null);
  };

  const handleActiveTabClose = (referenceId: string) => {
    setConfirmDialog({
      message: 'Remove from Active Tabs or close tab completely?',
      onConfirm: () => {
        // Remove from active tabs only
        setState((prev) => ({
          ...prev,
          activeTabReferences: prev.activeTabReferences.filter((r) => r.id !== referenceId),
        }));
        setConfirmDialog(null);
      },
      onCancel: () => {
        // Close tab completely
        const ref = state.activeTabReferences.find((r) => r.id === referenceId);
        if (ref) {
          setState((prev) => ({
            ...prev,
            activeTabReferences: prev.activeTabReferences.filter((r) => r.id !== referenceId),
            groups: prev.groups.map((g) =>
              g.id === ref.originalGroupId
                ? { ...g, tabs: g.tabs.filter((t) => t.id !== ref.originalTabId) }
                : g
            ),
          }));
        }
        setConfirmDialog(null);
      },
    });
  };

  const handleRenameActiveTab = (referenceId: string) => {
    const ref = state.activeTabReferences.find((r) => r.id === referenceId);
    if (!ref) return;

    const originalTab = state.groups
      .find((g) => g.id === ref.originalGroupId)
      ?.tabs.find((t) => t.id === ref.originalTabId);

    if (!originalTab) return;

    setRenameDialog({
      referenceId,
      currentName: ref.customName || originalTab.title,
    });
    setContextMenu(null);
  };

  const handleRenameSubmit = (newName: string) => {
    if (!renameDialog) return;
    setState((prev) => ({
      ...prev,
      activeTabReferences: prev.activeTabReferences.map((r) =>
        r.id === renameDialog.referenceId ? { ...r, customName: newName } : r
      ),
    }));
    setRenameDialog(null);
  };

  const handleActiveTabContextMenu = (referenceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const ref = state.activeTabReferences.find((r) => r.id === referenceId);
    if (!ref) return;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId: ref.originalTabId,
      groupId: ref.originalGroupId,
      isReference: true,
    });
  };

  const handleActiveTabActivate = (referenceId: string) => {
    const ref = state.activeTabReferences.find((r) => r.id === referenceId);
    if (!ref) return;
    handleTabActivate(ref.originalGroupId, ref.originalTabId);
  };

  // Build active tabs group data for rendering
  const activeTabsGroup: TabGroupData = {
    id: 'active-tabs',
    label: '⭐ Active',
    color: '#fbbc04',
    collapsed: false,
    tabs: state.activeTabReferences.map((ref) => {
      const originalGroup = state.groups.find((g) => g.id === ref.originalGroupId);
      const originalTab = originalGroup?.tabs.find((t) => t.id === ref.originalTabId);
      return {
        ...originalTab!,
        id: ref.id,
        customName: ref.customName,
      };
    }),
  };

  return (
    <div
      style={{
        backgroundColor: darkMode ? '#202124' : '#dee1e6',
        padding: '8px',
        minHeight: '50px',
      }}
    >
      {/* Main horizontal tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {state.groups.map((group) =>
          group.collapsed ? (
            <CollapsedGroup
              key={group.id}
              group={group}
              onExpand={() => handleToggleCollapse(group.id)}
            />
          ) : (
            <ExpandedGroup
              key={group.id}
              group={group}
              activeTabId={activeTab?.id || null}
              onCollapse={() => handleToggleCollapse(group.id)}
              onTabActivate={(tabId) => handleTabActivate(group.id, tabId)}
              onTabClose={(tabId) => handleTabClose(group.id, tabId)}
              onTabContextMenu={(tabId, e) => handleTabContextMenu(group.id, tabId, e)}
            />
          )
        )}

        {/* Divider */}
        {state.groups.length > 0 && state.activeTabReferences.length > 0 && (
          <div
            style={{
              width: '1px',
              height: '30px',
              backgroundColor: darkMode ? '#5f6368' : '#9ca1a7',
            }}
          />
        )}

        {/* Active Tabs Group */}
        {state.activeTabReferences.length > 0 && (
          <ExpandedGroup
            group={activeTabsGroup}
            activeTabId={activeTab?.id || null}
            onCollapse={() => {}} // Active tabs group doesn't collapse
            onTabActivate={(refId) => handleActiveTabActivate(refId)}
            onTabClose={(refId) => handleActiveTabClose(refId)}
            onTabContextMenu={(refId, e) => handleActiveTabContextMenu(refId, e)}
          />
        )}
      </div>

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
          onClick={() => setContextMenu(null)}
        >
          {!contextMenu.isReference && (
            <div
              onClick={() => handleAddToActiveTabs(contextMenu.groupId, contextMenu.tabId)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Add to Active Tabs
            </div>
          )}
          {contextMenu.isReference && (
            <>
              <div
                onClick={() => handleRevealInMainTabs(contextMenu.groupId, contextMenu.tabId)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Reveal in Main Tabs
              </div>
              <div
                onClick={() =>
                  handleRenameActiveTab(
                    state.activeTabReferences.find(
                      (r) =>
                        r.originalTabId === contextMenu.tabId &&
                        r.originalGroupId === contextMenu.groupId
                    )?.id || ''
                  )
                }
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Rename
              </div>
            </>
          )}
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
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              maxWidth: '400px',
            }}
          >
            <div style={{ marginBottom: '16px', fontSize: '14px' }}>{confirmDialog.message}</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={confirmDialog.onConfirm}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4285f4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Remove from Active Tabs
              </button>
              <button
                onClick={confirmDialog.onCancel}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ea4335',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Close Tab Completely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {renameDialog && (
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
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              maxWidth: '400px',
            }}
          >
            <div style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 500 }}>
              Rename Active Tab
            </div>
            <input
              type="text"
              defaultValue={renameDialog.currentName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenameSubmit(e.currentTarget.value);
                } else if (e.key === 'Escape') {
                  setRenameDialog(null);
                }
              }}
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '13px',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRenameDialog(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
                  handleRenameSubmit(input.value);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4285f4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
