import React from 'react';
import { ChromeTabBar } from './ChromeTabBar';
import { IframePanel } from './IframePanel';
import type { TabGroup } from '../types';

interface TabGroupPanelProps {
  tabGroup: TabGroup;
  isActive: boolean;
  onSetActive: () => void;
  onSelectTab: (tabId: string) => void;
  onSelectPair: (pairId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddTab: () => void;
  onCreatePair: (tabIds: string[]) => void;
  onUpdatePairRatios: (pairId: string, ratios: number[]) => void;
  onDragStart: (e: React.DragEvent, tabGroupId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetGroupId: string) => void;
}

export function TabGroupPanel({
  tabGroup,
  isActive,
  onSetActive,
  onSelectTab,
  onSelectPair,
  onCloseTab,
  onAddTab,
  onCreatePair,
  onUpdatePairRatios,
  onDragStart,
  onDragOver,
  onDrop,
}: TabGroupPanelProps) {
  return (
    <div
      className={`flex flex-col min-h-0 flex-1 ${
        isActive ? 'ring-1 ring-primary-500/30' : ''
      }`}
      onClick={onSetActive}
    >
      <ChromeTabBar
        tabGroup={tabGroup}
        onSelectTab={onSelectTab}
        onSelectPair={onSelectPair}
        onCloseTab={onCloseTab}
        onAddTab={onAddTab}
        onCreatePair={onCreatePair}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />
      <IframePanel
        tabGroup={tabGroup}
        onUpdatePairRatios={onUpdatePairRatios}
      />
    </div>
  );
}
