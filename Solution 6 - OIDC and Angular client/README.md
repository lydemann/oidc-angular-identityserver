# OIDC with Angular client

Creating an Angular client with implicit flow OIDC client, that can call an authorized end point on the resource api.

Authorization server:
Create spaClient with implicit grant

Client app:
Setup Angular app. I updated this to use Angular 5.
Install the angular-auth-oidc-client package and setup the urls. Create methods for doing http calls that sets the Authorization header with the bearer token.

Resource api:
Setup an authorized controller with a method providing weather data.
