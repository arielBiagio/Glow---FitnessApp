-- Minimal MCP access. Apply after 001/002; no existing workout data is changed.
-- Enable the token hook BEFORE enabling OAuth.
begin;

create role glow_mcp_reader nologin noinherit;
grant glow_mcp_reader to authenticator;
grant usage on schema public, auth to glow_mcp_reader;
grant execute on function auth.uid(), auth.jwt() to glow_mcp_reader;
grant select (id, display_name, timezone, selected_routine_id) on public.profiles to glow_mcp_reader;
create policy mcp_own_profile on public.profiles for select to glow_mcp_reader
  using ((select auth.uid()) = id and (select auth.jwt()->>'client_id') is not null);

grant usage on schema public to supabase_auth_admin;

-- Invoker, not SECURITY DEFINER. Only Supabase Auth can execute it.
-- All delegated OAuth clients are profile-only in this first milestone.
-- Password/OTP/social sign-in sessions without client_id remain unchanged.
create function public.glow_mcp_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_claims jsonb := event->'claims';
  v_resource text;
begin
  if nullif(v_claims->>'client_id', '') is null then
    if event->>'authentication_method' = 'oauth_provider/authorization_code' then
      return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'OAuth client identity missing'));
    end if;
    return event;
  end if;
  if coalesce(v_claims->>'iss', '') !~ '^https://[A-Za-z0-9.-]+/auth/v1$' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 503, 'message', 'GLOW MCP requires a canonical HTTPS issuer'));
  end if;
  v_resource := regexp_replace(v_claims->>'iss', '/auth/v1$', '') || '/functions/v1/glow-mcp';
  v_claims := jsonb_set(v_claims, '{role}', '"glow_mcp_reader"'::jsonb);
  -- Retain Data API compatibility while binding the token to this MCP resource.
  v_claims := jsonb_set(v_claims, '{aud}', jsonb_build_array('authenticated', v_resource));
  return jsonb_set(event, '{claims}', v_claims);
end;
$$;
revoke all on function public.glow_mcp_access_token_hook(jsonb) from public, anon, authenticated, glow_mcp_reader;
grant execute on function public.glow_mcp_access_token_hook(jsonb) to supabase_auth_admin;

-- This role does NOT inherit authenticated and gets no workout/RPC write grants.
commit;
