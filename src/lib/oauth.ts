// Only redirect URLs returned by Supabase's authenticated OAuth API belong here.
// Never use a redirect/callback URL supplied through the page's query string.
export function safeOAuthRedirect(value: string): string {
  const url = new URL(value);
  if (['javascript:', 'data:', 'file:', 'blob:', 'about:', 'vbscript:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Unsafe OAuth redirect');
  }
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('OAuth requires HTTPS');
  // Registered native-app callback schemes are also supported.
  return url.href;
}

export function getAuthorizationId(search: string): string | null {
  const values = new URLSearchParams(search).getAll('authorization_id');
  return values.length === 1 && /^[A-Za-z0-9_-]{1,200}$/.test(values[0]) ? values[0] : null;
}
