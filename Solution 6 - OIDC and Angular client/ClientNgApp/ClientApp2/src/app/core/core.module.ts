import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth/auth.service';
import { AuthModule, OidcSecurityService } from 'angular-auth-oidc-client';

@NgModule({
  imports: [
    CommonModule,
    AuthModule.forRoot()
  ],
  declarations: [],
  providers: [
    AuthService,
    OidcSecurityService,
  ]
})
export class CoreModule { }
