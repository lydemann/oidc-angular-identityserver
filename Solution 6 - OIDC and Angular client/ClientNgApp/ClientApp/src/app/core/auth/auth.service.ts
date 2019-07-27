import { Injectable, OnInit, OnDestroy, Inject } from '@angular/core';
import { OidcSecurityService, OpenIdConfiguration, AuthWellKnownEndpoints } from 'angular-auth-oidc-client';
import { Observable ,  Subscription } from 'rxjs';
import { HttpHeaders, HttpClient } from '@angular/common/http';

@Injectable()
export class AuthService implements OnDestroy {

    isAuthorized = false;

    constructor(
        private oidcSecurityService: OidcSecurityService,
        private http: HttpClient,
        @Inject('BASE_URL') private originUrl: string,
        @Inject('AUTH_URL') private authUrl: string,
    ) {
    }

    private isAuthorizedSubscription: Subscription = new Subscription;

    ngOnDestroy(): void {
        if (this.isAuthorizedSubscription) {
            this.isAuthorizedSubscription.unsubscribe();
        }
    }

    public initAuth() {
        const openIdImplicitFlowConfiguration: OpenIdConfiguration = {
            stsServer: this.authUrl,
            redirect_url: this.originUrl + 'callback',
            client_id: 'spaClient',
            response_type: 'id_token token',
            scope: 'openid profile resourceApi',
            post_logout_redirect_uri: this.originUrl,
            forbidden_route: '/forbidden',
            unauthorized_route: '/unauthorized',
            auto_userinfo: true,
            log_console_warning_active: true,
            log_console_debug_active: true,
            max_id_token_iat_offset_allowed_in_seconds: 10,
        };

        const authWellKnownEndpoints: AuthWellKnownEndpoints = {
            issuer: this.authUrl,
            jwks_uri: this.authUrl + '/.well-known/openid-configuration/jwks',
            authorization_endpoint: this.authUrl + '/connect/authorize',
            token_endpoint: this.authUrl + '/connect/token',
            userinfo_endpoint: this.authUrl + '/connect/userinfo',
            end_session_endpoint: this.authUrl + '/connect/endsession',
            check_session_iframe: this.authUrl + '/connect/checksession',
            revocation_endpoint: this.authUrl + '/connect/revocation',
            introspection_endpoint: this.authUrl + '/connect/introspect',
        };

        this.oidcSecurityService.setupModule(openIdImplicitFlowConfiguration, authWellKnownEndpoints);

        if (this.oidcSecurityService.moduleSetup) {
            this.doCallbackLogicIfRequired();
        } else {
            this.oidcSecurityService.onModuleSetup.subscribe(() => {
                this.doCallbackLogicIfRequired();
            });
        }
        this.isAuthorizedSubscription = this.oidcSecurityService.getIsAuthorized().subscribe((isAuthorized => {
            this.isAuthorized = isAuthorized;
        }));
    }


    private doCallbackLogicIfRequired() {

        this.oidcSecurityService.authorizedCallbackWithCode(window.location.toString());
    //   if (window.location.hash) {
    //     window.location.hash = decodeURIComponent(window.location.hash);
    //     // authorizedCallback returns wrong result when hash is URI encoded
    //   } else {

    //     this.oidcSecurityService.authorize();
    //   }
        // if (typeof location !== "undefined") {
        //    this.oidcSecurityService.authorizedCallback();
        // }
    }

    getIsAuthorized(): Observable<boolean> {
        return this.oidcSecurityService.getIsAuthorized();
    }

    login() {
        console.log('start login');
        this.oidcSecurityService.authorize();
    }

    logout() {
        console.log('start logoff');
        this.oidcSecurityService.logoff();
    }

    get(url: string): Observable<any> {
        return this.http.get(url, { headers: this.getHeaders() });
    }

    put(url: string, data: any): Observable<any> {
        const body = JSON.stringify(data);
        return this.http.put(url, body, { headers: this.getHeaders() });
    }

    delete(url: string): Observable<any> {
        return this.http.delete(url, { headers: this.getHeaders() });
    }

    post(url: string, data: any): Observable<any> {
        const body = JSON.stringify(data);
        return this.http.post(url, body, { headers: this.getHeaders() });
    }

    private getHeaders() {
        let headers = new HttpHeaders();
        headers = headers.set('Content-Type', 'application/json');
        return this.appendAuthHeader(headers);
    }

    public getToken() {
        const token = this.oidcSecurityService.getToken();
        return token;
    }

    private appendAuthHeader(headers: HttpHeaders) {
        const token = this.oidcSecurityService.getToken();

        if (token === '') { return headers; }

        const tokenValue = 'Bearer ' + token;
        return headers.set('Authorization', tokenValue);
    }
}
