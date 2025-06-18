
'use server';

import type { WordPressSite, ActivityLog } from '@/lib/types';
import { initialSites, initialLogs } from '@/lib/data';
import { generateFacebookPost, type GenerateFacebookPostInput } from '@/ai/flows/generate-facebook-post';
import { revalidatePath } from 'next/cache';
import { FacebookAdsApi, Page as FacebookPageSdk } from 'facebook-nodejs-business-sdk';
import Parser from 'rss-parser';

// In-memory store for demo purposes
let sites: WordPressSite[] = [...initialSites];
let logs: ActivityLog[] = [...initialLogs];
let siteIdCounter = sites.length > 0 ? Math.max(...sites.map(s => parseInt(s.id, 10))) + 1 : 1;
let logIdCounter = logs.length > 0 ? Math.max(...logs.map(l => parseInt(l.id.replace('log',''), 10))) + 1 : 1;

const rssParser = new Parser();

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
    status: 'monitoring', // Default status for a new site
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
 * Attempts to use the facebook-nodejs-business-sdk if a real pageAccessToken is provided.
 * Falls back to simulation if the token is a mock token or missing.
 */
async function publishToFacebookPage(
  site: WordPressSite, // Pass the whole site object for easier access to facebookPageId and token
  message: string,
  link?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  
  const { facebookPageId, facebookPageAccessToken } = site;
  const appId = process.env.FACEBOOK_APP_ID;

  if (!appId) {
    const errorMsg = 'Facebook App ID (FACEBOOK_APP_ID) no está configurado en las variables de entorno. No se pueden realizar llamadas reales a la API.';
    console.error(errorMsg);
    console.log('Forzando simulación de publicación en Facebook debido a FACEBOOK_APP_ID ausente.');
    await new Promise(resolve => setTimeout(resolve, 1500));
    const mockPostId = `simulated_fb_post_appid_missing_${Date.now()}`;
    return { success: true, postId: mockPostId };
  }
  
  if (!facebookPageId || !facebookPageAccessToken || facebookPageAccessToken.startsWith('mock-access-token')) {
     const warningMsg = `Token de acceso de página de Facebook es de prueba, nulo o el ID de página falta. Token: "${facebookPageAccessToken ? facebookPageAccessToken.substring(0,15)+'...' : 'N/A'}", Page ID: "${facebookPageId}". Se procederá con simulación.`;
     console.warn(warningMsg);
     await new Promise(resolve => setTimeout(resolve, 1500)); 
     const mockPostId = `simulated_fb_post_mock_token_${Date.now()}`;
     return { success: true, postId: mockPostId };
  }

  console.log(`Intentando publicar en Facebook Page ID: ${facebookPageId} con token REAL (primeros 15 chars): ${facebookPageAccessToken.substring(0,15)}...`);
  console.log(`Mensaje: "${message}"`);
  if (link) console.log(`Enlace: ${link}`);
  
  try {
    const api = FacebookAdsApi.init(facebookPageAccessToken);
    if (process.env.NODE_ENV === 'development') {
      api.setDebug(true); 
    }
    
    const pageNode = new FacebookPageSdk(facebookPageId);
    const params: Record<string, any> = { message };
    if (link) {
      params.link = link;
    }

    console.log(`Intentando publicar en Facebook Page ID: ${facebookPageId} via SDK con params:`, params);
    const response = await pageNode.createFeed(['id'], params); 
    
    console.log('Respuesta de la API de Facebook (SDK):', response);

    if (response && response.id) {
      console.log('Publicado exitosamente en Facebook. Post ID:', response.id);
      return { success: true, postId: response.id };
    } else {
      console.error('Fallo al publicar en Facebook usando SDK. Respuesta inesperada:', response);
      const errorMessage = 'Fallo al publicar en Facebook (SDK). Respuesta inesperada de la API.';
      return { success: false, error: errorMessage };
    }

  } catch (apiError: any) {
    console.error('Error de API de Facebook (SDK):', apiError.message || apiError);
    let errorMessage = 'Error desconocido al publicar en Facebook (SDK).';
    
    // Improved error message extraction from SDK
    if (apiError.response && apiError.response.error) { // SDK often wraps errors this way
        errorMessage = apiError.response.error.message || JSON.stringify(apiError.response.error);
    } else if (apiError.message) {
        errorMessage = apiError.message;
    }
    
    if (errorMessage.toLowerCase().includes("session has expired") || 
        errorMessage.toLowerCase().includes("invalid oauth access token") ||
        errorMessage.toLowerCase().includes("error validating access token")) {
      await updateSite(site.id, { 
        status: 'error', 
        errorMessage: `Facebook Token Error: ${errorMessage}. Por favor, reconecta la página.`,
        // Consider clearing the token if it's confirmed invalid
        // facebookPageAccessToken: undefined, 
        // facebookPageName: undefined,
        // facebookPageId: undefined, // Or just the token
      });
    } else {
      // For other API errors, just set the site error message
      await updateSite(site.id, {
        status: 'error',
        errorMessage: `Facebook API Error: ${errorMessage}`,
      });
    }
    return { success: false, error: errorMessage };
  }
}


