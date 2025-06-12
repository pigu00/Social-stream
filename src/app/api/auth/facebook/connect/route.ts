
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
    return NextResponse.json({error: 'Configuración de Facebook incompleta en el servidor.'}, {status: 500});
  }

  // Guardamos el siteId en algún lugar para recuperarlo en el callback.
  // Podría ser en la sesión, una cookie temporal, o en el parámetro 'state'.
  // Usar 'state' es lo más común y seguro para CSRF protection.
  // Aquí, por simplicidad, lo pasaremos en el 'state', pero debería ser un valor opaco y verificado.
  // En una implementación real, 'state' debería ser un string aleatorio, guardado en la sesión/cookie,
  // y luego comparado en el callback.
  // Para este ejemplo, pasamos el siteId directamente, ¡pero NO LO HAGAS EN PRODUCCIÓN SIN MÁS MEDIDAS DE SEGURIDAD!
  // Considera codificarlo o usar un token JWT corto si es necesario pasarlo así.
  const state = JSON.stringify({ siteId: siteId, csrfToken: 'un-token-csrf-aleatorio-y-seguro-aqui' }); // Genera un token CSRF real

  const scope = 'pages_show_list,pages_manage_posts,pages_read_engagement'; // Permisos necesarios

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${facebookAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}&response_type=code`;

  // Redirigir al usuario a la URL de autorización de Facebook
  return redirect(authUrl);
}
