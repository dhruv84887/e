import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()], server: { port: 5173, proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } } }, build: { rollupOptions: { output: { manualChunks: { router: ['react-router-dom'], query: ['@tanstack/react-query'], motion: ['framer-motion'], forms: ['react-hook-form', '@hookform/resolvers', 'zod'] } } } } })
