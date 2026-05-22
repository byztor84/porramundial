import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // DUMMY MIDDLEWARE - NO SUPABASE
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logoginso.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
