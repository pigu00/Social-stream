
// /src/app/api/auth/facebook/connect/route.ts
import {NextResponse, type NextRequest} from 'next/server';
import {redirect} from 'next/navigation';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const siteId = searchParams.get('siteId');

  console.log(`[CONNECT_FB] Solicitud de conexión recibida. Site ID: ${siteId}`);

  if (!siteId) {
    console.error('[CONNECT_FB] Error: Falta siteId para conectar Facebook.');
    return redirect('/dashboard?error=missing_site_id_for_facebook_connect&message=ID_del_sitio_requerido_para_conectar_con_Facebook.');
  }

  const facebookAppId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  console.log(`[CONNECT_FB] Iniciando conexión para siteId: ${siteId}`);
  console.log(`[CONNECT_FB] Leyendo FACEBOOK_APP_ID: ${facebookAppId || 'NO CONFIGURADO'}`);
  console.log(`[CONNECT_FB] Leyendo FACEBOOK_REDIRECT_URI: ${redirectUri || 'NO CONFIGURADO'}`);


  if (!facebookAppId || !redirectUri) {
    const errorMessage = `[CONNECT_FB] Error CRÍTICO: FACEBOOK_APP_ID (valor: ${facebookAppId || ' indefinido'}) o FACEBOOK_REDIRECT_URI (valor: ${redirectUri || 'indefinido'}) no están configurados o no son accesibles en el entorno del servidor (process.env). Verifica la configuración de variables de entorno.`;
    console.error(errorMessage);
    return redirect('/dashboard?error=facebook_config_missing_in_env&message=Configuracion_de_Facebook_incompleta_en_el_servidor.');
  }

  // Generar un token CSRF
  const csrfToken = crypto.randomBytes(32).toString('hex');
  console.log('[CONNECT_FB] Token CSRF generado:', csrfToken.substring(0,10) + "...");


  // Guardar el token CSRF en una cookie httpOnly y segura
  cookies().set('facebook_csrf_token', csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', 
    path: '/', 
    maxAge: 10 * 60, // 10 minutos en segundos
    sameSite: 'lax',
  });
  console.log('[CONNECT_FB] Cookie facebook_csrf_token configurada.');

  const stateObject = {
    siteId: siteId,
    csrfToken: csrfToken,
  };
  const state = encodeURIComponent(JSON.stringify(stateObject));
  console.log('[CONNECT_FB] Objeto de estado generado (antes de URI encode):', stateObject);

  // Permisos necesarios (scope):
  // - pages_show_list: Necesario para obtener la lista de Páginas que administra el usuario.
  // - pages_manage_posts: Crucial. Permite a la aplicación crear, editar y eliminar publicaciones en nombre de las Páginas que administra el usuario.
  // - pages_read_engagement: Permite leer contenido y metadatos de la Página, así como insights de la Página. Útil si en el futuro se quiere analizar el rendimiento.
  const scope = 'pages_show_list,pages_manage_posts,pages_read_engagement';
  console.log('[CONNECT_FB] Alcance (scope) solicitado:', scope);

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${facebookAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}&response_type=code&display=popup`;
  
  console.log(`[CONNECT_FB] Redirigiendo a URL de autorización de Facebook (state oculto para brevedad): ${authUrl.substring(0, authUrl.indexOf('&state=') + 7)}...`);
  return redirect(authUrl);
}

