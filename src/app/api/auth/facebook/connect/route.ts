
// /src/app/api/auth/facebook/connect/route.ts
import {NextResponse, type NextRequest} from 'next/server';
import {redirect} from 'next/navigation';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const siteId = searchParams.get('siteId');

  console.log(`[CONNECT_FB] Received request for siteId: ${siteId}`);

  if (!siteId) {
    console.error('[CONNECT_FB] Error: Falta siteId para conectar Facebook.');
    return redirect('/dashboard?error=missing_site_id_for_facebook_connect&message=ID_del_sitio_requerido_para_conectar_con_Facebook.');
  }

  const facebookAppId = process.env.FACEBOOK_APP_ID;
  // const facebookAppSecret = process.env.FACEBOOK_APP_SECRET; // No se necesita aquí, solo en el callback
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  console.log(`[CONNECT_FB] Iniciando conexión para siteId: ${siteId}`);
  console.log(`[CONNECT_FB] FACEBOOK_APP_ID: ${facebookAppId ? 'Cargado (' + facebookAppId.substring(0,5) + '...)' : 'NO CARGADO o no accesible en process.env'}`);
  console.log(`[CONNECT_FB] FACEBOOK_REDIRECT_URI: ${redirectUri ? redirectUri : 'NO CARGADO o no accesible en process.env'}`);


  if (!facebookAppId || !redirectUri) {
    console.error('[CONNECT_FB] Error CRÍTICO: FACEBOOK_APP_ID o FACEBOOK_REDIRECT_URI no están configurados o no son accesibles en el entorno del servidor (process.env). Verifica la configuración de variables de entorno en tu plataforma de despliegue (ej. Netlify).');
    return redirect('/dashboard?error=facebook_config_missing_in_env&message=Configuracion_de_Facebook_incompleta_en_el_servidor.');
  }

  // Generar un token CSRF
  const csrfToken = crypto.randomBytes(32).toString('hex');

  // Guardar el token CSRF en una cookie httpOnly y segura
  cookies().set('facebook_csrf_token', csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Será true en Netlify si NODE_ENV es 'production'
    path: '/', 
    maxAge: 10 * 60, // 10 minutos en segundos
    sameSite: 'lax',
  });
  console.log('[CONNECT_FB] Token CSRF generado y cookie configurada (facebook_csrf_token).');

  const stateObject = {
    siteId: siteId,
    csrfToken: csrfToken,
  };
  const state = encodeURIComponent(JSON.stringify(stateObject));

  // Permisos necesarios.
  const scope = 'pages_show_list,pages_manage_posts,pages_read_engagement';

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${facebookAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}&response_type=code&display=popup`;
  
  console.log(`[CONNECT_FB] Redirigiendo a URL de autorización de Facebook (sin incluir client_secret ni tokens): ${authUrl.substring(0, authUrl.indexOf('&state=') + 7)}...`); // Log corto para no exponer el estado completo
  return redirect(authUrl);
}
