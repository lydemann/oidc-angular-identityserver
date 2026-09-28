import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as oidcClient from 'openid-client';

declare module 'express-session' {
  interface SessionData {
    user?: { sub: string; name?: string; email?: string };
    tokens?: {
      accessToken: string;
      refreshToken?: string;
      idToken?: string;
      expiresAt: number;
    };
  }
}

type BffRequest = Request & { bffAccessToken?: string };

const app = express();
const port = Number(process.env.PORT ?? 8080);
const publicOrigin = process.env.PUBLIC_ORIGIN ?? `http://localhost:${port}`;
const issuer = new URL(process.env.OIDC_ISSUER ?? 'http://localhost:8081/realms/angular-bff');
const clientId = process.env.OIDC_CLIENT_ID ?? 'auth-gateway';
const clientSecret = process.env.OIDC_CLIENT_SECRET ?? 'dev-secret';
const redirectUri = `${publicOrigin}/auth/callback`;
const isProduction = process.env.NODE_ENV === 'production';

const shellUrl = process.env.SHELL_URL ?? 'http://localhost:4200';
const ordersMfeUrl = process.env.ORDERS_MFE_URL ?? 'http://localhost:4201';
const ordersApiUrl = process.env.ORDERS_API_URL ?? 'http://localhost:4300';

const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
await redis.connect();

const discoveryOptions = issuer.protocol === 'http:'
  ? { execute: [oidcClient.allowInsecureRequests] }
  : undefined;

const oidc = await oidcClient.discovery(
  issuer,
  clientId,
  clientSecret,
  undefined,
  discoveryOptions,
);

app.set('trust proxy', isProduction ? 1 : false);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

app.use(
  session({
    name: isProduction ? '__Host-Http-session' : 'dev-session',
    store: new RedisStore({ client: redis, prefix: 'session:' }),
    secret: process.env.SESSION_SECRET ?? 'development-only-change-me-please',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: (process.env.SESSION_SAME_SITE as 'strict' | 'lax' | 'none' | undefined) ?? (isProduction ? 'strict' : 'lax'),
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

// Never trust a browser-supplied internal forwarding header.
app.use((req, _res, next) => {
  delete req.headers['x-bff-access-token'];
  next();
});

function safeReturnTo(candidate: unknown): string {
  if (typeof candidate !== 'string') return '/';
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/';
  return candidate;
}

function saveSession(req: Request) {
  return new Promise<void>((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));
}

function regenerateSession(req: Request) {
  return new Promise<void>((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())));
}

function destroySession(req: Request) {
  return new Promise<void>((resolve, reject) => req.session.destroy((error) => (error ? reject(error) : resolve())));
}

function isDocumentNavigation(req: Request): boolean {
  const destination = req.get('sec-fetch-dest');
  if (destination) return destination === 'document';
  return req.method === 'GET' && (req.get('accept') ?? '').includes('text/html');
}

function requireDocumentSession(req: Request, res: Response, next: NextFunction) {
  if (!isDocumentNavigation(req) || req.session.user) return next();
  const returnTo = safeReturnTo(req.originalUrl);
  return res.redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}

function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path === '/auth/callback') return next();

  const origin = req.get('origin');
  if (origin !== publicOrigin || req.get('x-csrf') !== '1') {
    return res.status(403).json({ error: 'CSRF check failed' });
  }
  return next();
}

app.use(requireCsrf);

app.get('/auth/login', async (req, res, next) => {
  try {
    const returnTo = safeReturnTo(req.query.returnTo);
    const codeVerifier = oidcClient.randomPKCECodeVerifier();
    const codeChallenge = await oidcClient.calculatePKCECodeChallenge(codeVerifier);
    const state = oidcClient.randomState();
    const nonce = oidcClient.randomNonce();

    await redis.setEx(
      `oidc-tx:${state}`,
      300,
      JSON.stringify({ codeVerifier, nonce, returnTo }),
    );

    const authorizationUrl = oidcClient.buildAuthorizationUrl(oidc, {
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email orders-api',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    res.redirect(authorizationUrl.href);
  } catch (error) {
    next(error);
  }
});

app.get('/auth/callback', async (req, res, next) => {
  try {
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    if (!state) return res.status(400).send('Missing state');

    const rawTransaction = await redis.get(`oidc-tx:${state}`);
    if (!rawTransaction) return res.status(400).send('Login transaction expired or invalid');
    await redis.del(`oidc-tx:${state}`);

    const transaction = JSON.parse(rawTransaction) as {
      codeVerifier: string;
      nonce: string;
      returnTo: string;
    };

    const currentUrl = new URL(req.originalUrl, publicOrigin);
    const tokens = await oidcClient.authorizationCodeGrant(oidc, currentUrl, {
      pkceCodeVerifier: transaction.codeVerifier,
      expectedState: state,
      expectedNonce: transaction.nonce,
      idTokenExpected: true,
    });

    const claims = tokens.claims();
    if (!claims?.sub) return res.status(400).send('ID token did not contain sub');

    await regenerateSession(req);
    req.session.user = {
      sub: claims.sub,
      name: typeof claims.name === 'string' ? claims.name : undefined,
      email: typeof claims.email === 'string' ? claims.email : undefined,
    };
    req.session.tokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 60),
    };
    await saveSession(req);

    return res.redirect(safeReturnTo(transaction.returnTo));
  } catch (error) {
    next(error);
  }
});

app.get('/auth/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ authenticated: false });
  return res.json({ authenticated: true, user: req.session.user });
});

app.post('/auth/logout', async (req, res, next) => {
  try {
    await destroySession(req);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

async function getFreshAccessToken(req: Request): Promise<string> {
  const tokens = req.session.tokens;
  if (!tokens) throw new Error('No token set in session');

  if (tokens.expiresAt > Math.floor(Date.now() / 1000) + 30) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) throw new Error('Access token expired and no refresh token is available');

  const refreshed = await oidcClient.refreshTokenGrant(oidc, tokens.refreshToken);
  req.session.tokens = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
    idToken: refreshed.id_token ?? tokens.idToken,
    expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 60),
  };
  await saveSession(req);
  return req.session.tokens.accessToken;
}

async function requireApiSession(req: BffRequest, res: Response, next: NextFunction) {
  try {
    if (!req.session.user || !req.session.tokens) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    req.bffAccessToken = await getFreshAccessToken(req);
    return next();
  } catch (error) {
    return next(error);
  }
}

// Fixed route mapping: the browser cannot choose an arbitrary upstream.
app.use(
  '/api/orders',
  requireApiSession,
  createProxyMiddleware({
    target: ordersApiUrl,
    changeOrigin: true,
    pathRewrite: { '^/api/orders': '/orders' },
    on: {
      proxyReq(proxyReq, req) {
        const token = (req as BffRequest).bffAccessToken;
        if (token) proxyReq.setHeader('authorization', `Bearer ${token}`);
      },
    },
  }),
);

// A direct MFE deep link still enters through the auth gateway.
app.use(
  '/orders',
  requireDocumentSession,
  createProxyMiddleware({
    target: ordersMfeUrl,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/orders': '' },
  }),
);

// Shell is the fallback frontend. Static JS may be fetched without a session;
// privileged data remains protected at the BFF/API boundary.
app.use(
  '/',
  requireDocumentSession,
  createProxyMiddleware({ target: shellUrl, changeOrigin: true, ws: true }),
);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Internal gateway error' });
});

app.listen(port, () => {
  console.log(`Auth gateway listening on ${publicOrigin}`);
});
