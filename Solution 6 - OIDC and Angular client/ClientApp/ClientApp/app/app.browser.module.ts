import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppModuleShared } from './app.shared.module';
import { AppComponent } from './components/app/app.component';

@NgModule({
    bootstrap: [ AppComponent ],
    imports: [
        BrowserModule,
        AppModuleShared
    ],
    providers: [
        { provide: 'ORIGIN_URL', useFactory: getBaseUrl },
        { provide: 'API_URL', useFactory: apiUrlFactory },
        { provide: 'AUTH_URL', useFactory: authUrlFactory },
    ]
})
export class AppModule {
}

export function getBaseUrl() {
    return document.getElementsByTagName('base')[0].href;
}

export function apiUrlFactory() {
    return (window as any).urlConfig.apiUrl;
}

export function authUrlFactory() {
    return (window as any).urlConfig.authUrl;
}
