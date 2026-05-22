import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const isSecure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              secure: isSecure,
              sameSite: isSecure ? options.sameSite : 'lax',
            })
          );
        },
      },
      cookieOptions: {
        secure: isSecure,
        sameSite: 'lax',
      },
    }
  );

  // IMPORTANT: Do not use getSession() for authorization.
  // Use getUser() instead as it validates the token with the Supabase server.
  let user = null;
  try {
    // Añadimos un timeout razonable para evitar bloqueos si la red falla, pero suficiente para móviles
    const { data } = await Promise.race([
      supabase.auth.getUser(),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
    ]);
    user = data?.user;
  } catch (e) {
    console.error('Error verificando sesión:', e);
    // Si falla la verificación, permitimos que siga pero como usuario no autenticado
    user = null;
  }

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/registro', '/'];
  const isPublicPath = publicPaths.some(
    (path) => request.nextUrl.pathname === path
  );

  if (!user && !isPublicPath) {
    // Redirect unauthenticated users to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/registro')) {
    // Redirect authenticated users away from auth pages
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Admin route protection
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    // We'll check admin role in the page/layout level since we need DB access
  }

  return supabaseResponse;
}
