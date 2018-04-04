# OIDC with hybrid flow

Setting up OIDC with hybrid flow, enabling a spa client and a server (with offline access) to share the same client configuration

Authorization Server:
1) Added new client with hybrid flow and a client secret shared with the auth server and the client

Client server:
1) Setup OIDC middleware with ClientSecret, Scope and response type "code ID_TOKEN" for providing both the authorization code and ID token on first roundtrip.
2) Setup IdentityServer with method for calling api with access token (obtained trough the hybrid flow client) and one for invoke with token from client credentials authentication
