
// /src/app/api/auth/facebook/callback/route.ts
import {NextResponse, type NextRequest} from 'next/server';
import {redirect} from 'next/navigation';
import { cookies } from 'next/headers';
import { updateSite } from '@/lib/actions'; // Asumimos que updateSite existe y funciona

export async function GET(request: NextRequest) {
  const {searchParams} = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    console.error(`Error en callback de Facebook: ${error} - ${errorDescription}`);
    return redirect(`/dashboard?error=facebook_auth_failed&message=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code || !stateParam) {
    console.error('Error en callback de Facebook: Código o estado faltante.');
    return redirect('/dashboard?error=facebook_auth_failed_missing_params');
  }

  // **PASO 1: Verificar el token CSRF**
  const storedCsrfToken = cookies().get('facebook_csrf_token')?.value;
  cookies().delete('facebook_csrf_token'); // Eliminar la cookie CSRF después de usarla

  let originalState: { siteId: string; csrfToken: string };
  try {
    originalState = JSON.parse(decodeURIComponent(stateParam));
  } catch (e) {
    console.error('Error en callback de Facebook: Estado inválido o malformado.');
    return redirect('/dashboard?error=facebook_auth_failed_invalid_state_format');
  }
  
  const { siteId, csrfToken: receivedCsrfToken } = originalState;

  if (!storedCsrfToken || !receivedCsrfToken || storedCsrfToken !== receivedCsrfToken) {
    console.error('Error en callback de Facebook: Fallo de verificación CSRF.');
    console.error(`Stored: ${storedCsrfToken}, Received: ${receivedCsrfToken}`);
    return redirect('/dashboard?error=facebook_auth_failed_csrf_mismatch');
  }
  console.log('Verificación CSRF exitosa.');


  const facebookAppId = process.env.FACEBOOK_APP_ID;
  const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI; // Debe ser la misma que usaste para iniciar

  if (!facebookAppId || !facebookAppSecret || !redirectUri) {
    console.error('FACEBOOK_APP_ID, FACEBOOK_APP_SECRET o FACEBOOK_REDIRECT_URI no configurados.');
    return redirect('/dashboard?error=server_config_incomplete_for_facebook_token_exchange');
  }

  try {
    // **PASO 2: Intercambiar el código de autorización por un User Access Token**
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token`;
    const tokenParams = new URLSearchParams({
      client_id: facebookAppId,
      redirect_uri: redirectUri,
      client_secret: facebookAppSecret,
      code: code,
    });

    console.log(`Solicitando User Access Token a: ${tokenUrl} con redirect_uri: ${redirectUri}`);
    const tokenResponse = await fetch(`${tokenUrl}?${tokenParams.toString()}`, { method: 'GET' });
    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error('Error al obtener User Access Token de Facebook:', tokenData.error);
      const message = tokenData.error?.message || 'No se pudo obtener el token de acceso de usuario de Facebook.';
      return redirect(`/dashboard?error=fb_user_token_exchange_failed&message=${encodeURIComponent(message)}`);
    }
    const userAccessToken = tokenData.access_token;
    console.log('User Access Token obtenido (primeros 15 chars):', userAccessToken.substring(0,15) + '...');

    // **PASO 3: Usar el User Access Token para obtener las Páginas del usuario y sus Page Access Tokens**
    // Solicitamos 'id', 'name', 'access_token' (este es el Page Access Token), y 'tasks' (para permisos)
    const pagesUrl = `https://graph.facebook.com/me/accounts?access_token=${userAccessToken}&fields=id,name,access_token,tasks&limit=25`; // Ajusta el límite si es necesario
    
    console.log(`Solicitando páginas a: ${pagesUrl}`);
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    if (pagesData.error || !pagesData.data) {
      console.error('Error al obtener páginas de Facebook:', pagesData.error);
      const message = pagesData.error?.message || 'No se pudieron obtener las páginas del usuario de Facebook.';
      return redirect(`/dashboard?error=fb_pages_fetch_failed&message=${encodeURIComponent(message)}`);
    }

    // **PASO 4: Seleccionar la Página adecuada**
    // Por simplicidad, tomaremos la primera página que tenga permiso para 'CREATE_CONTENT'.
    // En una app real, deberías mostrar estas páginas al usuario para que seleccione una.
    const connectablePage = pagesData.data?.find((page: any) => 
      page.tasks && page.tasks.includes('CREATE_CONTENT')
    );

    if (!connectablePage) {
      console.warn('El usuario no administra ninguna página con permisos para crear contenido (CREATE_CONTENT). Páginas recibidas:', pagesData.data);
      let noPageMessage = 'No se encontraron páginas de Facebook conectables.';
      if (pagesData.data && pagesData.data.length > 0) {
        noPageMessage = 'Ninguna de tus páginas de Facebook tiene el permiso necesario (CREATE_CONTENT) para que esta app publique. Verifica los permisos de la página en Facebook o tu rol en ella.';
      } else {
        noPageMessage = 'No administras ninguna página de Facebook o no se otorgó el permiso para verlas.';
      }
      return redirect(`/dashboard?error=no_connectable_facebook_pages_found&message=${encodeURIComponent(noPageMessage)}`);
    }

    const pageId = connectablePage.id;
    const pageName = connectablePage.name;
    const pageAccessToken = connectablePage.access_token; // ¡Este es el Page Access Token que necesitas!

    console.log(`Página de Facebook seleccionada: "${pageName}" (ID: ${pageId})`);
    console.log('Page Access Token obtenido (primeros 15 chars):', pageAccessToken.substring(0,15) + '...');

    // **PASO 5: Actualizar la información del sitio en tu base de datos (simulada)**
    const updatedSite = await updateSite(siteId, {
      facebookPageId: pageId,
      facebookPageName: pageName,
      facebookPageAccessToken: pageAccessToken, 
      status: 'monitoring', // O el estado que corresponda
      errorMessage: null, // Limpiar errores previos si los hubo
    });

    if (!updatedSite) {
      console.error(`Error al actualizar el sitio ${siteId} después de la autenticación de Facebook en la base de datos.`);
      // Aquí podrías querer invalidar el token de Facebook o manejar este error de forma más robusta.
      return redirect('/dashboard?error=site_update_failed_after_fb_auth_in_db');
    }

    console.log(`Página de Facebook "${pageName}" (ID: ${pageId}) conectada exitosamente al sitio ${siteId}.`);
    return redirect('/dashboard?success=facebook_page_connected');

  } catch (exception: any) {
    console.error('Excepción general durante el callback de Facebook:', exception);
    const message = exception.message || 'Error desconocido durante el proceso de callback de Facebook.';
    if (exception.cause) console.error('Causa de la excepción:', exception.cause);
    return redirect(`/dashboard?error=facebook_callback_exception&message=${encodeURIComponent(message)}`);
  }
}
