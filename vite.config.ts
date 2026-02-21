import { defineConfig } from 'vite';
import { springboard } from 'springboard/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const platformVariant = process.env.SPRINGBOARD_PLATFORM || '';

let devPort = 3000;
const envPort = process.env.PORT || '';
try {
  const num = parseInt(envPort);
  if (!isNaN(num)) {
    devPort = num;
  }
} catch (e) {

}

let platforms: ('browser' | 'node')[] = ['browser', 'node'];

if (platformVariant === 'node') {
  platforms = ['node'];
} else if (platformVariant === 'browser') {
  platforms = ['browser'];
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    springboard({
      entry: './src/index.tsx',
      platforms,
      documentMeta: {
        title: 'Vibe Kanban Workspace',
        description: 'Workspace shell for code-server and vibe-kanban',
      },
      nodeServerPort: 1337,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    'process.env.DEBUG_LOG_PERFORMANCE': '""',
  },
  server: {
    port: devPort,
    host: true,
  },
});
