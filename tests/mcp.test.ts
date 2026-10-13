import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { decodeJwt, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { createGlowMcpHandler, type McpConfig } from '../supabase/functions/glow-mcp/handler.ts';
import { getAuthorizationId, safeOAuthRedirect } from '../src/lib/oauth';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const config: McpConfig = {
  supabaseUrl: 'https://example.supabase.co', publishableKey: 'sb_publishable_fixture_only',
  resourceUrl: 'https://example.supabase.co/functions/v1/glow-mcp',
  allowedOrigins: ['https://gemini-rutina-cele.netlify.app', 'https://app.sesame.com'],
};
let privateKey: CryptoKey;
let publicJwk: Record<string, unknown>;
beforeAll(async () => {
  const keys = await generateKeyPair('ES256');
  privateKey = keys.privateKey;
  publicJwk = { ...await exportJWK(keys.publicKey), kid: 'test-key', alg: 'ES256', use: 'sig' };
});
async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({ sub: A, role: 'glow_mcp_reader', client_id: 'fixture-client', is_anonymous: false,
    iss: `${config.supabaseUrl}/auth/v1`, aud: ['authenticated', config.resourceUrl],
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...overrides })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' }).sign(privateKey);
}
function setup(options: { empty?: boolean; fail?: boolean } = {}) {
  const reads: { userId: string; filter: string | null }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.pathname.endsWith('/jwks.json')) return Response.json({ keys: [publicJwk] });
    if (url.origin === 'https://gemini-rutina-cele.netlify.app') {
      expect(request.headers.has('Authorization')).toBe(false);
      return Response.json(JSON.parse(readFileSync(`public${url.pathname}`, 'utf8')));
    }
    if (url.pathname === '/rest/v1/workout_weeks') return Response.json([]);
    if (url.pathname === '/rest/v1/rpc/glow_mcp_statistics') return Response.json({ diasEntrenados: 0, semanasActivas: 0, sesionesCompletas: 0, minutosEstimados: 0, ejerciciosCompletos: 0, seriesCompletas: 0, primeraFechaActividad: null, ultimaFechaActividad: null });
    if (url.pathname !== '/rest/v1/profiles' || request.method !== 'GET') throw new Error('Unexpected network request');
    const jwt = decodeJwt(request.headers.get('Authorization')!.slice(7));
    reads.push({ userId: jwt.sub!, filter: url.searchParams.get('id') });
    if (options.fail) return Response.json({ message: 'INTERNAL SECRET MUST NOT LEAK' }, { status: 500 });
    return Response.json(options.empty ? [] : [{ id: jwt.sub, display_name: `  Ana   ${jwt.sub === A ? 'A' : 'B'}  `, timezone: 'America/New_York', selected_routine_id: 'glow-cele-split' }]);
  };
  const handler = createGlowMcpHandler(config, fetcher);
  return { handler, reads };
}
const rpc = (handler: (r: Request) => Promise<Response>, bearer?: string, origin?: string, body: unknown = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) => handler(new Request(config.resourceUrl, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body),
}));

