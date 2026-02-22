/**
 * Complete Example: Iframe Management with react-reverse-portal
 *
 * This file demonstrates the complete pattern for managing iframes
 * with react-reverse-portal in the vibe-kanban application.
 */

import React, { useRef, useEffect, useState } from 'react';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';

// ============================================================================
// TYPES
// ============================================================================

interface Tab {
  id: string;
  title: string;
  url: string;
}

// ============================================================================
// EXAMPLE 1: Simple Single Tab
// ============================================================================

export function SimpleSingleTabExample() {
  const [activeUrl, setActiveUrl] = useState('https://react.dev');
  const portalNode = useRef(createHtmlPortalNode()).current;

  return (
    <div className="h-screen flex flex-col">
      {/* Controls */}
      <div className="p-4 bg-gray-100">
        <button onClick={() => setActiveUrl('https://react.dev')}>
          React Docs
        </button>
        <button onClick={() => setActiveUrl('https://developer.mozilla.org')}>
          MDN
        </button>
      </div>

      {/* Iframe Content */}
      <div className="flex-1">
        {/* Step 1: Create iframe in portal */}
        <InPortal node={portalNode}>
          <iframe
            src={activeUrl}
            className="w-full h-full border-0"
            title="Content"
          />
        </InPortal>

        {/* Step 2: Display portal */}
        <OutPortal node={portalNode} />
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 2: Multiple Tabs (Correct Pattern)
// ============================================================================

export function MultipleTabsExample() {
  const [tabs] = useState<Tab[]>([
    { id: '1', title: 'React', url: 'https://react.dev' },
    { id: '2', title: 'MDN', url: 'https://developer.mozilla.org' },
    { id: '3', title: 'TypeScript', url: 'https://www.typescriptlang.org/docs/' },
  ]);
  const [activeTabId, setActiveTabId] = useState('1');

  // Portal nodes stored in ref (persist across renders)
  const portals = useRef<Map<string, ReturnType<typeof createHtmlPortalNode>>>(new Map());

  useEffect(() => {
    // Create portal nodes for each tab
    tabs.forEach((tab) => {
      if (!portals.current.has(tab.id)) {
        portals.current.set(tab.id, createHtmlPortalNode());
      }
    });

    // Clean up removed tabs
    const tabIds = new Set(tabs.map((t) => t.id));
    for (const [id] of portals.current.entries()) {
      if (!tabIds.has(id)) {
        portals.current.delete(id);
      }
    }
  }, [tabs]);

  return (
    <div className="h-screen flex flex-col">
      {/* Tab Bar */}
      <div className="flex gap-2 p-4 bg-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={activeTabId === tab.id ? 'font-bold' : ''}
          >
            {tab.title}
          </button>
        ))}
      </div>

      {/* Iframe Content Area */}
      <div className="flex-1 relative">
        {/*
          STEP 1: Create all iframes in InPortals
          These are created once and stay in memory
        */}
        {tabs.map((tab) => {
          const portalNode = portals.current.get(tab.id);
          if (!portalNode) return null;

          return (
            <InPortal key={tab.id} node={portalNode}>
              <iframe
                src={tab.url}
                title={tab.title}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </InPortal>
          );
        })}

        {/*
          STEP 2: Display iframes with OutPortals
          Active tab is visible, others are hidden with display:none
        */}
        {tabs.map((tab) => {
          const portalNode = portals.current.get(tab.id);
          if (!portalNode) return null;

          const isActive = tab.id === activeTabId;

          return (
            <div
              key={`outlet-${tab.id}`}
              className="absolute inset-0"
              style={{ display: isActive ? 'block' : 'none' }}
            >
              <OutPortal node={portalNode} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: With Loading States
// ============================================================================

export function TabsWithLoadingExample() {
  const [tabs] = useState<Tab[]>([
    { id: '1', title: 'React', url: 'https://react.dev' },
    { id: '2', title: 'MDN', url: 'https://developer.mozilla.org' },
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

  const portals = useRef<Map<string, ReturnType<typeof createHtmlPortalNode>>>(new Map());

  useEffect(() => {
    tabs.forEach((tab) => {
      if (!portals.current.has(tab.id)) {
        portals.current.set(tab.id, createHtmlPortalNode());
      }
    });
  }, [tabs]);

  const handleIframeLoad = (tabId: string) => {
    setLoadedTabs((prev) => new Set(prev).add(tabId));
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Tab Bar */}
      <div className="flex gap-2 p-4 bg-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={activeTabId === tab.id ? 'font-bold' : ''}
          >
            {tab.title}
            {!loadedTabs.has(tab.id) && ' (loading...)'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {/* Create iframes */}
        {tabs.map((tab) => {
          const portalNode = portals.current.get(tab.id);
          if (!portalNode) return null;

          return (
            <InPortal key={tab.id} node={portalNode}>
              <div className="w-full h-full relative">
                {/* Loading spinner */}
                {!loadedTabs.has(tab.id) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="text-gray-500">Loading...</div>
                  </div>
                )}
                {/* Iframe */}
                <iframe
                  src={tab.url}
                  title={tab.title}
                  className="w-full h-full border-0"
                  onLoad={() => handleIframeLoad(tab.id)}
                />
              </div>
            </InPortal>
          );
        })}

        {/* Display iframes */}
        {tabs.map((tab) => {
          const portalNode = portals.current.get(tab.id);
          if (!portalNode) return null;

          return (
            <div
              key={`outlet-${tab.id}`}
              className="absolute inset-0"
              style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
            >
              <OutPortal node={portalNode} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: Custom Hook Pattern (Recommended)
// ============================================================================

/**
 * Reusable hook for managing iframe portals
 */
function useIframePortals(tabs: Tab[]) {
  const portalsRef = useRef<Map<string, ReturnType<typeof createHtmlPortalNode>>>(new Map());

  useEffect(() => {
    const currentPortals = portalsRef.current;
    const currentTabIds = new Set(tabs.map((tab) => tab.id));

    // Remove deleted tabs
    for (const [id] of currentPortals.entries()) {
      if (!currentTabIds.has(id)) {
        currentPortals.delete(id);
      }
    }

    // Create new tabs
    for (const tab of tabs) {
      if (!currentPortals.has(tab.id)) {
        currentPortals.set(tab.id, createHtmlPortalNode());
      }
    }
  }, [tabs]);

  return portalsRef.current;
}

export function TabsWithCustomHookExample() {
  const [tabs] = useState<Tab[]>([
    { id: '1', title: 'React', url: 'https://react.dev' },
    { id: '2', title: 'MDN', url: 'https://developer.mozilla.org' },
  ]);
  const [activeTabId, setActiveTabId] = useState('1');

  // Use custom hook
  const portals = useIframePortals(tabs);

  return (
    <div className="h-screen flex flex-col">
      {/* Tab Bar */}
      <div className="flex gap-2 p-4 bg-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={activeTabId === tab.id ? 'font-bold' : ''}
          >
            {tab.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {/* Create iframes */}
        {tabs.map((tab) => {
          const portalNode = portals.get(tab.id);
          if (!portalNode) return null;

          return (
            <InPortal key={tab.id} node={portalNode}>
              <iframe
                src={tab.url}
                title={tab.title}
                className="w-full h-full border-0"
              />
            </InPortal>
          );
        })}

        {/* Display iframes */}
        {tabs.map((tab) => {
          const portalNode = portals.get(tab.id);
          if (!portalNode) return null;

          return (
            <div
              key={`outlet-${tab.id}`}
              className="absolute inset-0"
              style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
            >
              <OutPortal node={portalNode} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// ANTI-PATTERNS (DO NOT USE)
// ============================================================================

/**
 * ❌ WRONG: Creating portal nodes in render
 * This will recreate the iframe on every render!
 */
export function WrongPatternExample1() {
  const [activeUrl, setActiveUrl] = useState('https://react.dev');

  // ❌ WRONG: New portal created on every render
  const portalNode = createHtmlPortalNode();

  return (
    <div>
      <InPortal node={portalNode}>
        <iframe src={activeUrl} />
      </InPortal>
      <OutPortal node={portalNode} />
    </div>
  );
}

/**
 * ❌ WRONG: Conditional InPortal rendering
 * InPortal should always be rendered
 */
export function WrongPatternExample2({ tabs, activeTabId }: { tabs: Tab[]; activeTabId: string }) {
  const portals = useRef(new Map()).current;

  return (
    <div>
      {tabs.map((tab) => {
        const portalNode = portals.get(tab.id);
        const isActive = tab.id === activeTabId;

        return (
          <div key={tab.id}>
            {/* ❌ WRONG: Only rendering InPortal when active */}
            {isActive && (
              <InPortal node={portalNode}>
                <iframe src={tab.url} />
              </InPortal>
            )}
            {/* This will cause iframe to reload when switching tabs */}
            <div style={{ display: isActive ? 'block' : 'none' }}>
              <OutPortal node={portalNode} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * ✅ CORRECT: InPortal always rendered, OutPortal conditionally displayed
 */
export function CorrectPatternExample({ tabs, activeTabId }: { tabs: Tab[]; activeTabId: string }) {
  const portals = useIframePortals(tabs);

  return (
    <div>
      {/* ✅ Always render all InPortals */}
      {tabs.map((tab) => {
        const portalNode = portals.get(tab.id);
        if (!portalNode) return null;

        return (
          <InPortal key={tab.id} node={portalNode}>
            <iframe src={tab.url} />
          </InPortal>
        );
      })}

      {/* ✅ Conditionally display OutPortals */}
      {tabs.map((tab) => {
        const portalNode = portals.get(tab.id);
        if (!portalNode) return null;

        return (
          <div
            key={`outlet-${tab.id}`}
            style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
          >
            <OutPortal node={portalNode} />
          </div>
        );
      })}
    </div>
  );
}
