import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Netlify가 빌드 때 넣어 주는 CONTEXT: production | deploy-preview | branch-deploy (로컬은 dev)
  define: { __DEPLOY_CONTEXT__: JSON.stringify(process.env.CONTEXT ?? 'dev') },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
