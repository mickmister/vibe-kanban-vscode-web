import React, { useRef, useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import type { TabGroup, Tab } from '../types';

interface IframePanelProps {
  tabGroup: TabGroup;
  onUpdatePairRatios: (pairId: string, ratios: number[]) => void;
}

/**
 * Hook to manage iframe portal nodes for tabs
 * Portals persist across re-renders, keeping iframes alive even when hidden
 */
function useIframePortals(tabs: Tab[]) {
  const portalsRef = useRef<Map<string, ReturnType<typeof createHtmlPortalNode>>>(new Map());

  useEffect(() => {
    const currentPortals = portalsRef.current;
    const currentTabIds = new Set(tabs.map((tab) => tab.id));

    // Remove portals for tabs that no longer exist
    for (const [id] of currentPortals.entries()) {
      if (!currentTabIds.has(id)) {
        currentPortals.delete(id);
      }
    }

    // Create new portals for new tabs
    for (const tab of tabs) {
      if (!currentPortals.has(tab.id)) {
        currentPortals.set(tab.id, createHtmlPortalNode());
      }
    }
  }, [tabs]);

  return portalsRef.current;
}

export function IframePanel({ tabGroup, onUpdatePairRatios }: IframePanelProps) {
  // Create and maintain portal nodes for all tabs
  // This ensures iframes stay alive even when hidden
  const portals = useIframePortals(tabGroup.tabs);

  const activeTab = tabGroup.tabs.find(
    (t) => t.id === tabGroup.activeItemId
  );
  const activePair = tabGroup.pairs.find(
    (p) => p.id === tabGroup.activeItemId
  );

  // Get IDs of currently visible tabs
  const visibleTabIds = new Set<string>();
  if (activePair) {
    activePair.tabIds.forEach((id) => visibleTabIds.add(id));
  } else if (activeTab) {
    visibleTabIds.add(activeTab.id);
  }

  return (
    <>
      {/*
        Step 1: Render all iframe contents in InPortals
        These iframes are created once and stay in memory
      */}
      {tabGroup.tabs.map((tab) => {
        const portalNode = portals.get(tab.id);
        if (!portalNode) return null;

        return (
          <InPortal key={tab.id} node={portalNode}>
            <iframe
              src={tab.url}
              title={tab.title}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              allow="clipboard-read; clipboard-write; fullscreen"
              role="region"
            />
          </InPortal>
        );
      })}

      {/*
        Step 2: Render hidden OutPortals for non-visible tabs
        Using display:none keeps iframes running in background
      */}
      {tabGroup.tabs.map((tab) => {
        const portalNode = portals.get(tab.id);
        if (!portalNode || visibleTabIds.has(tab.id)) return null;

        return (
          <div key={`hidden-${tab.id}`} style={{ display: 'none' }}>
            <OutPortal node={portalNode} />
          </div>
        );
      })}

      {/*
        Step 3: Render visible tab(s) - either single tab or split pair
      */}
      {activePair ? (
        <PairView
          activePair={activePair}
          tabGroup={tabGroup}
          portals={portals}
          onUpdatePairRatios={onUpdatePairRatios}
        />
      ) : activeTab ? (
        <SingleTabView activeTab={activeTab} portals={portals} />
      ) : (
        <EmptyView />
      )}
    </>
  );
}

/**
 * Renders a single active tab
 */
function SingleTabView({
  activeTab,
  portals,
}: {
  activeTab: Tab;
  portals: Map<string, ReturnType<typeof createHtmlPortalNode>>;
}) {
  const portalNode = portals.get(activeTab.id);

  return (
    <div className="flex-1 min-h-0">
      {portalNode && <OutPortal node={portalNode} />}
    </div>
  );
}

/**
 * Renders a split pair of tabs
 */
function PairView({
  activePair,
  tabGroup,
  portals,
  onUpdatePairRatios,
}: {
  activePair: { id: string; tabIds: string[]; ratios: number[] };
  tabGroup: TabGroup;
  portals: Map<string, ReturnType<typeof createHtmlPortalNode>>;
  onUpdatePairRatios: (pairId: string, ratios: number[]) => void;
}) {
  const pairTabs = activePair.tabIds
    .map((id) => tabGroup.tabs.find((t) => t.id === id))
    .filter((t): t is Tab => t != null);

  const percentages = activePair.ratios;

  const handleLayoutChange = (layout: { [id: string]: number }) => {
    const newRatios = pairTabs.map((tab) => layout[tab.id] || 0);
    onUpdatePairRatios(activePair.id, newRatios);
  };

  return (
    <Group
      orientation="horizontal"
      className="flex-1 min-h-0"
      onLayoutChanged={handleLayoutChange}
    >
      {pairTabs.map((tab, i) => {
        const portalNode = portals.get(tab.id);
        if (!portalNode) return null;

        return (
          <React.Fragment key={tab.id}>
            <Panel id={tab.id} defaultSize={percentages[i]} minSize={10}>
              <OutPortal node={portalNode} />
            </Panel>
            {i < pairTabs.length - 1 && (
              <Separator className="w-1 bg-neutral-700 hover:bg-neutral-500 data-[resize-handle-state=drag]:bg-primary-500 transition-colors cursor-col-resize flex-shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </Group>
  );
}

/**
 * Renders empty state when no tab is selected
 */
function EmptyView() {
  return (
    <div className="flex-1 flex items-center justify-center text-neutral-500">
      <p>No tab selected. Click + to add a tab.</p>
    </div>
  );
}
