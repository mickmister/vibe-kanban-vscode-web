import './styles.css';

import React, { useEffect } from 'react';
import { HeroUIProvider } from '@heroui/react';
import springboard from 'springboard';
import { WorkspaceShell } from './components/WorkspaceShell';
import { createDefaultWorkspace } from './types';
import type { WorkspaceState } from './types';

function ManifestLink() {
  useEffect(() => {
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }
  }, []);
  return null;
}

springboard.registerModule('workspace', {}, async (moduleAPI) => {
  const workspaceState = await moduleAPI.statesAPI.createPersistentState<WorkspaceState>(
    'workspace',
    createDefaultWorkspace()
  );

  moduleAPI.registerRoute('/', { hideApplicationShell: true }, () => {
    return (
      <HeroUIProvider>
        <ManifestLink />
        <div className="dark w-full h-full">
          <WorkspaceShell workspaceState={workspaceState} />
        </div>
      </HeroUIProvider>
    );
  });

  moduleAPI.onDestroy(() => {
    // cleanup if needed
  });

  return {
    states: { workspace: workspaceState },
  };
});