describe('MCP OAuth aislado, sin Supabase real', () => {
  it('acepta la ruta interna de Supabase sin cambiar la URL pública de OAuth', async () => {
    const { handler, reads } = setup();
    const response = await handler(new Request('http://edge-runtime:9000/glow-mcp'));
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain(config.resourceUrl);
    const metadata = await handler(new Request('http://edge-runtime:9000/glow-mcp/.well-known/oauth-protected-resource'));
    expect(metadata.status).toBe(200);
    expect((await metadata.json()).resource).toBe(config.resourceUrl);
    const other = await handler(new Request('http://edge-runtime:9000/glow-mcp-other'));
    expect(other.status).toBe(404);
    expect(reads).toEqual([]);
  });
  it('publica discovery y challenge sin revelar información del usuario', async () => {
    const { handler, reads } = setup();
    const response = await rpc(handler);
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('resource_metadata=');
    const metadata = await handler(new Request(`${config.resourceUrl}/.well-known/oauth-protected-resource`));
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toMatchObject({ resource: config.resourceUrl, authorization_servers: [`${config.supabaseUrl}/auth/v1`] });
    expect(reads).toEqual([]);
  });
  it.each([
    { exp: 1 }, { aud: 'authenticated' }, { iss: 'https://wrong.supabase.co/auth/v1' },
    { role: 'authenticated' }, { role: 'service_role' }, { client_id: '' }, { sub: B, is_anonymous: true }, { sub: 'not-a-uuid' },
  ])('rechaza claims inválidos: %j', async claims => {
    const { handler, reads } = setup();
    expect((await rpc(handler, await token(claims))).status).toBe(401);
    expect(reads).toEqual([]);
  });
  it('rechaza una firma manipulada y un token que no es JWT', async () => {
    const { handler } = setup();
    const value = await token();
    const parts = value.split('.');
    parts[2] = `${parts[2][0] === 'a' ? 'b' : 'a'}${parts[2].slice(1)}`;
    expect((await rpc(handler, parts.join('.'))).status).toBe(401);
    expect((await rpc(handler, 'invalid')).status).toBe(401);
  });
  it('rechaza un Origin ajeno y nunca genera metadata desde el Host de la petición', async () => {
    const { handler } = setup();
    expect((await rpc(handler, await token(), 'https://evil.example')).status).toBe(403);
    const response = await handler(new Request('https://evil.example/functions/v1/glow-mcp/.well-known/oauth-protected-resource'));
    expect((await response.json()).resource).toBe(config.resourceUrl);
  });
  it('negocia con el SDK oficial y expone cinco herramientas de solo lectura', async () => {
    const { handler, reads } = setup();
    const bearer = await token();
    const client = new Client({ name: 'local-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(config.resourceUrl), {
      requestInit: { headers: { Authorization: `Bearer ${bearer}` } },
      fetch: async (input, init) => {
        const publicRequest = new Request(input, init);
        const internalUrl = publicRequest.url.replace(`${config.supabaseUrl}/functions/v1`, 'http://edge-runtime:9000');
        return handler(new Request(internalUrl, publicRequest));
      },
    });
    try {
      await client.connect(transport);
      const result = await client.listTools();
      expect(result.tools.map(tool => tool.name)).toEqual(['mi_perfil', 'mis_rutinas', 'mi_rutina', 'mi_entrenamiento', 'mis_estadisticas']);
      expect(result.tools.every(tool => tool.annotations?.readOnlyHint === true)).toBe(true);
      const profile = await client.callTool({ name: 'mi_perfil', arguments: {} });
      expect(profile.isError).not.toBe(true);
      expect(profile.structuredContent).toMatchObject({ userId: A, displayName: 'Ana A', profileExists: true });
      expect(reads).toEqual([{ userId: A, filter: `eq.${A}` }]);
      for (const name of ['mis_rutinas', 'mi_rutina', 'mi_entrenamiento', 'mis_estadisticas']) {
        const response = await client.callTool({ name, arguments: {} });
        expect(response.isError, name).not.toBe(true);
        expect(response.structuredContent, name).toBeTruthy();
      }
    } finally { await client.close(); }
  });
  it('aísla usuarios concurrentes, rechaza IDs arbitrarios y maneja errores sin filtrarlos', async () => {
    const { handler, reads } = setup();
    const call = (bearer: string, args: object = {}) => rpc(handler, bearer, undefined, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'mi_perfil', arguments: args } });
    const a = await token(); const b = await token({ sub: B });
    const responses = await Promise.all([call(a), call(b)]);
    // Legacy stateless transport may use SSE; read the serialized response body.
    expect(await responses[0].text()).toContain('Ana A');
    expect(await responses[1].text()).toContain('Ana B');
    expect(reads.map(read => read.filter).sort()).toEqual([`eq.${A}`, `eq.${B}`]);
    expect(await (await call(a, { userId: B })).text()).toContain('error');
    expect(reads).toHaveLength(2);
    const failed = setup({ fail: true });
    const text = await (await rpc(failed.handler, a, undefined, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'mi_perfil', arguments: {} } })).text();
    expect(text).toContain('isError'); expect(text).not.toContain('INTERNAL SECRET');
  });
  it('no crea perfiles ausentes y limita el tamaño de petición', async () => {
    const { handler } = setup({ empty: true });
    const a = await token();
    expect(await (await rpc(handler, a, undefined, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'mi_perfil', arguments: {} } })).text()).toContain('profileExists');
    expect((await rpc(handler, a, undefined, { padding: 'a'.repeat(17000) })).status).toBe(413);
  });
  it('falla al configurar URLs ajenas o una clave privada', () => {
    expect(() => createGlowMcpHandler({ ...config, publishableKey: 'sb_secret_not_allowed' })).toThrow();
    expect(() => createGlowMcpHandler({ ...config, resourceUrl: 'https://evil.example/functions/v1/glow-mcp' })).toThrow();
  });
});

describe('parámetros de consentimiento OAuth', () => {
  it('preserva un authorization_id único y rechaza duplicados o caracteres de ruta', () => {
    expect(getAuthorizationId('?authorization_id=abc-123')).toBe('abc-123');
    expect(getAuthorizationId('?authorization_id=a&authorization_id=b')).toBeNull();
    expect(getAuthorizationId('?authorization_id=../evil')).toBeNull();
    expect(getAuthorizationId('')).toBeNull();
  });
  it('admite retornos HTTPS/nativos registrados pero no URLs ejecutables ni HTTP remoto', () => {
    expect(safeOAuthRedirect('https://app.sesame.com/callback?code=test&state=abc')).toContain('state=abc');
    expect(safeOAuthRedirect('sesame://callback?code=test')).toBe('sesame://callback?code=test');
    for (const value of ['javascript:alert(1)', 'data:text/html,evil', 'http://evil.example', 'https://user:pass@evil.example', '/relative']) expect(() => safeOAuthRedirect(value)).toThrow();
  });
});
