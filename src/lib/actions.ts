
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
 * Falls back to simulation if the token is a mock token or missing, or if FACEBOOK_APP_ID is not set.
 */
async function publishToFacebookPage(
  site: WordPressSite,
  message: string,
  link?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  
  const { id: siteId, facebookPageId, facebookPageAccessToken, name: siteName } = site;
  const appId = process.env.FACEBOOK_APP_ID;

  console.log(`[publishToFacebookPage for "${siteName}"] Iniciando proceso de publicación.`);
  console.log(`[publishToFacebookPage for "${siteName}"] FACEBOOK_APP_ID: ${appId ? 'Cargado' : 'NO CARGADO - Se forzará simulación.'}`);
  console.log(`[publishToFacebookPage for "${siteName}"] Facebook Page ID: ${facebookPageId}`);
  console.log(`[publishToFacebookPage for "${siteName}"] Facebook Page Access Token (primeros 10 chars): ${facebookPageAccessToken ? facebookPageAccessToken.substring(0, 10) + '...' : 'NO PRESENTE'}`);
  console.log(`[publishToFacebookPage for "${siteName}"] Mensaje a publicar: "${message}"`);
  if (link) console.log(`[publishToFacebookPage for "${siteName}"] Enlace: ${link}`);


  if (!appId) {
    const errorMsg = `[publishToFacebookPage for "${siteName}"] FACEBOOK_APP_ID no está configurado. Forzando simulación.`;
    console.warn(errorMsg);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    return { success: true, postId: `simulated_fb_post_appid_missing_${Date.now()}` };
  }
  
  if (!facebookPageId || !facebookPageAccessToken || facebookPageAccessToken.startsWith('mock-access-token')) {
     const reason = !facebookPageId ? "Falta Page ID" : !facebookPageAccessToken ? "Falta Page Access Token" : "Usando mock Page Access Token";
     const warningMsg = `[publishToFacebookPage for "${siteName}"] ${reason}. Procediendo con simulación.`;
     console.warn(warningMsg);
     await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
     return { success: true, postId: `simulated_fb_post_mock_token_${Date.now()}` };
  }

  console.log(`[publishToFacebookPage for "${siteName}"] Intentando publicación REAL en Facebook Page ID: ${facebookPageId}`);
  
  try {
    const api = FacebookAdsApi.init(facebookPageAccessToken);
    // Descomentar si se necesita debugging extensivo del SDK, puede ser muy verboso.
    // if (process.env.NODE_ENV === 'development') {
    //   api.setDebug(true); 
    // }
    
    const pageNode = new FacebookPageSdk(facebookPageId);
    const params: Record<string, any> = { message };
    if (link) {
      params.link = link;
    }

    console.log(`[publishToFacebookPage for "${siteName}"] Llamando a pageNode.createFeed() con params:`, params);
    // El primer argumento de createFeed son los campos que quieres que devuelva la API. 'id' es el ID del post.
    const response = await pageNode.createFeed(['id'], params); 
    
    console.log(`[publishToFacebookPage for "${siteName}"] Respuesta de la API de Facebook (SDK):`, JSON.stringify(response, null, 2));

    if (response && response.id) {
      console.log(`[publishToFacebookPage for "${siteName}"] Publicado exitosamente en Facebook. Post ID (del SDK): ${response.id}`);
      // El SDK devuelve solo el ID del post (ej: 123456789012345), no pageId_postId
      // Construimos el fullPostId para URLs y consistencia.
      const fullPostId = `${facebookPageId}_${response.id}`;
      console.log(`[publishToFacebookPage for "${siteName}"] Full Post ID construido: ${fullPostId}`);
      return { success: true, postId: fullPostId };
    } else {
      const errorMessage = `Fallo al publicar en Facebook (SDK). Respuesta inesperada o sin ID de post.`;
      console.error(`[publishToFacebookPage for "${siteName}"] ${errorMessage} Respuesta completa: ${JSON.stringify(response, null, 2)}`);
      await updateSite(siteId, { status: 'error', errorMessage: "Respuesta inesperada de Facebook al publicar." });
      return { success: false, error: "Respuesta inesperada de la API de Facebook." };
    }

  } catch (apiError: any) {
    console.error(`[publishToFacebookPage for "${siteName}"] Ha ocurrido un error con el SDK de Facebook:`, apiError);
    
    let userFriendlyMessage = "Error desconocido al publicar en Facebook.";
    let detailedErrorMessage = "Error desconocido con el SDK.";

    if (apiError.isAxiosError && apiError.response && apiError.response.data && apiError.response.data.error) {
        // Esto es específico para errores devueltos por el SDK de Facebook cuando usa Axios internamente.
        const fbError = apiError.response.data.error;
        detailedErrorMessage = `Error API FB: ${fbError.message} (Code: ${fbError.code}, Type: ${fbError.type}, Subcode: ${fbError.error_subcode}, Trace: ${fbError.fbtrace_id})`;
        userFriendlyMessage = `Error de Facebook: ${fbError.message}`;
        console.error(`[publishToFacebookPage for "${siteName}"] Error detallado de API de Facebook (SDK):`, fbError);

        const lowerFbErrorMessage = fbError.message?.toLowerCase() || "";
        // Códigos de sub-error comunes para problemas de token/permisos
        const tokenErrorSubcodes = [458, 459, 460, 463, 464, 467]; 
        if (lowerFbErrorMessage.includes("session has expired") ||
            lowerFbErrorMessage.includes("invalid oauth access token") ||
            lowerFbErrorMessage.includes("error validating access token") ||
            fbError.type === "OAuthException" || 
            (fbError.error_subcode && tokenErrorSubcodes.includes(fbError.error_subcode))
            ) {
          userFriendlyMessage = `Token de Facebook inválido/expirado o permisos insuficientes. Por favor, reconecta la página. (Detalle: ${fbError.message})`;
          await updateSite(siteId, { 
            status: 'error', 
            errorMessage: userFriendlyMessage,
          });
        } else if (fbError.code === 10 && (fbError.error_subcode === 1363030 || fbError.error_subcode === 200)) { // Code 10: Permission denied. Subcode 200 puede ser para permisos específicos
             userFriendlyMessage = `Permiso denegado por Facebook: ${fbError.message}. Asegúrate de que la app tiene el permiso 'pages_manage_posts' y el usuario tiene rol en la página.`;
             await updateSite(siteId, { status: 'error', errorMessage: userFriendlyMessage});
        } else {
          // Para otros errores de la API de Facebook
          await updateSite(siteId, { status: 'error', errorMessage: userFriendlyMessage });
        }
    } else if (apiError.message) { // Errores genéricos del SDK o de la lógica
        detailedErrorMessage = apiError.message;
        userFriendlyMessage = apiError.message; 
        console.error(`[publishToFacebookPage for "${siteName}"] Error general (no de API FB directamente) con el SDK: ${apiError.message}`);
        await updateSite(siteId, { status: 'error', errorMessage: `Error SDK: ${userFriendlyMessage.substring(0, 200)}` });
    } else {
        console.error(`[publishToFacebookPage for "${siteName}"] Error desconocido y no estructurado con el SDK de Facebook.`);
        await updateSite(siteId, { status: 'error', errorMessage: userFriendlyMessage });
    }
    
    return { success: false, error: detailedErrorMessage }; // Devolver el error técnico para el log
  }
}


