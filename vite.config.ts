import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

const rootDir = import.meta.dirname;

function syncGhPagesBundlePlugin(): Plugin {
  return {
    name: 'sync-gh-pages-bundle',
    closeBundle() {
      try {
        const assetsDir = path.resolve(rootDir, 'dist/assets');
        if (!fs.existsSync(assetsDir)) return;
        const files = fs.readdirSync(assetsDir);
        const jsFile = files.find((f) => f.startsWith('app-') && f.endsWith('.js')) || files.find((f) => f === 'app.js');
        const cssFile = files.find((f) => f.startsWith('app-') && f.endsWith('.css')) || files.find((f) => f === 'app.css');

        const targets = [
          path.resolve(rootDir, 'dist/gh-pages'),
          path.resolve(rootDir, 'gh-pages'),
          path.resolve(rootDir, 'public/gh-pages'),
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

        // Ensure dist/index.html always points to root /manifest.webmanifest and root icons (never ./assets/app-*.webmanifest)
        const distIndexPath = path.resolve(rootDir, 'dist/index.html');
        if (fs.existsSync(distIndexPath)) {
          let html = fs.readFileSync(distIndexPath, 'utf8');
          html = html.replace(/href="\.?\/?assets\/app-[^"]+\.webmanifest"/g, 'href="/manifest.webmanifest"');
          fs.writeFileSync(distIndexPath, html);
          fs.writeFileSync(path.resolve(rootDir, 'dist/404.html'), html);
        }

        // Ensure root and dist always have the latest manifest.webmanifest and sw.js from public/
        const publicManifest = path.resolve(rootDir, 'public/manifest.webmanifest');
        if (fs.existsSync(publicManifest)) {
          fs.copyFileSync(publicManifest, path.resolve(rootDir, 'dist/manifest.webmanifest'));
          fs.copyFileSync(publicManifest, path.resolve(rootDir, 'manifest.webmanifest'));
        }
        const publicSw = path.resolve(rootDir, 'public/sw.js');
        if (fs.existsSync(publicSw)) {
          fs.copyFileSync(publicSw, path.resolve(rootDir, 'dist/sw.js'));
          fs.copyFileSync(publicSw, path.resolve(rootDir, 'sw.js'));
        }

        // Ensure GitHub Pages CNAME is always present in dist, root, and public
        const cnameDomain = 'www.swanarhclassroom.online\n';
        fs.writeFileSync(path.resolve(rootDir, 'dist/CNAME'), cnameDomain);
        fs.writeFileSync(path.resolve(rootDir, 'CNAME'), cnameDomain);
        fs.writeFileSync(path.resolve(rootDir, 'public/CNAME'), cnameDomain);
      } catch {
        // ignore
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      syncGhPagesBundlePlugin(),
    ],
    build: {
      chunkSizeWarningLimit: 2500,
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
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio Cloud Run environment to prevent WebSocket connection errors.
      hmr: false,
      watch: null,
    },
  };
});