export async function simulateNewArticleAndPost(siteId: string): Promise<{success: boolean; message: string; log?: ActivityLog}> {
  const site = sites.find(s => s.id === siteId);
  if (!site) {
    return { success: false, message: 'Sitio no encontrado.' };
  }

  if (!site.facebookPageId || !site.facebookPageAccessToken) {
    await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      status: 'skipped',
      message: `Saltado: La página de Facebook no está completamente configurada para ${site.name} (falta ID de página o token de acceso).`,
    });
    return { success: false, message: `La página de Facebook no está completamente configurada para ${site.name}.` };
  }
  if (site.status !== 'monitoring') {
     await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      status: 'skipped',
      message: `Saltado: El monitoreo para ${site.name} está actualmente en '${site.status}'.`,
    });
    return { success: false, message: `El monitoreo para ${site.name} está actualmente en '${site.status}'.` };
  }

  await addLogEntry({
    siteId: site.id,
    siteName: site.name,
    status: 'info',
    message: `Iniciando "Test Post". Intentando obtener el último artículo del feed RSS: ${site.rssFeedUrl}`,
  });

  let latestArticle: { title: string; content: string; url: string; };

  try {
    const feed = await rssParser.parseURL(site.rssFeedUrl);
    if (!feed.items || feed.items.length === 0) {
      await addLogEntry({
        siteId: site.id,
        siteName: site.name,
        status: 'error',
        message: `Error al obtener RSS: El feed de ${site.name} está vacío o no contiene artículos.`,
      });
      return { success: false, message: `El feed RSS de ${site.name} está vacío.` };
    }
    
    const firstItem = feed.items[0];
    // Attempt to get the most complete content available
    const articleContent = firstItem['content:encoded'] || firstItem.content || firstItem.contentSnippet || firstItem.description || 'No content available.';
    
    latestArticle = {
      title: firstItem.title || 'Untitled Article',
      content: articleContent,
      url: firstItem.link || site.url,
    };

    await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: latestArticle.title,
      articleUrl: latestArticle.url,
      status: 'info',
      message: `Último artículo obtenido de RSS: "${latestArticle.title}"`,
    });

  } catch (error: any) {
    console.error('Error al obtener o analizar el feed RSS:', error);
    const errorMessage = error.message || 'Error desconocido al procesar el feed RSS.';
    await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      status: 'error',
      message: `Error al obtener RSS para ${site.name}: ${errorMessage}`,
    });
    return { success: false, message: `Error al obtener o analizar el feed RSS para ${site.name}: ${errorMessage}` };
  }


  await addLogEntry({
    siteId: site.id,
    siteName: site.name,
    articleTitle: latestArticle.title,
    articleUrl: latestArticle.url,
    status: 'generating_post',
    message: 'Intentando generar contenido para la publicación de Facebook usando IA...',
  });

  let aiGeneratedText: string;
  try {
    const aiInput: GenerateFacebookPostInput = {
      articleTitle: latestArticle.title,
      articleContent: latestArticle.content, // Use the full content for better AI results
      articleUrl: latestArticle.url,
    };
    const aiResult = await generateFacebookPost(aiInput);
    aiGeneratedText = aiResult.facebookPostText;
  } catch (error) {
    console.error('Error en Generación de Post con IA:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido durante la generación con IA.';
    await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: latestArticle.title,
      articleUrl: latestArticle.url,
      status: 'error',
      message: `Error de Generación con IA: ${errorMessage}`,
    });
    return { success: false, message: `Error de Generación con IA: ${errorMessage}` };
  }
  
  await addLogEntry({
    siteId: site.id,
    siteName: site.name,
    articleTitle: latestArticle.title,
    articleUrl: latestArticle.url,
    status: 'posting_to_facebook',
    message: `IA Generó: "${aiGeneratedText}". Intentando publicar en la Página de Facebook: ${site.facebookPageName}...`,
  });
  
  const facebookPostResult = await publishToFacebookPage(
    site, // Pass the whole site object
    aiGeneratedText,
    latestArticle.url
  );

  if (facebookPostResult.success && facebookPostResult.postId) {
    let facebookPostUrl = '';
    if (facebookPostResult.postId.includes('_') && !facebookPostResult.postId.startsWith('simulated_fb_post_')) {
      const ids = facebookPostResult.postId.split('_');
      if (ids.length >= 2) {
        const pageIdForUrl = ids[0];
        const postIdForUrl = ids[1];
        facebookPostUrl = `https://facebook.com/${pageIdForUrl}/posts/${postIdForUrl}`;
      } else {
         facebookPostUrl = `https://facebook.com/${facebookPostResult.postId}`;
      }
    } else if (site.facebookPageId && facebookPostResult.postId.startsWith('simulated_fb_post_')) {
      // Handle simulated posts if facebookPageId is available
       facebookPostUrl = `https://facebook.com/${site.facebookPageId}/posts/${facebookPostResult.postId.replace(/^simulated_fb_post_mock_token_|^simulated_fb_post_appid_missing_/, '')}`;
    }


    const finalLog = await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: latestArticle.title,
      articleUrl: latestArticle.url,
      status: 'posted',
      message: `Publicado exitosamente: "${aiGeneratedText}"`,
      facebookPostUrl: facebookPostUrl,
    });
    // Clear any previous error message on the site upon successful posting
    if (site.status === 'error' && site.errorMessage) {
      await updateSite(site.id, { status: 'monitoring', errorMessage: undefined });
    }
    return { success: true, message: `Publicado exitosamente en ${site.facebookPageName}.`, log: finalLog };
  } else {
    const errorLog = await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: latestArticle.title,
      articleUrl: latestArticle.url,
      status: 'error',
      message: `Error al Publicar en Facebook: ${facebookPostResult.error || 'Error desconocido'}`,
    });
    // Update site status to 'error' if posting fails
    // The publishToFacebookPage function already updates site status for token errors,
    // but we ensure it's updated for other Facebook API errors here too.
    if (site.status !== 'error' || site.errorMessage !== `Facebook API Error: ${facebookPostResult.error || 'Unknown error'}`) {
       await updateSite(site.id, { status: 'error', errorMessage: `Facebook Posting Error: ${facebookPostResult.error || 'Unknown error'}` });
    }
    return { success: false, message: `Error al publicar en Facebook: ${facebookPostResult.error || 'Error desconocido'}`, log: errorLog };
  }
}
