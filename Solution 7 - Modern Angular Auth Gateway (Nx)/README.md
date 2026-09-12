# Solution 7 - Modern Angular Auth Gateway (Nx)

This solution updates the original Angular + OpenID Connect series to the current browser security model: the Angular applications do **not** receive OAuth access or refresh tokens. A server-side auth gateway acts as the confidential OAuth/OIDC client and Backend-for-Frontend (BFF).

The sample is intentionally small, but the boundaries mirror a larger microfrontend system.

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
  +-- Authorization Code + PKCE --> Keycloak :8081

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

## Why the microfrontend JavaScript is not the security boundary

Static JavaScript bundles are not secrets. In this sample, authentication protects document navigation and APIs rather than trying to make every JS chunk private. If you use Native Federation, the same principle normally applies to federation manifests/remote entry files: protect data and privileged operations at the API/BFF boundary. You can still gate a direct MFE document URL so that visiting `/orders/123` performs login before returning the HTML application.

A direct Kubernetes pod/service URL should normally **not** be a second public browser entry point. Keep one canonical browser origin through the gateway. Internal pod addresses can remain reachable for diagnostics, health checks, and trusted development networks without becoming another OAuth redirect origin.

## Local development

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run infra` to start Keycloak and Redis.
4. Run `npm start`.
5. Open `http://localhost:8080` (not the individual Angular dev-server ports).
6. Log in with `alice` / `alice`.

The gateway knows the local ports through environment variables and proxies both Angular dev servers, including WebSocket traffic. This gives the browser the same topology locally as in production: one origin in front of multiple frontend/backend processes.

## Production notes

In production place the auth gateway behind your edge/SaaS gateway. The edge gateway owns concerns such as WAF, DDoS protection, coarse rate limiting and TLS policy. The auth gateway owns the browser session, OIDC client, token lifecycle and application-aware route mapping.

Use HTTPS and a `Secure; HttpOnly` host-only session cookie. RFC 10017 recommends `SameSite=Strict` where the login/session bootstrap flow supports it. Keep CSRF protection even with SameSite cookies, especially when sibling subdomains exist. Sanitize forwarded headers at the trusted reverse-proxy boundary.

The sample uses a static `X-CSRF: 1` header plus strict Origin checking. A production framework-native anti-forgery mechanism is also a good choice.

## Native Federation

Nx 23 deprecates its older Angular host/remote Module Federation generators in favor of Native Federation. The authentication model in this solution is independent of the composition technology: shell and remotes should still call same-origin BFF routes and should not own OAuth tokens.

For a federated deployment, expose a canonical route such as `/orders/...` through the auth gateway and map its remote assets to the orders deployment. A remote loaded inside the shell should not start a second OIDC flow.
