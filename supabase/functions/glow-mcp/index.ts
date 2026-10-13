import { createGlowMcpHandler } from './handler.ts';

const handler = createGlowMcpHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  publishableKey: Deno.env.get('GLOW_SUPABASE_PUBLISHABLE_KEY') ?? '',
  resourceUrl: Deno.env.get('GLOW_MCP_RESOURCE_URL') ?? '',
  allowedOrigins: (Deno.env.get('GLOW_MCP_ALLOWED_ORIGINS') ?? 'https://app.sesame.com').split(',').filter(Boolean),
  appUrl: Deno.env.get('GLOW_MCP_APP_URL') ?? 'https://gemini-rutina-cele.netlify.app',
});

Deno.serve(handler);
