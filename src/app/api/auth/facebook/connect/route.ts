
// /src/app/api/auth/facebook/connect/route.ts
import {NextResponse, type NextRequest} from 'next/server';
import {redirect} from 'next/navigation';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const siteId = searchParams.get('siteId');

  if (!siteId) {
    // Idealmente, redirigir al dashboard con un mensaje de error
    return redirect('/dashboard?error=missing_site_id_for_facebook_connect');
  }

  const facebookAppId = process.env.FACEBOOK_APP_ID;
  // Usamos la FACEBOOK_REDIRECT_URI del .env que ya está configurada para el dominio real o localhost
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  if (!facebookAppId || !redirectUri) {
    console.error('FACEBOOK_APP_ID o FACEBOOK_REDIRECT_URI no están configurados en .env');
    return redirect('/dashboard?error=facebook_config_missing_in_env');
  }

  // Generar un token CSRF
  const csrfToken = crypto.randomBytes(32).toString('hex');

  // Guardar el token CSRF en una cookie httpOnly y segura
  // La cookie expirará en 10 minutos, que debería ser suficiente para el flujo de OAuth.
  cookies().set('facebook_csrf_token', csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Usar 'secure' en producción (HTTPS)
    path: '/',
    maxAge: 10 * 60, // 10 minutos en segundos
    sameSite: 'lax', // 'lax' es un buen equilibrio para flujos de redirección OAuth
  });

  const stateObject = {
    siteId: siteId,
    csrfToken: csrfToken, // Incluir el token CSRF en el estado
  };
  const state = encodeURIComponent(JSON.stringify(stateObject));

  // Permisos necesarios para listar páginas, publicar en ellas y leer interacciones.
  const scope = 'pages_show_list,pages_manage_posts,pages_read_engagement';

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${facebookAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}&response_type=code`;

  // Redirigir al usuario a la URL de autorización de Facebook
  return redirect(authUrl);
}
