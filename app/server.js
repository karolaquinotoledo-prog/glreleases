const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const promClient = require('prom-client');

const app = express();
app.use(express.json());

// ── CORS ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Prometheus metrics ──────────────────────────────────────────────
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 1, 1.5, 2, 5],
  registers: [register],
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ── Middleware de métricas ──────────────────────────────────────────
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.path, status_code: res.statusCode });
    httpRequestsTotal.inc({ method: req.method, route: req.path, status_code: res.statusCode });
  });
  next();
});

// ── Datos en memoria ────────────────────────────────────────────────
const users = [
  { id: 1, username: 'admin', password: bcrypt.hashSync('admin123', 8), role: 'admin' },
];

const products = [
  { id: 1, name: 'Lomo Saltado',   price: 28.50, category: 'Platos de fondo', available: true },
  { id: 2, name: 'Ceviche Clásico', price: 32.00, category: 'Entradas',        available: true },
  { id: 3, name: 'Inca Kola 500ml', price: 5.00,  category: 'Bebidas',         available: true },
];

const SECRET  = process.env.JWT_SECRET    || 'secret_devops_demo';
const ENV     = process.env.NODE_ENV      || 'development';
const PORT    = process.env.PORT          || 3000;
const VERSION = process.env.APP_VERSION   || '1.0.0';

// ── Auth middleware ─────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Token inválido' });
  }
}

// ── Routes ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: ENV, version: VERSION, timestamp: new Date().toISOString() });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Credenciales inválidas' });
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.get('/products', auth, (req, res) => {
  res.json({ products, total: products.length, env: ENV });
});

app.post('/products', auth, (req, res) => {
  const { name, price, category } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'name y price son requeridos' });
  const product = { id: products.length + 1, name, price, category: category || 'General', available: true };
  products.push(product);
  res.status(201).json(product);
});

app.put('/products/:id', auth, (req, res) => {
  const idx = products.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado' });
  products[idx] = { ...products[idx], ...req.body };
  res.json(products[idx]);
});

app.delete('/products/:id', auth, (req, res) => {
  const idx = products.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado' });
  products.splice(idx, 1);
  res.json({ message: 'Producto eliminado' });
});

app.listen(PORT, () => {
  console.log(`🍽️  RestauranteApp v${VERSION} corriendo en puerto ${PORT} [${ENV}]`);
});