export async function simulateNewArticleAndPost(siteIdParam: string): Promise<{success: boolean; message: string; log?: ActivityLog}> {
  const site = sites.find(s => s.id === siteIdParam);
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
    console.log(`[simulateNewArticleAndPost for "${site.name}"] Analizando RSS: ${site.rssFeedUrl}`);
    const feed = await rssParser.parseURL(site.rssFeedUrl);
    if (!feed.items || feed.items.length === 0) {
      const errorMsg = `Error al obtener RSS: El feed de ${site.name} está vacío o no contiene artículos.`;
      console.error(`[simulateNewArticleAndPost for "${site.name}"] ${errorMsg}`);
      await addLogEntry({ siteId: site.id, siteName: site.name, status: 'error', message: errorMsg });
      return { success: false, message: `El feed RSS de ${site.name} está vacío.` };
    }
    
    const firstItem = feed.items[0];
    // Priorizar 'content:encoded', luego 'content', luego 'contentSnippet', y finalmente 'description'
    const articleContentRaw = firstItem['content:encoded'] || firstItem.content || firstItem.contentSnippet || firstItem.description || 'No content available.';
    // Remover etiquetas HTML básicas para la IA y limitar longitud
    const articleContentCleaned = articleContentRaw.replace(/<[^>]*>?/gm, '').substring(0, 10000); 
    
    latestArticle = {
      title: firstItem.title || 'Untitled Article',
      content: articleContentCleaned, 
      url: firstItem.link || site.url,
    };
    console.log(`[simulateNewArticleAndPost for "${site.name}"] Artículo RSS obtenido: "${latestArticle.title}"`);
    await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: latestArticle.title,
      articleUrl: latestArticle.url,
      status: 'info',
      message: `Último artículo obtenido de RSS: "${latestArticle.title}"`,
    });

  } catch (error: any) {
    const errorMessage = error.message || 'Error desconocido al procesar el feed RSS.';
    console.error(`[simulateNewArticleAndPost for "${site.name}"] Error al obtener o analizar el feed RSS: ${errorMessage}`, error);
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
      articleContent: latestArticle.content,
      articleUrl: latestArticle.url,
    };
    console.log(`[simulateNewArticleAndPost for "${site.name}"] Enviando a IA para generar post. Título: ${latestArticle.title}`);
    const aiResult = await generateFacebookPost(aiInput);
    aiGeneratedText = aiResult.facebookPostText;
    console.log(`[simulateNewArticleAndPost for "${site.name}"] IA generó: "${aiGeneratedText}"`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido durante la generación con IA.';
    console.error(`[simulateNewArticleAndPost for "${site.name}"] Error en Generación de Post con IA: ${errorMessage}`, error);
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
  
  const logMessageForPosting = `IA Generó: "${aiGeneratedText.substring(0, 100)}...". Intentando publicar en la Página de Facebook: ${site.facebookPageName}...`;
  await addLogEntry({
    siteId: site.id,
    siteName: site.name,
    articleTitle: latestArticle.title,
    articleUrl: latestArticle.url,
    status: 'posting_to_facebook',
    message: logMessageForPosting,
  });
  
  const facebookPostResult = await publishToFacebookPage(
    site,
    aiGeneratedText,
    latestArticle.url
  );

  if (facebookPostResult.success && facebookPostResult.postId) {
    let facebookPostUrl = '';
    // facebookPostResult.postId ahora es pageId_postId
    if (site.facebookPageId && facebookPostResult.postId && !facebookPostResult.postId.startsWith('simulated_fb_post_')) {
      // Construir la URL como https://facebook.com/PAGE_ID/posts/POST_ID_WITHOUT_PAGE_ID_PREFIX
      const parts = facebookPostResult.postId.split('_');
      if (parts.length === 2) {
        facebookPostUrl = `https://facebook.com/${parts[0]}/posts/${parts[1]}`;
      } else {
        // Si el formato no es el esperado, se usa el postId tal cual. Puede ser una URL directa si Facebook cambia algo.
        facebookPostUrl = `https://facebook.com/${facebookPostResult.postId}`; 
      }
    } else if (site.facebookPageId && facebookPostResult.postId.startsWith('simulated_fb_post_')) {
       const simulatedIdPart = facebookPostResult.postId.replace(/^simulated_fb_post_mock_token_|^simulated_fb_post_appid_missing_/, '');
       facebookPostUrl = `https://facebook.com/${site.facebookPageId}/posts/${simulatedIdPart}`; // Para simulados, puede ser un ID ficticio
    }


    const finalLog = await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: latestArticle.title,
      articleUrl: latestArticle.url,
      status: 'posted',
      message: `Publicado exitosamente: "${aiGeneratedText.substring(0, 100)}..."`,
      facebookPostUrl: facebookPostUrl,
    });
    if (site.status === 'error' && site.errorMessage) { // Si estaba en error y ahora funciona, lo limpiamos.
      await updateSite(site.id, { status: 'monitoring', errorMessage: undefined });
    }
    console.log(`[simulateNewArticleAndPost for "${site.name}"] Publicación exitosa. URL del Post: ${facebookPostUrl}`);
    return { success: true, message: `Publicado exitosamente en ${site.facebookPageName}.`, log: finalLog };
  } else {
    const errorMsg = `Error al Publicar en Facebook: ${facebookPostResult.error || 'Error desconocido'}`;
    const errorLog = await addLogEntry({
      siteId: site.id,
      siteName: site.name,
      articleTitle: latestArticle.title,
      articleUrl: latestArticle.url,
      status: 'error',
      message: errorMsg,
    });
    // La función publishToFacebookPage ya actualiza el estado del sitio para errores de token/API.
    console.error(`[simulateNewArticleAndPost for "${site.name}"] ${errorMsg}`);
    return { success: false, message: `Error al publicar en Facebook: ${facebookPostResult.error || 'Error desconocido'}`, log: errorLog };
  }
}
    