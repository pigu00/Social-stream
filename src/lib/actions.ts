
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
  pageId: string,
  pageAccessToken: string,
  message: string,
  link?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  
  const appId = process.env.FACEBOOK_APP_ID;

  if (!appId) {
    const errorMsg = 'Facebook App ID (FACEBOOK_APP_ID) no está configurado en las variables de entorno. No se pueden realizar llamadas reales a la API.';
    console.error(errorMsg);
    // Forzamos la simulación si el App ID no está, ya que el SDK probablemente fallaría.
    console.log('Forzando simulación de publicación en Facebook debido a FACEBOOK_APP_ID ausente.');
    await new Promise(resolve => setTimeout(resolve, 1500));
    const mockPostId = `simulated_fb_post_appid_missing_${Date.now()}`;
    return { success: true, postId: mockPostId };
  }
  
  if (!pageId || !pageAccessToken || pageAccessToken.startsWith('mock-access-token')) {
     const warningMsg = `Token de acceso de página de Facebook es de prueba, nulo o el ID de página falta. Token: "${pageAccessToken ? pageAccessToken.substring(0,15)+'...' : 'N/A'}", Page ID: "${pageId}". Se procederá con simulación.`;
     console.warn(warningMsg);
     await new Promise(resolve => setTimeout(resolve, 1500)); 
     const mockPostId = `simulated_fb_post_mock_token_${Date.now()}`;
     return { success: true, postId: mockPostId };
  }

  console.log(`Intentando publicar en Facebook Page ID: ${pageId} con token REAL (primeros 15 chars): ${pageAccessToken.substring(0,15)}...`);
  console.log(`Mensaje: "${message}"`);
  if (link) console.log(`Enlace: ${link}`);
  
  try {
    // Inicializar la API de Facebook con el Page Access Token.
    // Esto configura la instancia API por defecto que usará el objeto Page.
    const api = FacebookAdsApi.init(pageAccessToken);
    if (process.env.NODE_ENV === 'development') {
      api.setDebug(true); // Habilita logs de debug del SDK en desarrollo
    }
    
    const pageNode = new FacebookPageSdk(pageId);
    const params: Record<string, any> = { message };
    if (link) {
      params.link = link;
    }

    console.log(`Intentando publicar en Facebook Page ID: ${pageId} via SDK con params:`, params);
    // El primer argumento de createFeed son los campos que quieres que la API devuelva.
    // Pedir 'id' es común para obtener el ID del post creado.
    const response = await pageNode.createFeed(['id'], params); 
    
    console.log('Respuesta de la API de Facebook (SDK):', response);

    if (response && response.id) {
      console.log('Publicado exitosamente en Facebook. Post ID:', response.id);
      // response.id usualmente es en formato "pageId_postId"
      return { success: true, postId: response.id };
    } else {
      console.error('Fallo al publicar en Facebook usando SDK. Respuesta inesperada:', response);
      const errorMessage = 'Fallo al publicar en Facebook (SDK). Respuesta inesperada de la API.';
      return { success: false, error: errorMessage };
    }

  } catch (apiError: any) {
    console.error('Error de API de Facebook (SDK):', apiError.message || apiError);
    let errorMessage = 'Error desconocido al publicar en Facebook (SDK).';
    if (apiError.isAxiosError && apiError.response && apiError.response.data && apiError.response.data.error) { // Esto es más para 'fetch' directo
      errorMessage = apiError.response.data.error.message || JSON.stringify(apiError.response.data.error);
    } else if (apiError._response && apiError._response.error) { // El SDK puede tener su propia estructura de error
        errorMessage = apiError._response.error.message || JSON.stringify(apiError._response.error);
    } else if (apiError.message) {
      errorMessage = apiError.message;
    }
    
    // Si el error indica un problema de token (ej. expirado, inválido), actualiza el estado del sitio.
    if (errorMessage.toLowerCase().includes("session has expired") || 
        errorMessage.toLowerCase().includes("invalid oauth access token") ||
        errorMessage.toLowerCase().includes("error validating access token")) {
      await updateSite(pageId, { // Asumiendo que pageId puede usarse para encontrar el siteId si están vinculados 1 a 1 o buscar por facebookPageId
        status: 'error', 
        errorMessage: `Facebook Token Error: ${errorMessage}. Por favor, reconecta la página.`,
        // Potencialmente limpiar el token aquí:
        // facebookPageAccessToken: undefined, 
        // facebookPageName: undefined,
        // facebookPageId: undefined, // O solo el token
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


  const mockArticle = {
    title: `Artículo de Prueba desde ${site.name} a las ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    content: `Este es el contenido de prueba para el artículo de ${site.name}. Incluye detalles sobre varios temas interesantes que los lectores podrían encontrar atractivos. El objetivo es generar una publicación de Facebook convincente para esta nueva pieza de información. Este artículo es solo una simulación.`,
    url: `${site.url}/mock-article-${Date.now()}`,
  };

  await addLogEntry({
    siteId: site.id,
    siteName: site.name,
    articleTitle: mockArticle.title,
    articleUrl: mockArticle.url,
    status: 'generating_post',
    message: 'Intentando generar contenido para la publicación de Facebook usando IA...',
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
    console.error('Error en Generación de Post con IA:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido durante la generación con IA.';
    await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: mockArticle.title,
      articleUrl: mockArticle.url,
      status: 'error',
      message: `Error de Generación con IA: ${errorMessage}`,
    });
    return { success: false, message: `Error de Generación con IA: ${errorMessage}` };
  }
  
  await addLogEntry({
    siteId: site.id,
    siteName: site.name,
    articleTitle: mockArticle.title,
    articleUrl: mockArticle.url,
    status: 'posting_to_facebook',
    message: `IA Generó: "${aiGeneratedText}". Intentando publicar en la Página de Facebook: ${site.facebookPageName}...`,
  });

  // Aquí usamos el pageAccessToken real que debería estar almacenado en el objeto 'site'
  // después de un flujo de OAuth exitoso.
  const facebookPostResult = await publishToFacebookPage(
    site.facebookPageId,
    site.facebookPageAccessToken,
    aiGeneratedText,
    mockArticle.url
  );

  if (facebookPostResult.success && facebookPostResult.postId) {
    let facebookPostUrl = '';
    // Los IDs de post reales de Facebook suelen ser pageId_postId
    if (facebookPostResult.postId.includes('_') && !facebookPostResult.postId.startsWith('simulated_fb_post_')) {
      const ids = facebookPostResult.postId.split('_');
      // Asegurarse de que el split produjo al menos dos partes
      if (ids.length >= 2) {
        const pageIdForUrl = ids[0];
        const postIdForUrl = ids[1];
        facebookPostUrl = `https://facebook.com/${pageIdForUrl}/posts/${postIdForUrl}`;
      } else {
         // Si el formato no es el esperado, usar un enlace genérico al ID del post
         facebookPostUrl = `https://facebook.com/${facebookPostResult.postId}`;
      }
    } else {
      // Para IDs simulados o formatos inesperados
      facebookPostUrl = `https://facebook.com/${site.facebookPageId}/posts/${facebookPostResult.postId.replace(/^sim_real_fb_post_|^simulated_fb_post_/, '')}`;
    }

    const finalLog = await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: mockArticle.title,
      articleUrl: mockArticle.url,
      status: 'posted',
      message: `Publicado exitosamente: "${aiGeneratedText}"`,
      facebookPostUrl: facebookPostUrl,
    });
    return { success: true, message: `Publicado exitosamente en ${site.facebookPageName}.`, log: finalLog };
  } else {
    const errorLog = await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: mockArticle.title,
      articleUrl: mockArticle.url,
      status: 'error',
      message: `Error al Publicar en Facebook: ${facebookPostResult.error || 'Error desconocido'}`,
    });
    // También actualizamos el estado del sitio a 'error' si la publicación falla
    await updateSite(site.id, { status: 'error', errorMessage: `Facebook Posting Error: ${facebookPostResult.error || 'Unknown error'}` });
    return { success: false, message: `Error al publicar en Facebook: ${facebookPostResult.error || 'Error desconocido'}`, log: errorLog };
  }
}

    