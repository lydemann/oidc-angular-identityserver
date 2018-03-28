import { Injectable, OnInit, Inject } from "@angular/core";
import { OidcSecurityService, OpenIDImplicitFlowConfiguration, AuthWellKnownEndpoints } from 'angular-auth-oidc-client';
import { Observable } from "rxjs/Observable";
import { Http } from "@angular/common/http";


@Injectable()
export class AuthService implements OnInit {

    constructor(
        private oidcSecurityService: OidcSecurityService,
        private http: Http,
        @Inject('ORIGIN_URL') originUrl: string,
        @Inject('AUTH_URL') authUrl: string,
    ) {
        const openIdImplicitFlowConfiguration = new OpenIDImplicitFlowConfiguration();
        openIdImplicitFlowConfiguration.stsServer = authUrl,
        openIdImplicitFlowConfiguration.redirect_url = originUrl + 'callback',
        openIdImplicitFlowConfiguration.client_id = 'spaClient';
        openIdImplicitFlowConfiguration.response_type = 'id_token token';
        openIdImplicitFlowConfiguration.scope = 'openid profile resourceApi';
        openIdImplicitFlowConfiguration.post_logout_redirect_uri = originUrl + 'home';
        openIdImplicitFlowConfiguration.forbidden_route = '/forbidden';
        openIdImplicitFlowConfiguration.unauthorized_route = '/unauthorized';
        openIdImplicitFlowConfiguration.auto_userinfo = true;
        openIdImplicitFlowConfiguration.log_console_warning_active = true;
        openIdImplicitFlowConfiguration.log_console_debug_active = true;
        openIdImplicitFlowConfiguration.max_id_token_iat_offset_allowed_in_seconds = 10;

        const authWellKnownEndpoints = new AuthWellKnownEndpoints();
        authWellKnownEndpoints.issuer = authUrl;
            
        authWellKnownEndpoints.jwks_uri = authUrl + '/.well-known/openid-configuration/jwks';
        authWellKnownEndpoints.authorization_endpoint = authUrl + '/connect/authorize';
        authWellKnownEndpoints.token_endpoint = authUrl + '/connect/token';
        authWellKnownEndpoints.userinfo_endpoint = authUrl + '/connect/userinfo';
        authWellKnownEndpoints.end_session_endpoint = authUrl + '/connect/endsession';
        authWellKnownEndpoints.check_session_iframe = authUrl + '/connect/checksession';
        authWellKnownEndpoints.revocation_endpoint = authUrl + '/connect/revocation';
        authWellKnownEndpoints.introspection_endpoint = authUrl + '/connect/introspect';
        // TODO: setup
        this.oidcSecurityService.setupModule(openIdImplicitFlowConfiguration, authWellKnownEndpoints);

        if (this.oidcSecurityService.moduleSetup) {
            this.doCallbackLogicIfRequired();
        } else {
            this.oidcSecurityService.onModuleSetup.subscribe(() => {
                this.doCallbackLogicIfRequired();
            });
        }
    }

    ngOnInit(): void {
        throw new Error("Method not implemented.");
    }

    private doCallbackLogicIfRequired() {
        if (typeof location !== "undefined" && window.location.hash) {
            this.oidcSecurityService.authorizedCallback();
        }
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

    private appendAuthHeader(headers: HttpHeaders) {
        const token = this.oidcSecurityService.getToken();

        if (token === '') return headers;

        const tokenValue = 'Bearer ' + token;
        return headers.set('Authorization', tokenValue);
    }

}
