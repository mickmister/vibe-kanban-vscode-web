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

/**
 * IframeView - Renders iframe content in a portal
 * The portal allows the iframe to be "moved" without reloading
 */
function IframeView({ tab, portalNode }: { tab: Tab; portalNode: ReturnType<typeof createHtmlPortalNode> }) {
  return (
    <>
      {/* InPortal renders the iframe content once */}
      <InPortal node={portalNode}>
        <iframe
          src={tab.url}
          title={tab.title}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          allow="clipboard-read; clipboard-write; fullscreen"
          role="region"
        />
      </InPortal>
      {/* OutPortal "moves" the iframe to this location */}
      <OutPortal node={portalNode} />
    </>
  );
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

  if (activePair) {
    const pairTabs = activePair.tabIds
      .map((id) => tabGroup.tabs.find((t) => t.id === id))
      .filter((t): t is Tab => t != null);

    // ratios are already percentages in our data model
    const percentages = activePair.ratios;

    // Handle layout changes from the Group component
    const handleLayoutChange = (layout: { [id: string]: number }) => {
      // Convert layout object back to array based on tab order
      const newRatios = pairTabs.map((tab) => layout[tab.id] || 0);
      onUpdatePairRatios(activePair.id, newRatios);
    };

    return (
      <>
        {/* Render all tab iframes off-screen with display:none when not active */}
        {tabGroup.tabs.map((tab) => {
          const portalNode = portals.get(tab.id);
          if (!portalNode) return null;
          const isVisible = pairTabs.some((t) => t.id === tab.id);

          return (
            <div
              key={tab.id}
              style={{ display: isVisible ? 'none' : 'none' }}
            >
              <InPortal node={portalNode}>
                <iframe
                  src={tab.url}
                  title={tab.title}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                  allow="clipboard-read; clipboard-write; fullscreen"
                  role="region"
                />
              </InPortal>
            </div>
          );
        })}

        {/* Display active pair tabs */}
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
      </>
    );
  }

  if (activeTab) {
    const portalNode = portals.get(activeTab.id);

    return (
      <>
        {/* Render all tab iframes off-screen with display:none when not active */}
        {tabGroup.tabs.map((tab) => {
          const node = portals.get(tab.id);
          if (!node) return null;
          const isVisible = tab.id === activeTab.id;

          return (
            <div
              key={tab.id}
              style={{ display: isVisible ? 'none' : 'none' }}
            >
              <InPortal node={node}>
                <iframe
                  src={tab.url}
                  title={tab.title}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                  allow="clipboard-read; clipboard-write; fullscreen"
                  role="region"
                />
              </InPortal>
            </div>
          );
        })}

        {/* Display active tab */}
        <div className="flex-1 min-h-0">
          {portalNode && <OutPortal node={portalNode} />}
        </div>
      </>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center text-neutral-500">
      <p>No tab selected. Click + to add a tab.</p>
    </div>
  );
}
