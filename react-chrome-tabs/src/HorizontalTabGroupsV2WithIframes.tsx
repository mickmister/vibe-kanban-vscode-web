import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import { ChromeTabs } from './ChromeTabs';
import type { TabProperties } from './chrome-tabs';

/**
 * HorizontalTabGroupsV2WithIframes - Complete implementation with iframe management
 *
 * Iframe Strategy with react-reverse-portal:
 * - Each tab gets a persistent portal node created once
 * - InPortal renders the iframe content once per tab
 * - OutPortal "moves" the iframe to visible/hidden containers
 * - Hidden tabs use display:none to keep content fresh
 * - No iframe reloads on tab switching
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TabGroupMetadata {
  id: string;
  label: string;
  color: string;
  collapsed: boolean;
}

export interface TabWithGroup extends TabProperties {
  groupId: string;
  customName?: string;
  loaded?: boolean;
  url?: string;
}

export interface HorizontalTabGroupsV2State {
  groups: TabGroupMetadata[];
  tabs: TabWithGroup[];
}

interface IframePortalNode {
  id: string;
  portalNode: ReturnType<typeof createHtmlPortalNode>;
}

// ============================================================================
// IFRAME PORTAL MANAGEMENT
// ============================================================================

/**
 * Hook to manage iframe portal nodes
 * Creates persistent portal nodes that survive re-renders
 */
function useIframePortals(tabs: TabWithGroup[]) {
  const portalsRef = useRef<Map<string, IframePortalNode>>(new Map());

  useEffect(() => {
    const currentPortals = portalsRef.current;
    const currentTabIds = new Set(tabs.map((tab) => tab.id));

    // Remove portals for deleted tabs
    for (const [id] of currentPortals.entries()) {
      if (!currentTabIds.has(id)) {
        currentPortals.delete(id);
      }
    }

    // Create portals for new tabs with URLs
    for (const tab of tabs) {
      if (tab.url && !currentPortals.has(tab.id)) {
        currentPortals.set(tab.id, {
          id: tab.id,
          portalNode: createHtmlPortalNode(),
        });
      }
    }
  }, [tabs]);

  return portalsRef.current;
}

/**
 * Component to render all iframe InPortals
 * These are rendered once and persist in memory
 */
function IframePortalContents({
  tabs,
  portals,
  onIframeLoad,
}: {
  tabs: TabWithGroup[];
  portals: Map<string, IframePortalNode>;
  onIframeLoad?: (tabId: string) => void;
}) {
  return (
    <>
      {tabs.map((tab) => {
        if (!tab.url) return null;
        const portal = portals.get(tab.id);
        if (!portal) return null;

        return (
          <InPortal key={tab.id} node={portal.portalNode}>
            <div className="w-full h-full relative">
              <iframe
                src={tab.url}
                title={tab.title}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                allow="clipboard-read; clipboard-write; fullscreen"
                onLoad={() => onIframeLoad?.(tab.id)}
              />
            </div>
          </InPortal>
        );
      })}
    </>
  );
}

/**
 * Component to render iframe content area
 * Shows active tab's iframe, hides others with display:none
 */
