import { Component, OnInit } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { Subscription, Observable } from 'rxjs';
import { share } from 'rxjs/operators';

@Component({
  selector: 'app-nav-menu',
  templateUrl: './nav-menu.component.html',
  styleUrls: ['./nav-menu.component.scss']
})
export class NavMenuComponent implements OnInit {
  isExpanded = false;
  isAuthorized$: Observable<boolean>;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.isAuthorized$ = this.authService.isAuthorized$.pipe(share());
  }

  collapse() {
    this.isExpanded = false;
  }

  toggle() {
    this.isExpanded = !this.isExpanded;
  }

  public login() {
    this.authService.login();
  }

  public logout() {
    this.authService.logout();
  }
}
