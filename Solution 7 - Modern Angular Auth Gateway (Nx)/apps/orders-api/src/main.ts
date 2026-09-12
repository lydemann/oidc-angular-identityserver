import 'dotenv/config';
import express from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express();
app.use(express.json());

const issuer = process.env.OIDC_ISSUER ?? 'http://localhost:8081/realms/angular-bff';
const jwks = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));

async function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authorization = req.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const token = authorization.slice('Bearer '.length);
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: 'orders-api',
    });

    (req as express.Request & { user?: unknown }).user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid access token' });
  }
}

app.use(authenticate);

const orders = [
  { id: 1, description: 'Initial example order' },
  { id: 2, description: 'Tokens remain server-side' },
];

app.get('/orders', (_req, res) => res.json(orders));

app.post('/orders', (req, res) => {
  const order = {
    id: orders.length + 1,
    description: String(req.body?.description ?? 'Untitled order'),
  };
  orders.push(order);
  res.status(201).json(order);
});

app.listen(4300, () => console.log('Orders API listening on http://localhost:4300'));
