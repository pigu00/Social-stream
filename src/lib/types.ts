export interface WordPressSite {
  id: string;
  name: string;
  url: string; // WordPress site URL
  rssFeedUrl: string;
  facebookPageId?: string; // ID of the connected Facebook Page
  facebookPageName?: string; // Name of the connected Facebook Page for display
  status: 'monitoring' | 'paused' | 'error';
  lastChecked?: string; // ISO date string
  errorMessage?: string;
}

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string; // This would be securely stored in a real app
}

export type LogEntryStatus = 'info' | 'generating_post' | 'posting_to_facebook' | 'posted' | 'error' | 'skipped';

export interface ActivityLog {
  id: string;
  timestamp: string; // ISO date string
  siteId: string;
  siteName: string;
  articleTitle?: string;
  articleUrl?: string;
  status: LogEntryStatus;
  message: string; // Could be AI generated blurb, success message, or error details
  facebookPostUrl?: string;
}
