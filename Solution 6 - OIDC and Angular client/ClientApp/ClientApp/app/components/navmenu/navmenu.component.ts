import { Component, OnInit } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { Subscription } from 'rxjs/Subscription';

@Component({
    selector: 'nav-menu',
    templateUrl: './navmenu.component.html',
    styleUrls: ['./navmenu.component.css']
})
export class NavMenuComponent implements OnInit {

    private isAuthorizedSubscription: Subscription = new Subscription();
    public isAuthorized: boolean = false;

    constructor(private authService: AuthService) {
    }

    ngOnInit(): void {
        this.isAuthorizedSubscription = this.authService.getIsAuthorized().subscribe(
            (isAuthorized: boolean) => {
                this.isAuthorized = isAuthorized;
        });
    }

    ngOnDestroy(): void {
        this.isAuthorizedSubscription.unsubscribe();
    }

    public login() {
        this.authService.login();
    }

    public logout() {
        this.authService.logout();
    }
}
