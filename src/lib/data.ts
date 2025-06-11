import type { WordPressSite, ActivityLog } from '@/lib/types';

export const initialSites: WordPressSite[] = [
  {
    id: '1',
    name: 'Minuto24',
    url: 'https://www.minuto24.com',
    rssFeedUrl: 'https://www.minuto24.com/feed/',
    facebookPageId: 'fb-minuto24',
    facebookPageName: 'Minuto24 Oficial',
    facebookPageAccessToken: 'mock-access-token-for-minuto24-initial-testing', // Mock token
    status: 'monitoring',
    lastChecked: new Date().toISOString(),
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
];
