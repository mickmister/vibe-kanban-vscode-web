import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { TabGroup, Tab } from '../types';

interface IframePanelProps {
  tabGroup: TabGroup;
  onUpdatePairRatios: (pairId: string, ratios: number[]) => void;
}

/**
 * Module-level iframe store that persists across HMR updates.
 * Iframe DOM elements are managed imperatively so React re-renders
 * (including HMR fast refresh) never recreate them.
 */
type IframeEntry = {
  iframe: HTMLIFrameElement;
  container: HTMLDivElement;
  loaded: boolean;
};

let iframeStore: Map<string, IframeEntry> = new Map();

// Preserve iframe store across HMR updates using Vite's HMR API.
// We use indirect eval to avoid TS1343 since tsconfig uses module: commonjs.
// Vite transforms this at build time; tsc never executes it.
try {
  // @ts-expect-error -- import.meta.hot is Vite-specific, not available under module: commonjs
  const hot = import.meta.hot;
  if (hot) {
    if (hot.data.iframeStore) {
      iframeStore = hot.data.iframeStore;
    }
    hot.dispose((data: Record<string, unknown>) => {
      data.iframeStore = iframeStore;
    });
  }
} catch {
  // Not in Vite dev mode (e.g., production build)
}

function getOrCreateIframe(tab: Tab, onLoad: (tabId: string) => void): IframeEntry {
  const existing = iframeStore.get(tab.id);
  if (existing) return existing;

  const container = document.createElement('div');
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.position = 'absolute';
  container.style.inset = '0';

  const iframe = document.createElement('iframe');
  iframe.src = tab.url;
  iframe.title = tab.title;
  iframe.className = 'w-full h-full border-0';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
  iframe.setAttribute('role', 'region');

  const entry: IframeEntry = { iframe, container, loaded: false };

  iframe.addEventListener('load', () => {
    entry.loaded = true;
    onLoad(tab.id);
  });

  container.appendChild(iframe);
  iframeStore.set(tab.id, entry);

  return entry;
}

function removeIframe(tabId: string) {
  const entry = iframeStore.get(tabId);
  if (entry) {
    entry.container.remove();
    iframeStore.delete(tabId);
  }
}

/**
 * Hook that imperatively manages iframe DOM elements.
 * Iframes are created via direct DOM manipulation and stored
 * in a module-level Map, making them immune to React re-renders and HMR.
 */
function useImperativeIframes(tabs: Tab[]) {
  const [loadingState, setLoadingState] = useState<Map<string, boolean>>(() => {
    // Initialize from existing store (survives HMR)
    const initial = new Map<string, boolean>();
    for (const tab of tabs) {
      const entry = iframeStore.get(tab.id);
      initial.set(tab.id, entry?.loaded ?? false);
    }
    return initial;
  });

  const handleLoad = useCallback((tabId: string) => {
    setLoadingState((prev) => {
      const next = new Map(prev);
      next.set(tabId, true);
      return next;
    });
  }, []);

  useEffect(() => {
    const currentTabIds = new Set(tabs.map((t) => t.id));

    // Remove iframes for tabs that no longer exist
    for (const [id] of iframeStore.entries()) {
      if (!currentTabIds.has(id)) {
        removeIframe(id);
      }
    }

    // Ensure iframes exist for all current tabs
    for (const tab of tabs) {
      getOrCreateIframe(tab, handleLoad);
    }

    // Sync loading state
    setLoadingState((prev) => {
      const next = new Map<string, boolean>();
      for (const tab of tabs) {
        const entry = iframeStore.get(tab.id);
        next.set(tab.id, entry?.loaded ?? prev.get(tab.id) ?? false);
      }
      return next;
    });
  }, [tabs, handleLoad]);

  return { loadingState, handleLoad };
}

/**
 * A container div that imperatively hosts an iframe DOM element.
 * The iframe is appended via useEffect, not rendered by React,
 * so it survives HMR and re-renders.
 */
function IframeHost({ tabId, visible }: { tabId: string; visible: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const entry = iframeStore.get(tabId);
    if (!host || !entry) return;

    // Append the iframe's container to this host element
    host.appendChild(entry.container);

    return () => {
      // On cleanup, move the container to a hidden offscreen holder
      // so it's not destroyed when React unmounts this component
      if (entry.container.parentElement === host) {
        host.removeChild(entry.container);
      }
    };
  }, [tabId]);

  // Control visibility without unmounting
  return (
    <div
      ref={hostRef}
      className="w-full h-full relative"
      style={{ display: visible ? 'block' : 'none' }}
    />
  );
}

export function IframePanel({ tabGroup, onUpdatePairRatios }: IframePanelProps) {
  const { loadingState } = useImperativeIframes(tabGroup.tabs);

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
      {/* Hidden hosts for non-visible iframes — keeps them alive in the DOM */}
      {tabGroup.tabs.map((tab) => {
        if (visibleTabIds.has(tab.id)) return null;
        return <IframeHost key={tab.id} tabId={tab.id} visible={false} />;
      })}

      {/* Visible tab(s) */}
      {activePair ? (
        <PairView
          activePair={activePair}
          tabGroup={tabGroup}
          loadingState={loadingState}
          onUpdatePairRatios={onUpdatePairRatios}
        />
      ) : activeTab ? (
        <SingleTabView activeTab={activeTab} loadingState={loadingState} />
      ) : (
        <EmptyView />
      )}
    </>
  );
}

function SingleTabView({
  activeTab,
  loadingState,
}: {
  activeTab: Tab;
  loadingState: Map<string, boolean>;
}) {
  const isLoaded = loadingState.get(activeTab.id) ?? false;

  return (
    <div className="flex-1 min-h-0 relative">
      <IframeHost tabId={activeTab.id} visible={true} />
      {!isLoaded && <LoadingOverlay />}
    </div>
  );
}

function PairView({
  activePair,
  tabGroup,
  loadingState,
  onUpdatePairRatios,
}: {
  activePair: { id: string; tabIds: string[]; ratios: number[] };
  tabGroup: TabGroup;
  loadingState: Map<string, boolean>;
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
        const isLoaded = loadingState.get(tab.id) ?? false;

        return (
          <React.Fragment key={tab.id}>
            <Panel id={tab.id} defaultSize={percentages[i]} minSize={10}>
              <div className="relative w-full h-full">
                <IframeHost tabId={tab.id} visible={true} />
                {!isLoaded && <LoadingOverlay />}
              </div>
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

function EmptyView() {
  return (
    <div className="flex-1 flex items-center justify-center text-neutral-500">
      <p>No tab selected. Click + to add a tab.</p>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-neutral-950 flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        <p className="text-neutral-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}
