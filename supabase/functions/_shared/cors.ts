// SEC-015 — locked-origin CORS for credentialed cookie auth.
// 'Access-Control-Allow-Origin': '*' is incompatible with credentials; exact origin required.
// Returns the requesting origin only if it is in the allowlist; empty string otherwise
// (browser rejects the request — correct behavior for disallowed origins).

const ALLOWED_ORIGINS = new Set([
  'https://scanforprofit.com',
  'https://www.scanforprofit.com',
]);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sfp-client',
    'Access-Control-Allow-Credentials': 'true',
  };
}
