import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const isSecure = typeof window !== 'undefined' ? window.location.protocol === 'https:' : false;

  // Custom cookie methods to persist session in localStorage as a fallback.
  // This is crucial for mobile browsers on local networks (HTTP IP addresses)
  // where cookies are often blocked or not persisted.
  const cookiesConfig = typeof window !== 'undefined' ? {
    getAll() {
      const parsedCookies: { name: string; value: string }[] = [];
      if (document.cookie) {
        document.cookie.split(';').forEach((cookieStr) => {
          const parts = cookieStr.split('=');
          if (parts.length < 2) return;
          const rawName = parts[0].trim();
          const rawValue = parts.slice(1).join('=').trim();
          
          let name = rawName;
          let value = rawValue;
          try {
            name = decodeURIComponent(rawName);
          } catch (e) {}
          try {
            value = decodeURIComponent(rawValue);
          } catch (e) {}
          
          parsedCookies.push({ name, value });
        });
      }

      // Fallback: If Supabase cookies are missing in document.cookie, restore them from localStorage
      const hasSbCookies = parsedCookies.some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
      if (!hasSbCookies) {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-')) {
              const val = localStorage.getItem(key);
              if (val) {
                if (!parsedCookies.some(c => c.name === key)) {
                  parsedCookies.push({ name: key, value: val });
                }
              }
            }
          }
        } catch (e) {
          console.error('Error reading from localStorage:', e);
        }
      }

      return parsedCookies;
    },
    setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
      cookiesToSet.forEach(({ name, value, options }) => {
        let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
        
        if (options) {
          if (options.maxAge !== undefined) {
            cookieStr += `; Max-Age=${options.maxAge}`;
          } else if (options.expires) {
            const expDate = options.expires instanceof Date ? options.expires : new Date(options.expires);
            cookieStr += `; Expires=${expDate.toUTCString()}`;
          }
          if (options.path) {
            cookieStr += `; Path=${options.path}`;
          }
          if (options.domain) {
            cookieStr += `; Domain=${options.domain}`;
          }
          if (options.secure) {
            cookieStr += `; Secure`;
          }
          if (options.sameSite) {
            cookieStr += `; SameSite=${options.sameSite}`;
          }
        }
        document.cookie = cookieStr;

        // Sync with localStorage
        if (name.startsWith('sb-')) {
          try {
            if (value) {
              localStorage.setItem(name, value);
            } else {
              localStorage.removeItem(name);
            }
          } catch (e) {
            console.error('Error writing to localStorage:', e);
          }
        }
      });
    }
  } : undefined;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: cookiesConfig,
      cookieOptions: {
        secure: isSecure,
        sameSite: 'lax',
      },
    }
  );
}

