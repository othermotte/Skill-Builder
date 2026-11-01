import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  if (mode === 'staging' && env.VITE_FIREBASE_PROJECT_ID !== 'leadership-skill-builder-stg') throw new Error('Invalid staging project.');
  return {
    base: "",
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      target: ['es2020', 'safari13'], // Ensure compatibility with Safari 13+
    },
    plugins: [react(), tailwindcss(), ...(mode === 'staging' ? [{
      name: 'staging-noindex',
      transformIndexHtml(html: string) { return html.replace('<head>', '<head><meta name="robots" content="noindex,nofollow" />').replace('https://leadershipskillbuilder.ai', 'https://leadership-skill-builder-staging-600309447137.europe-west1.run.app'); },
      generateBundle() { this.emitFile({ type: 'asset', fileName: 'robots.txt', source: 'User-agent: *\nDisallow: /\n' }); }
    }] : [])],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
