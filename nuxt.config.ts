// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      apiOrigin: process.env.NUXT_PUBLIC_API_ORIGIN || 'http://localhost:8989',
    },
  },

  app: {
    head: {
      title: 'Nusanime',
      meta: [
        { name: 'description', content: 'Nusanime — nonton anime subtitle Indonesia' },
        { name: 'theme-color', content: '#18181b' },
      ],
      htmlAttrs: { lang: 'id' },
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: 'anonymous',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
        },
      ],
    },
  },

  vite: {
    optimizeDeps: {
      include: ['@oplayer/core', '@oplayer/ui', '@oplayer/dash', 'dashjs'],
    },
  },
})
