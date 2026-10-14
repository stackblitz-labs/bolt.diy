type MCPAdminContext = {
  cloudflare?: { env?: { MCP_ADMIN_TOKEN?: string } };
};

export async function requireMCPAdmin(request: Request, context: unknown): Promise<Response | undefined> {
  const configuredToken =
    (context as MCPAdminContext | undefined)?.cloudflare?.env?.MCP_ADMIN_TOKEN ?? process.env.MCP_ADMIN_TOKEN;

  const headers = { 'Cache-Control': 'no-store' };

  // Fail closed, including deployments that copied an empty example setting.
  if (typeof configuredToken !== 'string' || configuredToken.trim().length < 32) {
    return Response.json(
      { error: 'MCP administration requires a server MCP_ADMIN_TOKEN of at least 32 characters.' },
      { status: 503, headers },
    );
  }

  const origin = request.headers.get('Origin');

  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'Cross-origin MCP administration is not allowed.' }, { status: 403, headers });
  }

  const authorization = request.headers.get('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token || token.length > 1024) {
    return unauthorized();
  }

  // Compare fixed-size digests rather than stopping at the first mismatched secret byte.
  const encoder = new TextEncoder();

  const [expected, supplied] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(configuredToken.trim())),
    crypto.subtle.digest('SHA-256', encoder.encode(token)),
  ]);

  const expectedBytes = new Uint8Array(expected);
  const suppliedBytes = new Uint8Array(supplied);

  let difference = 0;

  for (let index = 0; index < expectedBytes.length; index++) {
    difference |= expectedBytes[index] ^ suppliedBytes[index];
  }

  return difference === 0 ? undefined : unauthorized();
}

function unauthorized() {
  return Response.json(
    { error: 'A valid MCP administration token is required.' },
    {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
        'WWW-Authenticate': 'Bearer realm="MCP administration"',
      },
    },
  );
}
