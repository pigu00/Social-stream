'use server';

import type { WordPressSite, ActivityLog, LogEntryStatus } from '@/lib/types';
import { initialSites, initialLogs } from '@/lib/data';
import { generateFacebookPost, type GenerateFacebookPostInput } from '@/ai/flows/generate-facebook-post';
import { revalidatePath } from 'next/cache';
import { FacebookAdsApi, Page as FacebookPageSdk } from 'facebook-nodejs-business-sdk';

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
  
  const mockPageId = `fb-page-${pageName.toLowerCase().replace(/\s+/g, '-')}`;
  // In a real app, the access token would be obtained via Facebook OAuth flow.
  const mockAccessToken = `mock-access-token-${siteId}-${Date.now()}`;
  
  sites[siteIndex].facebookPageId = mockPageId;
  sites[siteIndex].facebookPageName = pageName;
  sites[siteIndex].facebookPageAccessToken = mockAccessToken; // Store the mock token
  
  await addLogEntry({
    siteId: sites[siteIndex].id,
    siteName: sites[siteIndex].name,
    status: 'info',
    message: `Simulated Facebook Page connection for "${pageName}". Mock access token generated.`,
  });
  
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
  logs.unshift(newLog); 
  if (logs.length > 50) { 
    logs.pop();
  }
  revalidatePath('/dashboard');
  return JSON.parse(JSON.stringify(newLog));
}

/**
 * Publishes content to a Facebook Page using the Facebook Graph API.
 * This is a placeholder and needs to be implemented with actual API calls.
 */
async function publishToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  message: string,
  link?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    const errorMsg = 'Facebook App ID or App Secret is not configured in environment variables. Cannot make real API calls.';
    console.error(errorMsg);
    // For this demo, we'll still simulate if credentials aren't set, but log an error.
    // In a production app, you might want to return { success: false, error: errorMsg } here.
  }
  
  if (!pageAccessToken) {
    return { success: false, error: 'Facebook Page Access Token not available for this site.' };
  }
  if (!pageId) {
    return { success: false, error: 'Facebook Page ID not available for this site.' };
  }

  console.log(`Attempting to post to Facebook Page ID: ${pageId}`);
  console.log(`Message: "${message}"`);
  if (link) console.log(`Link: ${link}`);

  // --- START REAL FACEBOOK API CALL SECTION ---
  // IMPORTANT: The following is a conceptual guide. You'll need to:
  // 1. Ensure 'facebook-nodejs-business-sdk' is installed.
  // 2. Populate .env with your FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.
  // 3. Implement proper OAuth to get a real `pageAccessToken`. The current one is a mock.
  // 4. Handle API errors robustly.

  if (appId && appSecret && pageAccessToken.startsWith('mock-access-token')) {
     console.warn(`Using a MOCK access token: "${pageAccessToken}". Real Facebook API calls will likely fail or be disfunctional. Replace with a genuine token.`);
  }
  
  try {
    // Initialize Facebook API - this usually needs to be done once with the app credentials if not using a user token directly
    // For page posts, you primarily use the Page Access Token.
    // FacebookAdsApi.init(pageAccessToken); // This initializes with the token, often for user-level actions.
    // For posting to a page, you might use the page access token directly in the Page object methods.
    
    // Example using facebook-nodejs-business-sdk:
    // const api = FacebookAdsApi.init(pageAccessToken); // Initialize with the page access token
    // if (process.env.NODE_ENV === 'development') {
    //   api.setDebug(true);
    // }
    // const pageNode = new FacebookPageSdk(pageId);
    // const params: Record<string, any> = { message };
    // if (link) {
    //   params.link = link;
    // }
    // const response = await pageNode.createFeed([], params);
    //
    // if (response && response.id) {
    //   console.log('Successfully posted to Facebook. Post ID:', response.id);
    //   return { success: true, postId: response.id };
    // } else {
    //   console.error('Failed to post to Facebook. Response:', response);
    //   return { success: false, error: 'Failed to post to Facebook. Check API response.' };
    // }

    // SIMULATION until real API calls are implemented:
    console.log('SIMULATING Facebook API call...');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
    const mockPostId = `simulated_fb_post_${Date.now()}`;
    console.log(`Simulated Facebook post success. Post ID: ${mockPostId}`);
    return { success: true, postId: mockPostId };

  } catch (apiError: any) {
    console.error('Facebook API Error:', apiError.message || apiError);
    let errorMessage = 'Unknown error posting to Facebook.';
    if (apiError.isAxiosError && apiError.response && apiError.response.data && apiError.response.data.error) {
      errorMessage = apiError.response.data.error.message || JSON.stringify(apiError.response.data.error);
    } else if (apiError.message) {
      errorMessage = apiError.message;
    }
    return { success: false, error: errorMessage };
  }
  // --- END REAL FACEBOOK API CALL SECTION ---
}


export async function simulateNewArticleAndPost(siteId: string): Promise<{success: boolean; message: string; log?: ActivityLog}> {
  const site = sites.find(s => s.id === siteId);
  if (!site) {
    return { success: false, message: 'Site not found.' };
  }
  if (!site.facebookPageName || !site.facebookPageId || !site.facebookPageAccessToken) {
    await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      status: 'skipped',
      message: `Skipped: Facebook Page not fully configured for ${site.name} (missing name, ID, or access token).`,
    });
    return { success: false, message: `Facebook Page not fully configured for ${site.name}.` };
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

  let aiGeneratedText: string;
  try {
    const aiInput: GenerateFacebookPostInput = {
      articleTitle: mockArticle.title,
      articleContent: mockArticle.content,
      articleUrl: mockArticle.url,
    };
    const aiResult = await generateFacebookPost(aiInput);
    aiGeneratedText = aiResult.facebookPostText;
  } catch (error) {
    console.error('AI Post Generation Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during AI generation.';
    await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: mockArticle.title,
      articleUrl: mockArticle.url,
      status: 'error',
      message: `AI Generation Error: ${errorMessage}`,
    });
    return { success: false, message: `AI Generation Error: ${errorMessage}` };
  }
  
  await addLogEntry({
    siteId: site.id,
    siteName: site.name,
    articleTitle: mockArticle.title,
    articleUrl: mockArticle.url,
    status: 'posting_to_facebook',
    message: `AI Generated: "${aiGeneratedText}". Attempting to post to Facebook Page: ${site.facebookPageName}...`,
  });

  const facebookPostResult = await publishToFacebookPage(
    site.facebookPageId,
    site.facebookPageAccessToken,
    aiGeneratedText,
    mockArticle.url
  );

  if (facebookPostResult.success && facebookPostResult.postId) {
    const finalLog = await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: mockArticle.title,
      articleUrl: mockArticle.url,
      status: 'posted',
      message: `Successfully posted: "${aiGeneratedText}"`,
      facebookPostUrl: `https://facebook.com/${site.facebookPageId}/posts/${facebookPostResult.postId.replace(/^simulated_fb_post_/, 'mock-')}`, // Adjust for mock/real ID
    });
    return { success: true, message: `Successfully posted to ${site.facebookPageName}.`, log: finalLog };
  } else {
    const errorLog = await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: mockArticle.title,
      articleUrl: mockArticle.url,
      status: 'error',
      message: `Facebook Posting Error: ${facebookPostResult.error || 'Unknown error'}`,
    });
    return { success: false, message: `Error posting to Facebook: ${facebookPostResult.error || 'Unknown error'}`, log: errorLog };
  }
}
