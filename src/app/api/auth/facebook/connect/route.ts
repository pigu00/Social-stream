
// /src/app/api/auth/facebook/connect/route.ts
import {NextResponse, type NextRequest} from 'next/server';
import {redirect} from 'next/navigation';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const siteId = searchParams.get('siteId');

  if (!siteId) {
    console.error('[CONNECT_FB] Error: Falta siteId para conectar Facebook.');
    return redirect('/dashboard?error=missing_site_id_for_facebook_connect&message=ID_del_sitio_requerido_para_conectar_con_Facebook.');
  }

  const facebookAppId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  console.log(`[CONNECT_FB] Iniciando conexión para siteId: ${siteId}`);
  console.log(`[CONNECT_FB] FACEBOOK_APP_ID: ${facebookAppId ? 'Cargado' : 'NO CARGADO'}`);
  console.log(`[CONNECT_FB] FACEBOOK_REDIRECT_URI: ${redirectUri ? redirectUri : 'NO CARGADO'}`);


  if (!facebookAppId || !redirectUri) {
    console.error('[CONNECT_FB] Error: FACEBOOK_APP_ID o FACEBOOK_REDIRECT_URI no están configurados en .env');
    return redirect('/dashboard?error=facebook_config_missing_in_env&message=Configuracion_de_Facebook_incompleta_en_el_servidor.');
  }

  // Generar un token CSRF
  const csrfToken = crypto.randomBytes(32).toString('hex');

  // Guardar el token CSRF en una cookie httpOnly y segura
  cookies().set('facebook_csrf_token', csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/', // Asegurarse que la cookie esté disponible en /api/auth/facebook/callback
    maxAge: 10 * 60, // 10 minutos en segundos
    sameSite: 'lax',
  });
  console.log('[CONNECT_FB] Token CSRF generado y cookie configurada.');

  const stateObject = {
    siteId: siteId,
    csrfToken: csrfToken,
  };
  const state = encodeURIComponent(JSON.stringify(stateObject));

  // Permisos necesarios. `pages_manage_post` ahora es `pages_manage_posts`
  const scope = 'pages_show_list,pages_manage_posts,pages_read_engagement';

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${facebookAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}&response_type=code&display=popup`;
  
  console.log(`[CONNECT_FB] Redirigiendo a URL de autorización de Facebook: ${authUrl.substring(0, authUrl.indexOf('client_secret=') === -1 ? authUrl.length : authUrl.indexOf('client_secret='))}...`);
  return redirect(authUrl);
}

