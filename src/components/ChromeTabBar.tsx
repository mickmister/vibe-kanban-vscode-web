import React, { useMemo } from 'react';
import { ChromeTabs } from '../../react-chrome-tabs/src/ChromeTabs';
import type { TabProperties } from '../../react-chrome-tabs/src/chrome-tabs';
import type { TabGroup, Tab, TabPair } from '../types';

interface ChromeTabBarProps {
  tabGroup: TabGroup;
  onSelectTab: (tabId: string) => void;
  onSelectPair: (pairId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddTab: () => void;
  onCreatePair: (tabIds: string[]) => void;
  /** Drag-and-drop handlers for reordering tab groups */
  onDragStart?: (e: React.DragEvent, tabGroupId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, tabGroupId: string) => void;
}

export function ChromeTabBar({
  tabGroup,
  onSelectTab,
  onSelectPair,
  onCloseTab,
  onAddTab,
  onCreatePair,
  onDragStart,
  onDragOver,
  onDrop,
}: ChromeTabBarProps) {
  // Convert tabs and pairs to ChromeTabs format
  const chromeTabs = useMemo(() => {
    const tabs: TabProperties[] = [];

    // Add individual tabs
    tabGroup.tabs.forEach((tab: Tab) => {
      tabs.push({
        id: tab.id,
        title: tab.title,
        active: tabGroup.activeItemId === tab.id,
        favicon: false,
      });
    });

    // Add pair tabs with special styling
    tabGroup.pairs.forEach((pair: TabPair) => {
      const tabNames = pair.tabIds
        .map((id) => tabGroup.tabs.find((t) => t.id === id)?.title)
        .filter(Boolean)
        .join(' | ');

      tabs.push({
        id: pair.id,
        title: `⊞ ${tabNames}`,
        active: tabGroup.activeItemId === pair.id,
        favicon: false,
      });
    });

    return tabs;
  }, [tabGroup.tabs, tabGroup.pairs, tabGroup.activeItemId]);

  const handleTabActive = (tabId: string) => {
    // Check if it's a pair
    const isPair = tabGroup.pairs.some((p) => p.id === tabId);
    if (isPair) {
      onSelectPair(tabId);
    } else {
      onSelectTab(tabId);
    }
  };

  const handleTabClose = (tabId: string) => {
    // Don't close pairs from the X button
    const isPair = tabGroup.pairs.some((p) => p.id === tabId);
    if (!isPair) {
      const tab = tabGroup.tabs.find((t) => t.id === tabId);
      if (!tab?.pinned) {
        onCloseTab(tabId);
      }
    }
  };

  const handleContextMenu = (tabId: string, event: MouseEvent) => {
    event.preventDefault();
    // TODO: Implement context menu for creating pairs, etc.
  };

  return (
    <div
      className="bg-neutral-900 border-b border-neutral-800"
      draggable
      onDragStart={(e) => onDragStart?.(e, tabGroup.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={(e) => onDrop?.(e, tabGroup.id)}
    >
      {/* Tab group label */}
      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-500 cursor-grab select-none border-b border-neutral-800">
        ⠿ {tabGroup.label}
      </div>

      {/* Chrome tabs */}
      <ChromeTabs
        tabs={chromeTabs}
        darkMode={true}
        onTabActive={handleTabActive}
        onTabClose={handleTabClose}
        onContextMenu={handleContextMenu}
        draggable={true}
      />
    </div>
  );
}
