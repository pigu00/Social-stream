import type { WordPressSite, ActivityLog } from '@/lib/types';

export const initialSites: WordPressSite[] = [
  {
    id: '1',
    name: 'Minuto24',
    url: 'https://www.minuto24.com',
    rssFeedUrl: 'https://www.minuto24.com/feed/',
    facebookPageId: 'fb-minuto24',
    facebookPageName: 'Minuto24 Oficial',
    status: 'monitoring',
    lastChecked: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Gaceta Mercantil',
    url: 'https://gacetamercantil.com',
    rssFeedUrl: 'https://gacetamercantil.com/feed/',
    status: 'paused',
  },
];

export const initialLogs: ActivityLog[] = [
  {
    id: 'log1',
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    siteId: '1',
    siteName: 'Minuto24',
    articleTitle: 'Breaking News: Something Happened',
    articleUrl: 'https://www.minuto24.com/breaking-news',
    status: 'posted',
    message: 'Check out the latest: Something Happened! Read more here.',
    facebookPostUrl: 'https://facebook.com/minuto24/posts/123',
  },
  {
    id: 'log2',
    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    siteId: '2',
    siteName: 'Gaceta Mercantil',
    articleTitle: 'Economic Analysis Q3',
    articleUrl: 'https://gacetamercantil.com/economic-analysis-q3',
    status: 'error',
    message: 'Failed to connect to Facebook API. (Mock Error)',
  },
];
