# Solution 7 - Modern Angular Auth Gateway (Nx)

This solution updates the original Angular + OpenID Connect series to the current browser security model: the Angular applications do **not** receive OAuth access or refresh tokens. A server-side auth gateway acts as the confidential OAuth/OIDC client and Backend-for-Frontend (BFF).

The sample is intentionally small, but the boundaries mirror a larger microfrontend system. The specific OpenID Provider used for local development is interchangeable; the important part is the browser/BFF security boundary.

```text
Browser
  |
  | opaque HttpOnly session cookie
  v
Auth Gateway / BFF :8080
  |-- /                -> shell :4200
  |-- /orders/*        -> orders-mfe :4201
  |-- /api/orders/*    -> orders-api :4300 + Bearer access token
  |
  +-- Authorization Code + PKCE --> OpenID Provider

Redis :6379 stores sessions and short-lived login transactions.
```

## What this demonstrates

- Authorization Code + PKCE is executed by the server-side gateway.
- The browser only receives a session cookie; tokens stay in Redis-backed server-side session state.
- Angular calls relative, same-origin URLs and never builds an `Authorization: Bearer ...` header.
- Direct navigation to `/orders/...` is handled by the auth gateway. If the user is not authenticated, the gateway records a validated local `returnTo`, sends the browser through login, and returns it to the original deep link.
- API requests return `401` instead of redirecting to HTML login pages.
- Mutating browser-to-BFF calls require `X-CSRF: 1` and a same-origin `Origin` header.
- The proxy route table is fixed. User input can never select an arbitrary upstream host.
- Multiple gateway replicas can share Redis; sticky sessions are not required.
- The gateway uses a mature OIDC client library rather than implementing protocol details manually.

## OIDC client library

The Node/TypeScript gateway uses [`openid-client`](https://github.com/panva/openid-client). A mature OIDC client library is preferable to hand-rolling protocol details because it provides building blocks for discovery, Authorization Code flow, S256 PKCE, state/nonce verification, refresh-token grants and related protocol handling.

The library does **not** replace the BFF security responsibilities. The application still owns session-cookie configuration, CSRF protection, safe `returnTo` validation, server-side session storage, fixed/allowlisted upstream routing and the distinction between document navigation and API requests.

## Why the microfrontend JavaScript is not the security boundary

Static JavaScript bundles are not secrets. In this sample, authentication protects document navigation and APIs rather than trying to make every JS chunk private. If you use a federation mechanism, the same principle normally applies to federation manifests/remote entry files: protect data and privileged operations at the API/BFF boundary.

A microfrontend may be deployed on a completely different internal service while still being exposed to the browser through the auth gateway. The physical hosting location and the browser-facing application origin are separate concerns.

## Auth-gateway gotchas with microfrontends

### Prefer one canonical browser origin

The best setup is that internal MFE service addresses are infrastructure only and are not normal browser entry points.

```text
Browser
   |
   v
https://app.example.com/orders/123
   |
   v
Auth Gateway
   |
   v
http://orders-mfe.internal:4200
```

This keeps one session cookie, one OIDC callback origin, one CSRF/origin policy and one set of browser security rules.

### If an internal MFE URL must be browser-accessible, redirect document navigation

Sometimes an internal hostname exists because developers or internal users can reach the deployment directly. Do not let that silently become a second authenticated application origin.

Prefer redirecting document navigation to the equivalent route on the canonical application origin:

```text
https://orders.internal.example/123?tab=history
        |
        | 302/307
        v
https://app.example.com/orders/123?tab=history
        |
        v
Auth Gateway -> Orders MFE
```

Preserve the path and query string so deep links continue to work.

Use a temporary redirect such as `302` or `307` while the routing model may still change. A permanent `301`/`308` can be cached aggressively by browsers.

### Redirecting is usually cleaner than proxying a second browser origin

An alternative is to route `orders.internal.example` through the auth gateway and continue serving the application on that hostname. That can be secure, but it means supporting another browser origin and therefore additional cookie, `Origin`, CSP, CORS, absolute-URL and OAuth redirect-URI considerations.

If the alternate hostname has no product requirement, redirecting it to the canonical application origin is usually simpler.

### Do not blindly redirect static assets

The redirect recommendation is about **document navigation**. JavaScript chunks, CSS, federation manifests and other static assets may be served from another host or CDN if required.

The important boundary is that protected application navigation and API requests converge on the auth gateway.

### MFE API calls should target the gateway

The MFE should use relative API URLs:

```ts
this.http.get('/api/orders');
```

When the application runs under the canonical origin this becomes:

```text
Browser -> https://app.example.com/api/orders
        -> Auth Gateway
        -> Orders API + server-side Bearer token
```

The MFE never needs the OAuth access token itself.

### Direct deep links should return to the original route

For a request such as `/orders/123` without a session:

```text
/orders/123
   |
   v
Auth Gateway
   |
   +-- store validated returnTo=/orders/123
   +-- redirect to OIDC login
   +-- handle callback and create session
   v
/orders/123
```

`returnTo` must only accept local application paths. Never allow an arbitrary external URL or the login endpoint becomes an open redirect.

### Navigation and API requests behave differently

An unauthenticated browser navigation can be redirected into the login flow. An unauthenticated fetch/XHR/API request should normally receive `401`, not an HTML login page.

### Do not make every MFE its own OAuth client

Separate deployment does not require a separate authentication boundary. A shell and multiple independently deployed MFEs can all use the same BFF session and same-origin API surface.

## Local development

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run infra` to start the local identity provider and Redis.
4. Run `npm start`.
5. Open `http://localhost:8080` (not the individual Angular dev-server ports).
6. Log in with the demo user configured in the local development identity provider.

The gateway knows the local ports through environment variables and proxies both Angular dev servers, including WebSocket traffic. This gives the browser the same topology locally as in production: one origin in front of multiple frontend/backend processes.

## Production notes

Place the auth gateway behind the normal public routing/load-balancing layer used by your environment. That outer layer can own generic transport concerns such as TLS termination and coarse traffic protection, while the auth gateway owns the browser session, OIDC client, token lifecycle and application-aware route mapping.

Use HTTPS and a `Secure; HttpOnly` host-only session cookie. RFC 10017 recommends `SameSite=Strict` where the login/session bootstrap flow supports it. Keep CSRF protection even with SameSite cookies, especially when sibling subdomains exist. Sanitize forwarded headers at the trusted reverse-proxy boundary.

The sample uses a static `X-CSRF: 1` header plus strict Origin checking. A production framework-native anti-forgery mechanism is also a good choice.

## Federation

The authentication model is independent of the frontend composition technology. Shell and remotes should still call same-origin BFF routes and should not own OAuth tokens.

For a federated deployment, expose a canonical route such as `/orders/...` through the auth gateway and map its remote assets to the orders deployment. A remote loaded inside the shell should not start a second OIDC flow.
