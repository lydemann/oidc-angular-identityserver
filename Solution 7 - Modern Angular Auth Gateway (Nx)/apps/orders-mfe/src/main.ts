import 'zone.js';
import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

@Component({
  selector: 'orders-root',
  standalone: true,
  template: `
    <main>
      <p><a href="/">← Shell</a></p>
      <h1>Orders microfrontend</h1>
      <p>This Angular app never receives an OAuth token.</p>

      <button type="button" (click)="createOrder()">Create order</button>
      <pre>{{ orders() }}</pre>
    </main>
  `,
})
class OrdersComponent {
  readonly orders = signal('Loading…');

  constructor() {
    void this.load();
  }

  private async load() {
    const response = await fetch('/api/orders');
    this.orders.set(JSON.stringify(await response.json(), null, 2));
  }

  async createOrder() {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF': '1',
      },
      body: JSON.stringify({ description: 'Created from orders MFE' }),
    });
    this.orders.set(JSON.stringify(await response.json(), null, 2));
  }
}

bootstrapApplication(OrdersComponent).catch(console.error);
