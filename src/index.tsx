import './styles.css';

import React, { useEffect } from 'react';
import { HeroUIProvider } from '@heroui/react';
import springboard from 'springboard';
import { WorkspaceShell } from './components/WorkspaceShell';
import { createDefaultWorkspace } from './types';
import type { WorkspaceState } from './types';

// function ManifestLink() {
//   useEffect(() => {
//     let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
//     if (!link) {
//       link = document.createElement('link');
//       link.rel = 'manifest';
//       link.href = '/manifest.json';
//       document.head.appendChild(link);
//     }
//   }, []);
//   return null;
// }

springboard.registerModule('workspace', {}, async (moduleAPI) => {
  const workspaceState = await moduleAPI.statesAPI.createPersistentState<WorkspaceState>(
    'workspace',
    createDefaultWorkspace()
  );

  moduleAPI.registerRoute('/', { hideApplicationShell: true }, () => {
    return (
      <>
        {/* <ManifestLink /> */}
        <div className="dark w-screen h-screen fixed inset-0">
          <WorkspaceShell workspaceState={workspaceState} />
        </div>
      </>
    );
  });

  return {
    states: { workspace: workspaceState },
    Provider: (props: React.PropsWithChildren) => {
      return (
        <HeroUIProvider>
          {props.children}
        </HeroUIProvider>
      )
    },
  };
});
