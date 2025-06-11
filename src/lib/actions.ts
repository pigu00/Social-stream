'use server';

import type { WordPressSite, ActivityLog, LogEntryStatus } from '@/lib/types';
import { initialSites, initialLogs } from '@/lib/data';
import { generateFacebookPost, type GenerateFacebookPostInput } from '@/ai/flows/generate-facebook-post';
import { revalidatePath } from 'next/cache';

// In-memory store for demo purposes
let sites: WordPressSite[] = [...initialSites];
let logs: ActivityLog[] = [...initialLogs];
let siteIdCounter = sites.length > 0 ? Math.max(...sites.map(s => parseInt(s.id, 10))) + 1 : 1;
let logIdCounter = logs.length > 0 ? Math.max(...logs.map(l => parseInt(l.id.replace('log',''), 10))) + 1 : 1;


export async function getSites(): Promise<WordPressSite[]> {
  return JSON.parse(JSON.stringify(sites)); // Return a copy
}

export async function getSiteById(id: string): Promise<WordPressSite | undefined> {
  return JSON.parse(JSON.stringify(sites.find(site => site.id === id)));
}

export async function addSite(data: Omit<WordPressSite, 'id' | 'status' | 'lastChecked'>): Promise<WordPressSite> {
  const newSite: WordPressSite = {
    ...data,
    id: String(siteIdCounter++),
    status: 'monitoring',
    lastChecked: new Date().toISOString(),
  };
  sites.push(newSite);
  revalidatePath('/dashboard');
  return JSON.parse(JSON.stringify(newSite));
}

export async function updateSite(id: string, data: Partial<Omit<WordPressSite, 'id'>>): Promise<WordPressSite | null> {
  const siteIndex = sites.findIndex(s => s.id === id);
  if (siteIndex === -1) return null;
  sites[siteIndex] = { ...sites[siteIndex], ...data };
  revalidatePath('/dashboard');
  return JSON.parse(JSON.stringify(sites[siteIndex]));
}

export async function deleteSite(id: string): Promise<boolean> {
  const initialLength = sites.length;
  sites = sites.filter(s => s.id !== id);
  if (sites.length < initialLength) {
    revalidatePath('/dashboard');
    return true;
  }
  return false;
}

export async function connectFacebookPage(siteId: string, pageName: string): Promise<WordPressSite | null> {
  const siteIndex = sites.findIndex(s => s.id === siteId);
  if (siteIndex === -1) return null;
  
  // In a real app, pageId would come from FB API after auth
  const mockPageId = `fb-page-${pageName.toLowerCase().replace(/\s+/g, '-')}`;
  sites[siteIndex].facebookPageId = mockPageId;
  sites[siteIndex].facebookPageName = pageName;
  
  revalidatePath('/dashboard');
  return JSON.parse(JSON.stringify(sites[siteIndex]));
}

export async function getLogs(): Promise<ActivityLog[]> {
  return JSON.parse(JSON.stringify(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())));
}

async function addLogEntry(entryData: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<ActivityLog> {
  const newLog: ActivityLog = {
    ...entryData,
    id: `log${logIdCounter++}`,
    timestamp: new Date().toISOString(),
  };
  logs.unshift(newLog); // Add to the beginning
  if (logs.length > 50) { // Keep logs manageable for demo
    logs.pop();
  }
  revalidatePath('/dashboard');
  return JSON.parse(JSON.stringify(newLog));
}

export async function simulateNewArticleAndPost(siteId: string): Promise<{success: boolean; message: string; log?: ActivityLog}> {
  const site = sites.find(s => s.id === siteId);
  if (!site) {
    return { success: false, message: 'Site not found.' };
  }
  if (!site.facebookPageName) {
    await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      status: 'skipped',
      message: `Skipped: No Facebook Page connected to ${site.name}.`,
    });
    return { success: false, message: `No Facebook Page connected to ${site.name}.` };
  }

  const mockArticle = {
    title: `Mock Article from ${site.name} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    content: `This is some mock content for the article from ${site.name}. It includes details about various interesting topics that readers might find engaging. The goal is to generate a compelling Facebook post for this new piece of information.`,
    url: `${site.url}/mock-article-${Date.now()}`,
  };

  await addLogEntry({
    siteId: site.id,
    siteName: site.name,
    articleTitle: mockArticle.title,
    articleUrl: mockArticle.url,
    status: 'generating_post',
    message: 'Attempting to generate Facebook post content using AI...',
  });

  try {
    const aiInput: GenerateFacebookPostInput = {
      articleTitle: mockArticle.title,
      articleContent: mockArticle.content,
      articleUrl: mockArticle.url,
    };
    const aiResult = await generateFacebookPost(aiInput);
    
    await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: mockArticle.title,
      articleUrl: mockArticle.url,
      status: 'posting_to_facebook',
      message: `AI Generated: "${aiResult.facebookPostText}". Simulating post to ${site.facebookPageName}...`,
    });

    // Simulate posting to Facebook
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    const finalLog = await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: mockArticle.title,
      articleUrl: mockArticle.url,
      status: 'posted',
      message: aiResult.facebookPostText,
      facebookPostUrl: `https://facebook.com/${site.facebookPageId}/posts/mock-${Date.now()}`,
    });
    return { success: true, message: `Successfully simulated post for ${site.name}.`, log: finalLog };

  } catch (error) {
    console.error('AI Post Generation or Mock Posting Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during AI generation or posting.';
    const errorLog = await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: mockArticle.title,
      articleUrl: mockArticle.url,
      status: 'error',
      message: `Error: ${errorMessage}`,
    });
    return { success: false, message: `Error during simulation: ${errorMessage}`, log: errorLog };
  }
}
