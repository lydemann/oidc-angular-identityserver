# Solution 7 - Modern Angular Auth Gateway (Nx)

This solution continues the original Angular + OpenID Connect series with the current browser-security model: Angular does **not** receive OAuth access or refresh tokens. A server-side auth gateway acts as the confidential OAuth/OIDC client and Backend-for-Frontend (BFF).

The specific OpenID Provider used for local development is interchangeable. The important part is the browser/BFF security boundary.

```text
Browser
  |
  | HttpOnly session cookie
  v
Auth Gateway / BFF :8080
  |-- /                -> shell :4200
  |-- /orders/*        -> orders-mfe :4201
  |-- /api/orders/*    -> orders-api :4300 + Bearer access token
  |
  +-- Authorization Code + PKCE --> OpenID Provider

Redis :6379 stores sessions and short-lived login transactions.
```

## Standards context

The sample follows the direction of the current OAuth guidance:

- [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html) defines PKCE.
- [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html) is the OAuth 2.0 Security Best Current Practice. It requires PKCE for public clients, recommends it for confidential clients, requires exact OAuth redirect-URI matching, and says clients must not expose open redirectors.
- [RFC 10017](https://www.rfc-editor.org/rfc/rfc10017.html) is the browser-based applications BCP. It requires Authorization Code + PKCE for browser public clients, says Implicit must not be used to obtain access tokens, and presents the BFF as the strongest of the three common browser application architecture patterns.

## What this demonstrates

- Authorization Code + PKCE is executed by the server-side gateway.
- The browser receives an HttpOnly session cookie; OAuth tokens stay server-side.
- Angular calls relative URLs and never builds an `Authorization: Bearer ...` header.
- Direct MFE deep links can enter the login flow and return to the original route.
- API requests return `401` instead of redirecting to HTML login pages.
- Mutating browser-to-BFF calls require the sample's CSRF/Origin checks.
- The proxy route table is fixed; browser input cannot choose an arbitrary upstream.
- Multiple gateway replicas can share Redis, so sticky sessions are not required.

## Use a mature OIDC client in the auth gateway

The Node/TypeScript gateway uses [`openid-client`](https://github.com/panva/openid-client) **inside the server-side auth gateway**. It is designed for JavaScript runtimes including Node.js and implements protocol building blocks such as discovery, Authorization Code flow, S256 PKCE, refresh-token grants, revocation, DPoP and PAR.

The library does not replace the BFF responsibilities. The application still owns session-cookie configuration, CSRF protection, safe post-login redirects, server-side session storage and fixed/allowlisted upstream routing.

## Auth-gateway gotchas with microfrontends

### The MFE is not an OAuth client

An independently deployed MFE does not need to start its own OAuth flow. The auth gateway owns authentication for the browser application.

If somebody opens a direct internal MFE address, redirect **document navigation** to the auth-gateway address for that environment:

```text
https://mf1.internal.example/orders/123?tab=history
        |
        | 302/307
        v
https://auth-gateway.internal.example/orders/123?tab=history
        |
        +-- no session -> OIDC login -> callback
        |
        v
Orders MFE
```

Preserve the path and query string so deep links keep working. The redirect should happen at the routing/web-server boundary rather than relying on Angular to notice after the application has loaded.

### Protected API calls still go through the gateway

The MFE should make relative requests:

```ts
this.http.get('/api/orders');
```

When the MFE is being used through the auth-gateway origin the flow is:

```text
Browser -> /api/orders
        -> Auth Gateway
        -> Orders API + server-side Bearer token
```

The MFE never needs the OAuth access token itself.

### Navigation and API requests behave differently

An unauthenticated **document navigation** can be redirected into the login flow. An unauthenticated fetch/XHR/API call should normally receive `401`, not an HTML login page.

### Validate the post-login destination

This sample deliberately stores a local `returnTo` path such as `/orders/123`. That is a simple narrow policy, not an OAuth requirement that all post-login targets must be relative.

An absolute return URL can also be valid if the server checks it against a strict allowlist of trusted origins/routes. The important requirement is that the application must not become an open redirector. [RFC 9700 section 4.11](https://www.rfc-editor.org/rfc/rfc9700.html#name-open-redirection) says clients must not expose open redirectors and should redirect only to allowed targets (or when the request origin/integrity can be authenticated).

### Do not make every MFE its own OAuth client

Separate deployment does not require a separate authentication boundary. A shell and independently deployed MFEs can share the same BFF session and gateway API surface.

## Local development with Nx continuous tasks

The auth gateway lives in the same Nx monorepo as the frontend apps. Its `serve` target is marked as a continuous task:

```json
{
  "targets": {
    "serve": {
      "continuous": true
    }
  }
}
```

Frontend `serve` targets depend on it:

```json
{
  "targets": {
    "serve": {
      "dependsOn": [
        { "projects": ["auth-gateway"], "target": "serve" }
      ]
    }
  }
}
```

Nx supports long-running dependencies through [`continuous: true`](https://nx.dev/docs/reference/project-configuration#continuous), so running:

```bash
nx serve orders-mfe
```

also starts `auth-gateway:serve` without waiting for the gateway process to exit. The same dependency is configured for the shell in this sample.

This is the same general monorepo idea described in [The Stages of an Angular Architecture with Nx](https://christianlydemann.com/the-stages-of-an-angular-architecture-with-nx/): use the workspace task graph to express infrastructure/dev dependencies instead of relying on developers to remember a manual startup sequence.

## Run the complete sample

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run infra` to start the local identity provider and Redis.
4. Run `npm start`.
5. Open `http://localhost:8080`.
6. Log in with the demo user configured in the local identity provider.

The gateway proxies the Angular dev servers and API while the browser uses the gateway origin.

## Production notes

Place the auth gateway behind the normal routing/load-balancing layer used by the environment. The auth gateway owns the browser session, OIDC client, token lifecycle and application-aware route mapping.

Use HTTPS and a `Secure; HttpOnly` host-only session cookie. Keep explicit CSRF protection even with SameSite cookies. Sanitize forwarded headers at the trusted reverse-proxy boundary.

The sample uses a static `X-CSRF: 1` header plus strict Origin checking for mutating browser requests. A production framework-native anti-forgery mechanism is also a good choice.

The API still validates the access token signature, issuer, audience, expiry and the scopes/roles required for the operation. The gateway is responsible for safely obtaining and forwarding the credential; the API remains responsible for authorization.
