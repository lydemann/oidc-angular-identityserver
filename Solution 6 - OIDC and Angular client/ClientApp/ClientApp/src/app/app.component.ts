import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  title = 'app';
  constructor(private authService: AuthService) {

  }
  ngOnInit(): void {
    this.authService.initAuth();
  }

  ngOnDestroy() {
    this.authService.ngOnDestroy();
  }
}
