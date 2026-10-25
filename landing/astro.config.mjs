import { defineConfig } from 'astro/config'

// Domínio definitivo ainda não existe: com SITE_URL definido, o Astro gera canonical e og:url.
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  vite: {
    // a landing usa a modelagem dos dentes do app (../src/lib/dente3d.ts): o Three.js vem
    // sempre daqui, para não entrar duas cópias no pacote (e funcionar na Vercel, onde só
    // landing/ tem node_modules)
    resolve: { dedupe: ['three'] },
    server: { fs: { allow: ['..'] } },
    // só o 3D (Three.js, ~560 KB) passa de 500 KB, e ele já carrega sob demanda
    build: { chunkSizeWarningLimit: 600 },
  },
})
