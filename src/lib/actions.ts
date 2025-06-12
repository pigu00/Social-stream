
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
  revalidatePath('/dashboard'); // Asegura que los cambios se reflejen en el dashboard
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

// La función connectFacebookPage anterior se elimina.
// La conexión real (obtención de page ID, name y token) ahora
// se gestionaría a través del flujo OAuth y el endpoint de callback
// /api/auth/facebook/callback, que luego llamaría a updateSite.

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
 */
async function publishToFacebookPage(
  pageId: string,
  pageAccessToken: string, // Este debería ser un token de acceso de página REAL
  message: string,
  link?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET; // No siempre es necesario para publicar si tienes un page access token válido

  if (!appId) { // App Secret no es estrictamente necesario para este API call específico si tienes un token de página
    const errorMsg = 'Facebook App ID no está configurado. No se pueden realizar llamadas reales a la API.';
    console.error(errorMsg);
    // Para la demo, simularemos si las credenciales no están, pero registramos el error.
    // En producción, podrías retornar { success: false, error: errorMsg } aquí.
  }
  
  if (!pageAccessToken || pageAccessToken.startsWith('mock-access-token')) {
     const warningMsg = `Se está usando un token de acceso de página FALSO o NULO: "${pageAccessToken}". Las llamadas reales a la API de Facebook fallarán o no funcionarán. Reemplaza con un token genuino obtenido vía OAuth.`;
     console.warn(warningMsg);
     // Si el token es claramente un mock, forzamos la simulación para evitar errores con la API real.
     if (pageAccessToken.startsWith('mock-access-token') || !pageAccessToken) {
        console.log('Forzando simulación de publicación en Facebook debido a token de acceso de página de prueba o ausente.');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simula delay de red
        const mockPostId = `simulated_fb_post_${Date.now()}`;
        return { success: true, postId: mockPostId };
     }
  }
  if (!pageId) {
    return { success: false, error: 'Facebook Page ID no disponible para este sitio.' };
  }

  console.log(`Intentando publicar en Facebook Page ID: ${pageId} con token: ${pageAccessToken ? pageAccessToken.substring(0,15) + '...' : 'N/A'}`);
  console.log(`Mensaje: "${message}"`);
  if (link) console.log(`Enlace: ${link}`);
  
  try {
    // Inicializar la API de Facebook. Esto podría hacerse una vez globalmente
    // o antes de cada conjunto de llamadas, dependiendo de tu estructura.
    // FacebookAdsApi.init(pageAccessToken); // OJO: El SDK puede preferir inicializar con app secret para ciertas cosas,
                                         // pero para publicar en una página, el pageAccessToken es clave.
    // Si usas `facebook-nodejs-business-sdk`, sería algo así:
    // const api = FacebookAdsApi.init(pageAccessToken);
    // if (process.env.NODE_ENV === 'development') { // O alguna otra variable para habilitar debug
    //   api.setDebug(true);
    // }
    // const pageNode = new FacebookPageSdk(pageId);
    // const params: Record<string, any> = { message };
    // if (link) {
    //   params.link = link;
    // }
    // const response = await pageNode.createFeed([], params); // El primer [] es para campos que quieres que devuelva
    
    // console.log('Respuesta de Facebook API:', response);

    // if (response && response.id) {
    //   console.log('Publicado exitosamente en Facebook. Post ID:', response.id);
    //   return { success: true, postId: response.id };
    // } else {
    //   console.error('Fallo al publicar en Facebook. Respuesta:', response);
    //   const errorMessage = response?.error?.message || 'Fallo al publicar en Facebook. Verifica la respuesta de la API.';
    //   return { success: false, error: errorMessage };
    // }

    // --- SIMULACIÓN TEMPORAL HASTA QUE EL SDK REAL SE DESCOMENTE Y CONFIGURE ---
    // ¡¡¡RECUERDA DESCOMENTAR EL CÓDIGO DEL SDK DE ARRIBA Y ELIMINAR ESTA SIMULACIÓN CUANDO ESTÉS LISTO!!!
    console.warn('USANDO SIMULACIÓN para publishToFacebookPage. Descomenta el código del SDK para llamadas reales.');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simula delay de red
    const mockPostId = `sim_real_fb_post_${Date.now()}`;
    console.log(`Simulación de publicación exitosa en Facebook. Post ID: ${mockPostId}`);
    return { success: true, postId: mockPostId };
    // --- FIN DE LA SIMULACIÓN TEMPORAL ---

  } catch (apiError: any) {
    console.error('Error de API de Facebook:', apiError.message || apiError);
    let errorMessage = 'Error desconocido al publicar en Facebook.';
    // El SDK facebook-nodejs-business-sdk puede arrojar errores con una estructura específica
    if (apiError.isAxiosError && apiError.response && apiError.response.data && apiError.response.data.error) {
      errorMessage = apiError.response.data.error.message || JSON.stringify(apiError.response.data.error);
    } else if (apiError.message) {
      errorMessage = apiError.message;
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

  const facebookPostResult = await publishToFacebookPage(
    site.facebookPageId,
    site.facebookPageAccessToken, // Ahora esto podría ser un token real si el flujo OAuth funcionó
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
      message: `Publicado exitosamente: "${aiGeneratedText}"`,
      facebookPostUrl: `https://facebook.com/${site.facebookPageId}/posts/${facebookPostResult.postId.replace(/^sim_real_fb_post_|^simulated_fb_post_/, '')}`,
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
