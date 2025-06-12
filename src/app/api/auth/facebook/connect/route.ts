
// /src/app/api/auth/facebook/connect/route.ts
import {NextResponse, type NextRequest} from 'next/server';
import {redirect} from 'next/navigation';

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const siteId = searchParams.get('siteId');

  if (!siteId) {
    return NextResponse.json({error: 'Site ID es requerido'}, {status: 400});
  }

  const facebookAppId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  if (!facebookAppId || !redirectUri) {
    console.error('FACEBOOK_APP_ID o FACEBOOK_REDIRECT_URI no están configurados en .env');
    // En lugar de JSON, redirigir a dashboard con error para mejor UX
    return redirect('/dashboard?error=server_config_incomplete');
  }

  // **IMPORTANTE PARA SEGURIDAD (CSRF Protection):**
  // El parámetro 'state' se usa para prevenir ataques CSRF.
  // 1. Deberías generar un string aleatorio y único como token CSRF.
  // 2. Guardar este token CSRF en la sesión del usuario del lado del servidor o en una cookie httpOnly segura y firmada.
  // 3. Pasar este token CSRF como parte del objeto 'state'.
  // 4. En el endpoint de callback, verificar que el 'state' devuelto por Facebook contiene el mismo token CSRF.
  // Por simplicidad en este prototipo, solo incluimos siteId y un placeholder.
  // ¡NO USES ESTO EN PRODUCCIÓN SIN UNA IMPLEMENTACIÓN CSRF COMPLETA!
  const csrfTokenPlaceholder = `csrf-token-for-${siteId}-${Date.now()}`; // REEMPLAZAR con un token CSRF real y manejo de sesión/cookie.
  
  const stateObject = { 
    siteId: siteId, 
    csrfToken: csrfTokenPlaceholder // Deberías verificar este token en el callback
  };
  const state = encodeURIComponent(JSON.stringify(stateObject));

  // Permisos necesarios para listar páginas y publicar en ellas.
  const scope = 'pages_show_list,pages_manage_posts,pages_read_engagement';

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${facebookAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}&response_type=code`;

  // Redirigir al usuario a la URL de autorización de Facebook
  return redirect(authUrl);
}
