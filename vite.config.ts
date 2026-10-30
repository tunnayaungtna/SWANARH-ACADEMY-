import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function syncGhPagesBundlePlugin(): Plugin {
  return {
    name: 'sync-gh-pages-bundle',
    closeBundle() {
      try {
        const assetsDir = path.resolve(__dirname, 'dist/assets');
        if (!fs.existsSync(assetsDir)) return;
        const files = fs.readdirSync(assetsDir);
        const jsFile = files.find((f) => f.startsWith('app-') && f.endsWith('.js')) || files.find((f) => f === 'app.js');
        const cssFile = files.find((f) => f.startsWith('app-') && f.endsWith('.css')) || files.find((f) => f === 'app.css');

        const targets = [
          path.resolve(__dirname, 'dist/gh-pages'),
          path.resolve(__dirname, 'gh-pages'),
          path.resolve(__dirname, 'public/gh-pages'),
        ];

        for (const dir of targets) {
          fs.mkdirSync(dir, {recursive: true});
          if (jsFile) {
            fs.copyFileSync(path.join(assetsDir, jsFile), path.join(dir, 'app.js'));
          }
          if (cssFile) {
            fs.copyFileSync(path.join(assetsDir, cssFile), path.join(dir, 'app.css'));
          }
        }

        // Also keep unhashed dist/assets/app.js and dist/assets/app.css so any cached HTML still loads the latest bundle
        if (jsFile && jsFile !== 'app.js') {
          fs.copyFileSync(path.join(assetsDir, jsFile), path.join(assetsDir, 'app.js'));
        }
        if (cssFile && cssFile !== 'app.css') {
          fs.copyFileSync(path.join(assetsDir, cssFile), path.join(assetsDir, 'app.css'));
        }
      } catch {
        // ignore
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      syncGhPagesBundlePlugin(),
    ],
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/app-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/app-[hash].[ext]',
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});


