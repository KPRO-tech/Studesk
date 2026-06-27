import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Studesk',
    short_name: 'Studesk',
    description:
      'Notes, flashcards, tâches, calendrier et budget dans une seule PWA offline-first.',
    start_url: '/',
    display: 'standalone',

    background_color: '#161513',

    theme_color: '#be694a',

    icons: [
      {
        src: '/icons/studesk-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/studesk-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

