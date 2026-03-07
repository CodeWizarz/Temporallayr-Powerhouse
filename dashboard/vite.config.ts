/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    charts: ['recharts'],
                }
            }
        }
    },
    server: {
        port: 3000,
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/tests/setup.ts',
        include: ['src/tests/**/*.test.{ts,tsx}']
    }
})
