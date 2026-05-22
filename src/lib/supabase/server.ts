import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  let isSecure = process.env.NODE_ENV === 'production';
  try {
    const headersList = await headers();
    const xForwardedProto = headersList.get('x-forwarded-proto');
    // If we have an explicit proxy protocol header, use it to decide security
    if (xForwardedProto) {
      isSecure = xForwardedProto === 'https';
    } else {
      // Direct connection, check the host header to see if it's localhost or an IP
      const host = headersList.get('host') || '';
      const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
      // If it's local but not localhost (e.g. local IP 192.168.x.x), we are on HTTP, so not secure
      if (!isLocal && !host.startsWith('https://')) {
        // Raw local IPs are accessed over HTTP
        isSecure = false;
      }
    }
  } catch {
    // Fallback if headers() cannot be accessed
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                secure: isSecure,
                sameSite: isSecure ? options.sameSite : 'lax',
              })
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
      cookieOptions: {
        secure: isSecure,
        sameSite: 'lax',
      },
    }
  );
}
