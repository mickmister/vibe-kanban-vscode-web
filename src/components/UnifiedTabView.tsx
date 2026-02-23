import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { ChromeTabs } from '../../react-chrome-tabs/src/ChromeTabs';
import type { TabProperties } from '../../react-chrome-tabs/src/chrome-tabs';
import { AddressBar } from './AddressBar';
import { IframePanel } from './IframePanel';
import type { TabGroup } from '../types';
import type { WorkspaceActions, SessionActions } from './WorkspaceShell';

interface UnifiedTabViewProps {
  tabGroups: TabGroup[];
  activeTabGroupId: string;
  actions: WorkspaceActions;
  sessionActions: SessionActions;
  onOpenAddTabModal: (tabGroupId: string) => void;
}

/**
 * Unified tab view with auto-hiding top bar:
 * - Address bar at the very top
 * - Chrome tabs below address bar
 * - Auto-hide on mouse leave, show on hover at top of page
 * - Pin toggle to keep bar visible
 * - Content adjusts position based on pinned state
 */
export function UnifiedTabView({
  tabGroups,
  activeTabGroupId,
  actions,
  sessionActions,
  onOpenAddTabModal,
}: UnifiedTabViewProps) {
  const [isPinned, setIsPinned] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const topBarRef = useRef<HTMLDivElement>(null);
  const hoverTriggerRef = useRef<HTMLDivElement>(null);

  const isVisible = isPinned || isHovering;

  // Build visual tabs: group labels + tabs from expanded groups
  const visualTabs = useMemo(() => {
    const result: (TabProperties & {
      isGroupLabel?: boolean;
      groupId?: string;
      tabCount?: number;
      isPair?: boolean;
      pairId?: string;
    })[] = [];

    tabGroups.forEach((group) => {
      const tabCount = group.tabs.length;
      const pairCount = group.pairs.length;

      // Add group label as a special "tab" with count badge
      result.push({
        id: `group-label-${group.id}`,
        title: group.label,
        active: false,
        isGroupLabel: true,
        groupId: group.id,
        tabCount: tabCount + pairCount,
        isCloseIconVisible: false,
        favicon: false,
      });

      // Add individual tabs
      group.tabs.forEach((tab) => {
        result.push({
          id: tab.id,
          title: tab.title,
          active: group.activeItemId === tab.id && group.id === activeTabGroupId,
          favicon: false,
          isCloseIconVisible: !tab.pinned,
        });
      });

      // Add pair tabs with special styling
      group.pairs.forEach((pair) => {
        const tabNames = pair.tabIds
          .map((id) => group.tabs.find((t) => t.id === id)?.title)
          .filter(Boolean)
          .join(' | ');

        result.push({
          id: pair.id,
          title: `⊞ ${tabNames}`,
          active: group.activeItemId === pair.id && group.id === activeTabGroupId,
          favicon: false,
          isCloseIconVisible: true,
          isPair: true,
          pairId: pair.id,
        });
      });
    });

    return result;
  }, [tabGroups, activeTabGroupId]);

  const handleTabActive = (tabId: string) => {
    // Check if it's a group label
    if (tabId.startsWith('group-label-')) {
      const groupId = tabId.replace('group-label-', '');
      sessionActions.setActiveTabGroup(groupId);
      return;
    }

    // Find which group this tab belongs to
    for (const group of tabGroups) {
      // Check if it's a regular tab
      if (group.tabs.some((t) => t.id === tabId)) {
        sessionActions.selectTab(group.id, tabId);
        return;
      }

      // Check if it's a pair
      if (group.pairs.some((p) => p.id === tabId)) {
        sessionActions.selectPair(group.id, tabId);
        return;
      }
    }
  };

  const handleTabClose = (tabId: string) => {
    // Ignore if it's a group label
    if (tabId.startsWith('group-label-')) return;

    // Find which group this tab belongs to
    for (const group of tabGroups) {
      // Check if it's a regular tab
      const tab = group.tabs.find((t) => t.id === tabId);
      if (tab && !tab.pinned) {
        actions.closeTab({ tabGroupId: group.id, tabId });
        return;
      }

      // Pairs can be closed by closing one of their tabs
      // For now, just ignore pair close buttons
    }
  };

  const handleContextMenu = (tabId: string, event: MouseEvent) => {
    event.preventDefault();
    // TODO: Implement context menu for creating pairs, etc.
  };

  const activeTabGroup = tabGroups.find((tg) => tg.id === activeTabGroupId);

  // Calculate top bar height for content offset when pinned
  const topBarHeight = topBarRef.current?.offsetHeight || 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Invisible hover trigger at top of viewport */}
      <div
        ref={hoverTriggerRef}
        className="absolute top-0 left-0 right-0 h-2 z-40"
        onMouseEnter={() => setIsHovering(true)}
      />

      {/* Auto-hiding top bar container */}
      <div
        ref={topBarRef}
        className={`absolute top-0 left-0 right-0 z-50 transition-transform duration-200 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Address bar at the very top */}
        {activeTabGroup && <AddressBar tabGroup={activeTabGroup} />}

        {/* Chrome tabs below address bar */}
        <div className="bg-neutral-900 border-b border-neutral-800">
          <ChromeTabs
            tabs={visualTabs}
            darkMode={true}
            onTabActive={handleTabActive}
            onTabClose={handleTabClose}
            onContextMenu={handleContextMenu}
            draggable={true}
            pinnedRight={
              <button
                onClick={() => onOpenAddTabModal(activeTabGroupId)}
                className="bg-transparent hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 px-3 py-1 rounded transition-colors text-lg font-light"
                title="Add new tab"
              >
                +
              </button>
            }
          />
        </div>

        {/* Pin toggle button */}
        <button
          onClick={() => setIsPinned(!isPinned)}
          className="absolute bottom-2 right-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded text-xs transition-colors"
          title={isPinned ? 'Unpin top bar' : 'Pin top bar'}
        >
          {isPinned ? '📌' : '📍'}
        </button>
      </div>

      {/* Content area - adjusts top padding based on pinned state */}
      <div
        className="flex-1 min-h-0 transition-all duration-200"
        style={{
          paddingTop: isPinned ? `${topBarHeight}px` : '0px',
        }}
      >
        {activeTabGroup ? (
          <IframePanel
            tabGroup={activeTabGroup}
            onUpdatePairRatios={(pairId, ratios) =>
              actions.updatePairRatios({
                tabGroupId: activeTabGroup.id,
                pairId,
                ratios,
              })
            }
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            <p>No tab group selected</p>
          </div>
        )}
      </div>
    </div>
  );
}
