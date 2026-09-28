import 'zone.js';
import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <main>
      <p class="eyebrow">Solution 7</p>
      <h1>Angular without OAuth tokens in the browser</h1>
      <p>{{ status() }}</p>

      <nav>
        <a href="/orders/">Open Orders microfrontend</a>
        <button type="button" (click)="logout()">Log out</button>
      </nav>

      <section>
        <h2>What Angular knows</h2>
        <p>Only the current session/user endpoint. No access token, refresh token, client secret, token refresh timer or OIDC callback code lives in this app.</p>
      </section>
    </main>
  `,
})
class AppComponent {
  readonly status = signal('Loading session…');

  constructor() {
    void this.loadSession();
  }

  private async loadSession() {
    const response = await fetch('/auth/session');
    if (!response.ok) {
      this.status.set('Not authenticated');
      return;
    }
    const session = await response.json();
    this.status.set(`Authenticated as ${session.user.name ?? session.user.email ?? session.user.sub}`);
  }

  async logout() {
    await fetch('/auth/logout', {
      method: 'POST',
      headers: { 'X-CSRF': '1' },
    });
    location.assign('/');
  }
}

bootstrapApplication(AppComponent).catch(console.error);
