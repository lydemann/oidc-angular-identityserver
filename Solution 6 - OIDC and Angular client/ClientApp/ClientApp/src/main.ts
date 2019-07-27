import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

export function getBaseUrl() {
  return document.getElementsByTagName('base')[0].href;
}

const providers = [
  { provide: 'BASE_URL', useFactory: getBaseUrl, deps: [] },
  { provide: 'AUTH_URL', useValue: 'https://localhost:44370' },
  { provide: 'API_URL', useValue: 'https://localhost:44340' }
];

platformBrowserDynamic(providers).bootstrapModule(AppModule)
  .catch(err => console.error(err));
