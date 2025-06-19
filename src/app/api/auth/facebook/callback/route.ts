
// /src/app/api/auth/facebook/callback/route.ts
import {NextResponse, type NextRequest} from 'next/server';
import {redirect} from 'next/navigation';
import { cookies } from 'next/headers';
import { updateSite } from '@/lib/actions'; 

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  
  const fbError = searchParams.get('error');
  const fbErrorCode = searchParams.get('error_code');
  const fbErrorDescription = searchParams.get('error_description');
  const fbErrorMessage = searchParams.get('error_message');

  console.log('[CALLBACK_FB] Recibida solicitud de callback de Facebook.');
  console.log(`[CALLBACK_FB] Params: code=${code ? 'presente' : 'ausente'}, state=${stateParam ? 'presente' : 'ausente'}`);
  console.log(`[CALLBACK_FB] Error Params: fbError=${fbError || 'ninguno'}, fbErrorCode=${fbErrorCode || 'N/A'}, fbErrorDescription=${fbErrorDescription || 'N/A'}, fbErrorMessage=${fbErrorMessage || 'N/A'}`);


  if (fbError) {
    const errorMessage = fbErrorDescription || fbErrorMessage || fbError || 'Error desconocido de Facebook durante la autorización.';
    console.error(`[CALLBACK_FB] Error en callback de Facebook: ${fbError} (Code: ${fbErrorCode || 'N/A'}) - ${errorMessage}`);
    return redirect(`/dashboard?error=facebook_auth_error_from_provider&message=${encodeURIComponent(errorMessage)}`);
  }

  if (!code || !stateParam) {
    console.error('[CALLBACK_FB] Error: Código o estado faltante en el callback de Facebook.');
    return redirect('/dashboard?error=facebook_auth_failed_missing_params&message=Parametros_de_autenticacion_de_Facebook_incompletos.');
  }
  console.log('[CALLBACK_FB] Código de autorización recibido (primeros 15 chars):', code.substring(0, 15) + "...");
  console.log('[CALLBACK_FB] Parámetro de estado recibido (completo):', stateParam);


  // PASO 1: Verificar el token CSRF
  const storedCsrfToken = cookies().get('facebook_csrf_token')?.value;
  console.log('[CALLBACK_FB] Token CSRF almacenado en cookie (facebook_csrf_token):', storedCsrfToken ? storedCsrfToken.substring(0,10) + "..." : "NO ENCONTRADO");
  
  cookies().delete('facebook_csrf_token'); 
  console.log('[CALLBACK_FB] Cookie facebook_csrf_token eliminada.');


  let originalState: { siteId: string; csrfToken: string };
  try {
    originalState = JSON.parse(decodeURIComponent(stateParam));
    console.log('[CALLBACK_FB] Objeto de estado decodificado y parseado:', originalState);
  } catch (e: any) {
    console.error('[CALLBACK_FB] Error: Estado inválido o malformado al parsear JSON.', e.message);
    return redirect('/dashboard?error=facebook_auth_failed_invalid_state_format&message=Estado_de_autenticacion_de_Facebook_invalido.');
  }
  
  const { siteId, csrfToken: receivedCsrfToken } = originalState;
  console.log(`[CALLBACK_FB] Del estado: siteId=${siteId}, receivedCsrfToken=${receivedCsrfToken ? receivedCsrfToken.substring(0,10) + "..." : "NO ENCONTRADO"}`);


  if (!storedCsrfToken || !receivedCsrfToken || storedCsrfToken !== receivedCsrfToken) {
    console.error(`[CALLBACK_FB] Error: Fallo de verificación CSRF. Stored: ${storedCsrfToken || 'null'}, Received: ${receivedCsrfToken || 'null'}`);
    return redirect('/dashboard?error=facebook_auth_failed_csrf_mismatch&message=Fallo_de_seguridad_CSRF_al_conectar_con_Facebook.');
  }
  console.log('[CALLBACK_FB] Verificación CSRF exitosa.');


  const facebookAppId = process.env.FACEBOOK_APP_ID;
  const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  console.log(`[CALLBACK_FB] Leyendo variables de entorno para intercambio de token:`);
  console.log(`[CALLBACK_FB] FACEBOOK_APP_ID: ${facebookAppId || 'NO CONFIGURADO'}`);
  console.log(`[CALLBACK_FB] FACEBOOK_APP_SECRET: ${facebookAppSecret ? 'CARGADO (oculto)' : 'NO CONFIGURADO'}`);
  console.log(`[CALLBACK_FB] FACEBOOK_REDIRECT_URI: ${redirectUri || 'NO CONFIGURADO'}`);


  if (!facebookAppId || !facebookAppSecret || !redirectUri) {
    console.error('[CALLBACK_FB] Error: FACEBOOK_APP_ID, FACEBOOK_APP_SECRET o FACEBOOK_REDIRECT_URI no configurados en .env (o no accesibles en el entorno del servidor).');
    return redirect('/dashboard?error=server_config_incomplete_for_facebook_token_exchange&message=Configuracion_del_servidor_incompleta_para_Facebook.');
  }

  try {
    // PASO 2: Intercambiar el código de autorización por un User Access Token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token`;
    const tokenParams = new URLSearchParams({
      client_id: facebookAppId,
      redirect_uri: redirectUri,
      client_secret: facebookAppSecret,
      code: code,
    });

    console.log(`[CALLBACK_FB] Solicitando User Access Token a: ${tokenUrl} con redirect_uri: ${redirectUri} y code (primeros 15): ${code.substring(0,15)}...`);
    const tokenResponse = await fetch(`${tokenUrl}?${tokenParams.toString()}`, { method: 'GET' });
    const tokenData = await tokenResponse.json();
    console.log('[CALLBACK_FB] Respuesta completa de la API de token de usuario:', JSON.stringify(tokenData, null, 2));


    if (tokenData.error || !tokenData.access_token) {
      const errorDetail = tokenData.error ? `${tokenData.error.message} (Code: ${tokenData.error.code}, Type: ${tokenData.error.type})` : 'Respuesta inesperada sin access_token.';
      console.error(`[CALLBACK_FB] Error al obtener User Access Token de Facebook: ${errorDetail}`, tokenData.error);
      return redirect(`/dashboard?error=fb_user_token_exchange_failed&message=${encodeURIComponent(`Error_intercambiando_codigo_por_token_de_usuario_FB:_${errorDetail}`)}`);
    }
    const userAccessToken = tokenData.access_token;
    console.log('[CALLBACK_FB] User Access Token obtenido (primeros 15 chars):', userAccessToken.substring(0,15) + '...');

    // PASO 3: Usar el User Access Token para obtener las Páginas del usuario y sus Page Access Tokens
    const pagesUrl = `https://graph.facebook.com/me/accounts?access_token=${userAccessToken}&fields=id,name,access_token,tasks&limit=25`;
    
    console.log(`[CALLBACK_FB] Solicitando páginas a (token oculto): ${pagesUrl.substring(0, pagesUrl.indexOf('access_token=') + 'access_token='.length)}...`);
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();
    console.log('[CALLBACK_FB] Respuesta completa de la API de páginas:', JSON.stringify(pagesData, null, 2));


    if (pagesData.error || !pagesData.data) {
      const errorDetail = pagesData.error ? `${pagesData.error.message} (Code: ${pagesData.error.code}, Type: ${pagesData.error.type})` : 'Respuesta inesperada o sin datos de páginas.';
      console.error(`[CALLBACK_FB] Error al obtener páginas de Facebook: ${errorDetail}`, pagesData.error);
      return redirect(`/dashboard?error=fb_pages_fetch_failed&message=${encodeURIComponent(`Error_obteniendo_paginas_de_FB:_${errorDetail}`)}`);
    }
    console.log(`[CALLBACK_FB] Páginas obtenidas de Facebook: ${pagesData.data.length} página(s).`);
    if (pagesData.data.length > 0) {
        pagesData.data.forEach((page: any, index: number) => {
            console.log(`[CALLBACK_FB] Página ${index + 1}: ID=${page.id}, Name=${page.name}, Tasks=${page.tasks ? page.tasks.join(', ') : 'N/A'}, AccessTokenPresent=${!!page.access_token}`);
        });
    }


    // PASO 4: Seleccionar la Página adecuada
    const connectablePage = pagesData.data?.find((page: any) => 
      page.tasks && page.tasks.includes('CREATE_CONTENT')
    );

    if (!connectablePage) {
      let noPageMessage = 'No se encontraron páginas de Facebook conectables.';
      if (pagesData.data && pagesData.data.length > 0) {
        console.warn('[CALLBACK_FB] Ninguna de las páginas tiene el permiso CREATE_CONTENT. Páginas recibidas:', pagesData.data.map((p:any) => ({id: p.id, name: p.name, tasks: p.tasks })));
        noPageMessage = 'Ninguna de tus páginas de Facebook tiene el permiso necesario (CREATE_CONTENT) para publicar. Verifica los permisos de la página en Facebook o tu rol en ella.';
      } else {
        console.warn('[CALLBACK_FB] No se administran páginas o no se otorgó el permiso para verlas.');
        noPageMessage = 'No administras ninguna página de Facebook o no se otorgó el permiso para verlas.';
      }
      return redirect(`/dashboard?error=no_connectable_facebook_pages_found&message=${encodeURIComponent(noPageMessage)}`);
    }

    const pageId = connectablePage.id;
    const pageName = connectablePage.name;
    const pageAccessToken = connectablePage.access_token;

    console.log(`[CALLBACK_FB] Página de Facebook seleccionada: "${pageName}" (ID: ${pageId})`);
    console.log('[CALLBACK_FB] Page Access Token obtenido (primeros 15 chars):', pageAccessToken.substring(0,15) + '...');

    // PASO 5: Actualizar la información del sitio
    console.log(`[CALLBACK_FB] Intentando actualizar el sitio ${siteId} con la información de la página de Facebook...`);
    const updatedSite = await updateSite(siteId, {
      facebookPageId: pageId,
      facebookPageName: pageName,
      facebookPageAccessToken: pageAccessToken, 
      status: 'monitoring', 
      errorMessage: null, 
    });

    if (!updatedSite) {
      console.error(`[CALLBACK_FB] Error al actualizar el sitio ${siteId} después de la autenticación de Facebook en la base de datos.`);
      return redirect('/dashboard?error=site_update_failed_after_fb_auth_in_db&message=Error_actualizando_sitio_en_BD_tras_auth_FB.');
    }

    console.log(`[CALLBACK_FB] Página de Facebook "${pageName}" (ID: ${pageId}) conectada exitosamente al sitio ${siteId}. Redirigiendo al dashboard...`);
    return redirect('/dashboard?success=facebook_page_connected&message=Pagina_de_Facebook_conectada_exitosamente!');

  } catch (exception: any) {
    console.error('[CALLBACK_FB] Excepción general durante el callback de Facebook:', exception);
    const message = exception.message || 'Error desconocido durante el proceso de callback de Facebook.';
    if (exception.cause) console.error('[CALLBACK_FB] Causa de la excepción:', exception.cause);
    return redirect(`/dashboard?error=facebook_callback_exception&message=${encodeURIComponent(message)}`);
  }
}

