import { useState, useEffect } from 'react';
import type { WorkspaceState } from './types';

/**
 * Session-level workspace navigation state.
 * These are stored per browser window/tab in sessionStorage,
 * allowing multiple windows to view different spaces/tabs independently.
 */
export interface SessionWorkspaceNav {
  activeSpaceId: string;
  activeTabGroupId: string;
  // Map of tabGroupId -> activeItemId (tab or pair ID)
  activeItems: Record<string, string>;
}

const SESSION_KEY = 'workspace-nav';

/**
 * Load session navigation state from sessionStorage.
 * Falls back to first available space/tab group if stored values are invalid.
 */
function loadSessionNav(workspace: WorkspaceState): SessionWorkspaceNav {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as SessionWorkspaceNav;

      // Validate that the stored IDs still exist in the workspace
      const spaceExists = workspace.spaces.some(s => s.id === parsed.activeSpaceId);
      const tabGroupExists = workspace.tabGroups.some(tg => tg.id === parsed.activeTabGroupId);

      if (spaceExists && tabGroupExists) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Fallback to first space/tab group
  const firstSpace = workspace.spaces[0];
  const firstTabGroup = firstSpace ? workspace.tabGroups.find(tg =>
    firstSpace.tabGroupIds.includes(tg.id)
  ) : workspace.tabGroups[0];

  // Build initial activeItems map from workspace state
  const activeItems: Record<string, string> = {};
  workspace.tabGroups.forEach(tg => {
    // Use first tab or pair as default
    const firstItem = tg.tabs[0]?.id || tg.pairs[0]?.id || '';
    activeItems[tg.id] = firstItem;
  });

  return {
    activeSpaceId: firstSpace?.id || '',
    activeTabGroupId: firstTabGroup?.id || '',
    activeItems,
  };
}

/**
 * Save session navigation state to sessionStorage.
 */
function saveSessionNav(nav: SessionWorkspaceNav) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(nav));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Hook for managing per-window workspace navigation state.
 * Returns current active IDs and setters that persist to sessionStorage.
 */
export function useSessionWorkspaceNav(workspace: WorkspaceState) {
  const [nav, setNav] = useState<SessionWorkspaceNav>(() => loadSessionNav(workspace));

  // Sync to sessionStorage whenever nav changes
  useEffect(() => {
    saveSessionNav(nav);
  }, [nav]);

  // Validate nav whenever workspace changes (e.g., space/tab group deleted)
  useEffect(() => {
    const spaceExists = workspace.spaces.some(s => s.id === nav.activeSpaceId);
    const tabGroupExists = workspace.tabGroups.some(tg => tg.id === nav.activeTabGroupId);

    if (!spaceExists || !tabGroupExists) {
      // Current selection is invalid, reset to valid defaults
      const newNav = loadSessionNav(workspace);
      setNav(newNav);
    }
  }, [workspace.spaces, workspace.tabGroups, nav.activeSpaceId, nav.activeTabGroupId]);

  const selectSpace = (spaceId: string) => {
    const space = workspace.spaces.find(s => s.id === spaceId);
    if (!space) return;

    // When switching spaces, activate the first tab group in that space
    const firstTabGroupId = space.tabGroupIds[0];
    if (firstTabGroupId) {
      setNav({ activeSpaceId: spaceId, activeTabGroupId: firstTabGroupId });
    }
  };

  const selectTab = (tabGroupId: string, tabId: string) => {
    setNav(prev => ({
      ...prev,
      activeTabGroupId: tabGroupId,
      activeItems: { ...prev.activeItems, [tabGroupId]: tabId },
    }));
  };

  const selectPair = (tabGroupId: string, pairId: string) => {
    setNav(prev => ({
      ...prev,
      activeTabGroupId: tabGroupId,
      activeItems: { ...prev.activeItems, [tabGroupId]: pairId },
    }));
  };

  const setActiveTabGroup = (tabGroupId: string) => {
    setNav(prev => ({ ...prev, activeTabGroupId: tabGroupId }));
  };

  const getActiveItem = (tabGroupId: string): string => {
    return nav.activeItems[tabGroupId] || '';
  };

  return {
    activeSpaceId: nav.activeSpaceId,
    activeTabGroupId: nav.activeTabGroupId,
    activeItems: nav.activeItems,
    getActiveItem,
    selectSpace,
    selectTab,
    selectPair,
    setActiveTabGroup,
  };
}
