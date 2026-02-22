import React, { useMemo } from 'react';
import { ChromeTabs } from '../../react-chrome-tabs/src/ChromeTabs';
import type { TabProperties } from '../../react-chrome-tabs/src/chrome-tabs';
import { AddressBar } from './AddressBar';
import { IframePanel } from './IframePanel';
import type { TabGroup } from '../types';
import type { WorkspaceActions } from './WorkspaceShell';

interface UnifiedTabViewProps {
  tabGroups: TabGroup[];
  activeTabGroupId: string;
  actions: WorkspaceActions;
  onOpenAddTabModal: (tabGroupId: string) => void;
}

/**
 * Unified tab view following HorizontalTabGroupsV2 pattern:
 * - Single ChromeTabs instance with group labels as special tabs
 * - Single AddressBar showing active tab URL
 * - Single IframePanel showing active tab group content
 */
export function UnifiedTabView({
  tabGroups,
  activeTabGroupId,
  actions,
  onOpenAddTabModal,
}: UnifiedTabViewProps) {
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
      actions.setActiveTabGroup({ tabGroupId: groupId });
      return;
    }

    // Find which group this tab belongs to
    for (const group of tabGroups) {
      // Check if it's a regular tab
      if (group.tabs.some((t) => t.id === tabId)) {
        actions.selectTab({ tabGroupId: group.id, tabId });
        return;
      }

      // Check if it's a pair
      if (group.pairs.some((p) => p.id === tabId)) {
        actions.selectPair({ tabGroupId: group.id, pairId: tabId });
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Single Chrome tabs instance for all groups */}
      <div className="bg-neutral-900 border-b border-neutral-800">
        <ChromeTabs
          tabs={visualTabs}
          darkMode={true}
          onTabActive={handleTabActive}
          onTabClose={handleTabClose}
          onContextMenu={handleContextMenu}
          draggable={true}
        />
      </div>

      {/* Address bar showing active tab URL */}
      {activeTabGroup && <AddressBar tabGroup={activeTabGroup} />}

      {/* Content area showing active tab group's iframe panel */}
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
  );
}
