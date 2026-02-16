import React, { useRef, useCallback } from 'react';
import { Button } from '@heroui/react';
import type { TabGroup, Tab, TabPair } from '../types';

interface TabBarProps {
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

export function TabBar({
  tabGroup,
  onSelectTab,
  onSelectPair,
  onCloseTab,
  onAddTab,
  onCreatePair,
  onDragStart,
  onDragOver,
  onDrop,
}: TabBarProps) {
  const dragTabRef = useRef<string | null>(null);

  const isTabActive = (tabId: string) => tabGroup.activeItemId === tabId;

  const isPairActive = (pairId: string) => tabGroup.activeItemId === pairId;

  const isTabInActivePair = (tabId: string) => {
    const activePair = tabGroup.pairs.find(
      (p) => p.id === tabGroup.activeItemId
    );
    return activePair?.tabIds.includes(tabId) ?? false;
  };

  const handleTabDragStart = (e: React.DragEvent, tabId: string) => {
    dragTabRef.current = tabId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  };

  const handleTabDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    const sourceTabId = dragTabRef.current;
    if (sourceTabId && sourceTabId !== targetTabId) {
      onCreatePair([sourceTabId, targetTabId]);
    }
    dragTabRef.current = null;
  };

  return (
    <div
      className="flex items-center bg-neutral-900 border-b border-neutral-800 h-9 min-h-9"
      draggable
      onDragStart={(e) => onDragStart?.(e, tabGroup.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={(e) => onDrop?.(e, tabGroup.id)}
    >
      {/* Tab group label / drag handle */}
      <div className="px-2 text-[10px] uppercase tracking-wider text-neutral-500 cursor-grab select-none border-r border-neutral-800 h-full flex items-center">
        ⠿ {tabGroup.label}
      </div>

      {/* Tabs */}
      <div className="flex items-center flex-1 overflow-x-auto">
        {tabGroup.tabs.map((tab: Tab) => {
          const active = isTabActive(tab.id);
          const inPair = isTabInActivePair(tab.id);

          return (
            <div
              key={tab.id}
              className={`group flex items-center gap-1 px-3 h-full cursor-pointer border-r border-neutral-800 transition-colors text-xs select-none ${
                active
                  ? 'bg-neutral-800 text-white'
                  : inPair
                  ? 'bg-neutral-850 text-neutral-300'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                handleTabDragStart(e, tab.id);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.stopPropagation();
                handleTabDrop(e, tab.id);
              }}
              onClick={() => onSelectTab(tab.id)}
            >
              <span className="truncate max-w-32">{tab.title}</span>
              {!tab.pinned && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 ml-1 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {/* Pair indicators */}
        {tabGroup.pairs.map((pair: TabPair) => {
          const active = isPairActive(pair.id);
          const tabNames = pair.tabIds
            .map((id) => tabGroup.tabs.find((t) => t.id === id)?.title)
            .filter(Boolean)
            .join(' | ');

          return (
            <div
              key={pair.id}
              className={`flex items-center gap-1 px-3 h-full cursor-pointer border-r border-neutral-800 transition-colors text-xs select-none ${
                active
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
              }`}
              onClick={() => onSelectPair(pair.id)}
            >
              <span className="text-[10px]">⊞</span>
              <span className="truncate max-w-40">{tabNames}</span>
            </div>
          );
        })}
      </div>

      {/* Add tab button */}
      <Button
        size="sm"
        isIconOnly
        variant="light"
        className="min-w-7 h-7 text-neutral-400"
        onPress={onAddTab}
      >
        +
      </Button>
    </div>
  );
}
