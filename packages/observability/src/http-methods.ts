/**
 * HTTP methods that application services are allowed to answer.
 *
 * OPTIONS is deliberately unsupported: CORS preflight is not part of the
 * service contract. HEAD is also unsupported even though Express/Fastify
 * would otherwise map it onto GET handlers automatically.
 */
export const ALLOWED_HTTP_METHODS = 'GET, POST, PUT, PATCH, DELETE';

interface HttpRequestLike {
  method?: string;
}

interface HttpResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

type NextFunctionLike = (error?: unknown) => void;

/**
 * Express-compatible middleware that rejects HEAD and OPTIONS with 405.
 *
 * Register it with `app.use()` before route registration and before any CORS
 * middleware. A CORS middleware would otherwise answer OPTIONS preflight
 * requests itself.
 */
export function rejectUnsupportedHttpMethods(
  req: HttpRequestLike,
  res: HttpResponseLike,
  next: NextFunctionLike,
): void {
  const method = req.method?.toUpperCase();

  if (method !== 'HEAD' && method !== 'OPTIONS') {
    next();
    return;
  }

  res.statusCode = 405;
  res.setHeader('Allow', ALLOWED_HTTP_METHODS);
  res.setHeader('Cache-Control', 'no-store');

  if (method === 'HEAD') {
    res.setHeader('Content-Length', '0');
    res.end();
    return;
  }

  const body = JSON.stringify({
    statusCode: 405,
    error: 'Method Not Allowed',
    message: `HTTP method ${method} is not supported`,
  });

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body).toString());
  res.end(body);
}
