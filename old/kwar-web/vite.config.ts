import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        sourcemap: true,
        minify: false,
        rollupOptions: {
            treeshake: false,
        },
    },
    server: {
        allowedHosts: true,
        host: '0.0.0.0',
        port: 9100,
    },
    preview: {
        allowedHosts: true,
        host: '0.0.0.0',
        port: 9100,
    },
});
