
// /src/app/api/auth/facebook/callback/route.ts
import {NextResponse, type NextRequest} from 'next/server';
import {redirect} from 'next/navigation';
import { updateSite } from '@/lib/actions'; // Asumimos que updateSite existe y funciona
import { FacebookAdsApi, AdAccount } from 'facebook-nodejs-business-sdk'; // Para tipos, si es necesario, o para llamadas API

// Esta es una versión MUY SIMPLIFICADA y con fines demostrativos.
// Una implementación real necesitaría un manejo de errores robusto,
// selección de página por el usuario, y almacenamiento seguro de tokens.

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');

  if (!code || !stateParam) {
    console.error('Error en callback de Facebook: Código o estado faltante.');
    return redirect('/dashboard?error=facebook_auth_failed_missing_params');
  }

  let originalState: { siteId: string; csrfToken: string };
  try {
    originalState = JSON.parse(decodeURIComponent(stateParam));
  } catch (e) {
    console.error('Error en callback de Facebook: Estado inválido.');
    return redirect('/dashboard?error=facebook_auth_failed_invalid_state');
  }
  
  const { siteId, csrfToken } = originalState;

  // Aquí deberías verificar el csrfToken contra uno guardado en la sesión/cookie
  // if (csrfToken !== session.csrfToken) {
  //   console.error('Error en callback de Facebook: Fallo de verificación CSRF.');
  //   return redirect('/dashboard?error=facebook_auth_failed_csrf');
  // }


  const facebookAppId = process.env.FACEBOOK_APP_ID;
  const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  if (!facebookAppId || !facebookAppSecret || !redirectUri) {
    console.error('FACEBOOK_APP_ID, FACEBOOK_APP_SECRET o FACEBOOK_REDIRECT_URI no configurados.');
    return redirect('/dashboard?error=server_config_incomplete');
  }

  try {
    // 1. Intercambiar código por token de acceso de usuario
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${facebookAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${facebookAppSecret}&code=${code}`;
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Error al obtener token de Facebook:', tokenData.error);
      return redirect(`/dashboard?error=fb_token_exchange_failed&message=${encodeURIComponent(tokenData.error.message)}`);
    }
    const userAccessToken = tokenData.access_token;

    // 2. Obtener lista de páginas que el usuario administra usando el userAccessToken
    const pagesUrl = `https://graph.facebook.com/me/accounts?access_token=${userAccessToken}&fields=id,name,access_token,tasks`; // tasks incluye MANAGE, CREATE_CONTENT
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
      console.error('Error al obtener páginas de Facebook:', pagesData.error);
      return redirect(`/dashboard?error=fb_pages_fetch_failed&message=${encodeURIComponent(pagesData.error.message)}`);
    }

    // Aquí, en una app real, deberías mostrar estas páginas al usuario para que seleccione una.
    // Por simplicidad, tomaremos la primera página que tenga permiso para 'CREATE_CONTENT'.
    const connectablePage = pagesData.data?.find((page: any) => 
      page.tasks && page.tasks.includes('CREATE_CONTENT')
    );

    if (!connectablePage) {
      console.warn('El usuario no administra ninguna página o no se encontraron páginas con permisos para crear contenido.');
      return redirect('/dashboard?error=no_connectable_pages_found');
    }

    const pageId = connectablePage.id;
    const pageName = connectablePage.name;
    const pageAccessToken = connectablePage.access_token; // Este es el Page Access Token


    // 3. Actualizar la información del sitio en tu base de datos (simulada)
    const updatedSite = await updateSite(siteId, {
      facebookPageId: pageId,
      facebookPageName: pageName,
      facebookPageAccessToken: pageAccessToken, // ¡Este es el token real de la página!
      status: 'monitoring', // O el estado que corresponda
      errorMessage: '', // Limpiar errores previos si los hubo
    });

    if (!updatedSite) {
      console.error(`Error al actualizar el sitio ${siteId} después de la autenticación de Facebook.`);
      return redirect('/dashboard?error=site_update_failed_after_fb_auth');
    }

    console.log(`Página de Facebook "${pageName}" (ID: ${pageId}) conectada exitosamente al sitio ${siteId}.`);
    // Redirigir al dashboard, idealmente con un mensaje de éxito.
    return redirect('/dashboard?success=facebook_connected');

  } catch (error: any) {
    console.error('Excepción durante el callback de Facebook:', error);
    return redirect(`/dashboard?error=facebook_callback_exception&message=${encodeURIComponent(error.message || 'Unknown error')}`);
  }
}
