import React, { useEffect, useRef } from 'react';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';

/**
 * IframePortalManager - Manages iframe lifecycle with react-reverse-portal
 *
 * Key Features:
 * - Iframes are created once and "moved" between visible/hidden states
 * - Hidden iframes use display:none to keep content fresh
 * - No unmounting means iframes maintain their state
 * - Prevents expensive iframe reloads on tab switching
 */

interface IframePortalNode {
  id: string;
  portalNode: ReturnType<typeof createHtmlPortalNode>;
  url: string;
  loaded: boolean;
}

interface IframePortalManagerProps {
  iframes: Array<{
    id: string;
    url: string;
    title: string;
  }>;
  activeIframeId: string | null;
  onIframeLoad?: (id: string) => void;
}

/**
 * Hook to manage iframe portal nodes
 */
export function useIframePortals(
  iframes: Array<{ id: string; url: string; title: string }>
) {
  const portalsRef = useRef<Map<string, IframePortalNode>>(new Map());

  // Create or update portal nodes for each iframe
  useEffect(() => {
    const currentPortals = portalsRef.current;
    const currentIds = new Set(iframes.map((iframe) => iframe.id));

    // Remove portals for iframes that no longer exist
    for (const [id, portal] of currentPortals.entries()) {
      if (!currentIds.has(id)) {
        currentPortals.delete(id);
      }
    }

    // Create new portals for new iframes
    for (const iframe of iframes) {
      if (!currentPortals.has(iframe.id)) {
        currentPortals.set(iframe.id, {
          id: iframe.id,
          portalNode: createHtmlPortalNode(),
          url: iframe.url,
          loaded: false,
        });
      } else {
        // Update URL if changed
        const portal = currentPortals.get(iframe.id)!;
        if (portal.url !== iframe.url) {
          portal.url = iframe.url;
          portal.loaded = false;
        }
      }
    }
  }, [iframes]);

  return portalsRef.current;
}

/**
 * Component to render iframe content in a portal
 */
export function IframePortalContent({
  iframe,
  portalNode,
  onLoad,
}: {
  iframe: { id: string; url: string; title: string };
  portalNode: ReturnType<typeof createHtmlPortalNode>;
  onLoad?: (id: string) => void;
}) {
  const handleLoad = () => {
    if (onLoad) {
      onLoad(iframe.id);
    }
  };

  return (
    <InPortal node={portalNode}>
      <iframe
        src={iframe.url}
        title={iframe.title}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        allow="clipboard-read; clipboard-write; fullscreen"
        role="region"
        onLoad={handleLoad}
      />
    </InPortal>
  );
}

/**
 * Component to render the visible portion of an iframe portal
 */
export function IframePortalOutlet({
  portalNode,
  isVisible,
}: {
  portalNode: ReturnType<typeof createHtmlPortalNode>;
  isVisible: boolean;
}) {
  return (
    <div
      className="w-full h-full"
      style={{ display: isVisible ? 'block' : 'none' }}
    >
      <OutPortal node={portalNode} />
    </div>
  );
}

/**
 * Main IframePortalManager component
 *
 * Usage:
 * ```tsx
 * const portals = useIframePortals(iframes);
 *
 * // Render all iframe contents (hidden or visible)
 * <IframePortalManager
 *   iframes={iframes}
 *   portals={portals}
 *   activeIframeId={activeId}
 *   onIframeLoad={handleLoad}
 * />
 *
 * // Show specific iframe
 * <IframePortalOutlet
 *   portalNode={portals.get(activeId)!.portalNode}
 *   isVisible={true}
 * />
 * ```
 */
export function IframePortalManager({
  iframes,
  activeIframeId,
  onIframeLoad,
}: IframePortalManagerProps) {
  const portals = useIframePortals(iframes);

  return (
    <>
      {/* Render all iframe contents in portals */}
      {iframes.map((iframe) => {
        const portal = portals.get(iframe.id);
        if (!portal) return null;

        return (
          <IframePortalContent
            key={iframe.id}
            iframe={iframe}
            portalNode={portal.portalNode}
            onLoad={onIframeLoad}
          />
        );
      })}

      {/* Render outlets - only active one is visible */}
      <div className="relative w-full h-full">
        {iframes.map((iframe) => {
          const portal = portals.get(iframe.id);
          if (!portal) return null;

          return (
            <div
              key={iframe.id}
              className="absolute inset-0"
              style={{ display: iframe.id === activeIframeId ? 'block' : 'none' }}
            >
              <IframePortalOutlet
                portalNode={portal.portalNode}
                isVisible={iframe.id === activeIframeId}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
