import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { AuthService } from '../core/auth/auth.service';

@Component({
    selector: 'app-unauthorized',
    templateUrl: 'unauthorized.component.html'
})
export class UnauthorizedComponent implements OnInit {

    constructor(private location: Location, private authService: AuthService) {

    }

    ngOnInit() {
    }

    login() {
        this.authService.login();
    }

    goback() {
        this.location.back();
    }
}