function IframeContentArea({
  tabs,
  portals,
  activeTabId,
}: {
  tabs: TabWithGroup[];
  portals: Map<string, IframePortalNode>;
  activeTabId: string | null;
}) {
  return (
    <div className="w-full h-full relative" style={{ minHeight: '500px' }}>
      {tabs.map((tab) => {
        if (!tab.url) return null;
        const portal = portals.get(tab.id);
        if (!portal) return null;

        const isActive = tab.id === activeTabId;

        return (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{ display: isActive ? 'block' : 'none' }}
          >
            <OutPortal node={portal.portalNode} />
          </div>
        );
      })}

      {!activeTabId && (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>No tab selected</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface HorizontalTabGroupsV2WithIframesProps {
  initialState?: HorizontalTabGroupsV2State;
  darkMode?: boolean;
  showIframeContent?: boolean;
}

export function HorizontalTabGroupsV2WithIframes({
  initialState,
  darkMode = false,
  showIframeContent = true,
}: HorizontalTabGroupsV2WithIframesProps) {
  const [state, setState] = useState<HorizontalTabGroupsV2State>(
    initialState || { groups: [], tabs: [] }
  );

  // Manage iframe portals
  const portals = useIframePortals(state.tabs);

  // Build visual tab list
  const visualTabs = useMemo(() => {
    const result: (TabProperties & { isGroupLabel?: boolean; groupId?: string; tabCount?: number })[] = [];

    state.groups.forEach((group) => {
      const groupTabs = state.tabs.filter((t) => t.groupId === group.id);
      const tabCount = groupTabs.length;

      // Add group label
      result.push({
        id: `group-label-${group.id}`,
        title: group.label,
        active: false,
        isGroupLabel: true,
        groupId: group.id,
        tabCount,
        isCloseIconVisible: false,
        favicon: false,
      });

      // Add tabs if not collapsed
      if (!group.collapsed) {
        groupTabs.forEach((tab) => {
          result.push({
            ...tab,
            title: tab.customName || tab.title,
          });
        });
      }
    });

    return result;
  }, [state.groups, state.tabs]);

  // Get active tab ID
  const activeTabId = state.tabs.find((t) => t.active)?.id || null;

  const handleTabActive = (tabId: string) => {
    if (tabId.startsWith('group-label-')) {
      const groupId = tabId.replace('group-label-', '');
      setState((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
        ),
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => ({
        ...t,
        active: t.id === tabId,
        loaded: t.id === tabId ? true : t.loaded,
      })),
    }));
  };

  const handleTabClose = (tabId: string) => {
    if (tabId.startsWith('group-label-')) return;

    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.filter((t) => t.id !== tabId),
    }));
  };

  const handleIframeLoad = (tabId: string) => {
    console.log(`Iframe loaded for tab: ${tabId}`);
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) =>
        t.id === tabId ? { ...t, loaded: true } : t
      ),
    }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Render all iframe InPortals (hidden, in memory) */}
      <IframePortalContents
        tabs={state.tabs}
        portals={portals}
        onIframeLoad={handleIframeLoad}
      />

      {/* Tab bar */}
      <div
        style={{
          backgroundColor: darkMode ? '#202124' : '#dee1e6',
          padding: '8px',
          minHeight: '50px',
        }}
      >
        <ChromeTabs
          tabs={visualTabs}
          darkMode={darkMode}
          onTabActive={handleTabActive}
          onTabClose={handleTabClose}
          draggable={true}
        />
      </div>

      {/* Iframe content area (only shown if enabled) */}
      {showIframeContent && (
        <IframeContentArea
          tabs={state.tabs}
          portals={portals}
          activeTabId={activeTabId}
        />
      )}

      {/* Group label styling */}
      <style>{`
        .chrome-tab[data-tab-id^="group-label-"] {
          background: linear-gradient(to bottom, #e8eaed 0%, #dadce0 100%) !important;
          font-weight: 600;
          cursor: pointer;
          max-width: 85px !important;
          min-width: 85px !important;
          width: 85px !important;
          padding-left: 6px !important;
          margin-right: 0 !important;
        }

        .chrome-tab[data-tab-id^="group-label-"] .chrome-tab-content {
          padding-right: 6px !important;
        }

        .chrome-tab[data-tab-id^="group-label-"] .chrome-tab-background {
          display: none;
        }

        .chrome-tab[data-tab-id^="group-label-"]:hover {
          background: linear-gradient(to bottom, #d0d3d8 0%, #c8cbcf 100%) !important;
        }

        .chrome-tab[data-tab-id^="group-label-"] .chrome-tab-title::before {
          content: attr(data-tab-count);
          display: inline-block;
          width: 20px;
          height: 20px;
          line-height: 20px;
          text-align: center;
          background: #5f6368;
          color: #fff;
          border-radius: 50%;
          font-size: 10px;
          font-weight: 700;
          margin-right: 6px;
          flex-shrink: 0;
        }

        .chrome-tab[data-tab-id^="group-label-"] .chrome-tab-title {
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #5f6368 !important;
          display: flex !important;
          align-items: center !important;
        }

        .chrome-tabs-dark-theme .chrome-tab[data-tab-id^="group-label-"] {
          background: linear-gradient(to bottom, #35363a 0%, #2d2e31 100%) !important;
        }

        .chrome-tabs-dark-theme .chrome-tab[data-tab-id^="group-label-"]:hover {
          background: linear-gradient(to bottom, #3c3d41 0%, #35363a 100%) !important;
        }

        .chrome-tabs-dark-theme .chrome-tab[data-tab-id^="group-label-"] .chrome-tab-title::before {
          background: #8ab4f8;
          color: #202124;
        }

        .chrome-tabs-dark-theme .chrome-tab[data-tab-id^="group-label-"] .chrome-tab-title {
          color: #8ab4f8 !important;
        }
      `}</style>
    </div>
  );
}
