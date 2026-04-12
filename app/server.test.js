const request = require('supertest');

// Mock simple del servidor para tests
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = 'test_secret';
const app = express();
app.use(express.json());

const users = [{ id: 1, username: 'admin', password: bcrypt.hashSync('admin123', 8), role: 'admin' }];
let products = [
  { id: 1, name: 'Lomo Saltado', price: 28.50, category: 'Platos de fondo', available: true },
];

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(403).json({ error: 'Token inválido' }); }
}

app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Credenciales inválidas' });
  const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '1h' });
  res.json({ token });
});
app.get('/products', auth, (req, res) => res.json({ products }));
app.post('/products', auth, (req, res) => {
  const { name, price } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'name y price requeridos' });
  const p = { id: products.length + 1, name, price, available: true };
  products.push(p);
  res.status(201).json(p);
});

// ── Tests ──────────────────────────────────────────────────────────
describe('Health Check', () => {
  test('GET /health devuelve status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Autenticación', () => {
  test('Login exitoso con credenciales válidas', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('Login fallido con credenciales inválidas', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'wrongpass' });
    expect(res.statusCode).toBe(401);
  });

  test('Acceso a ruta protegida sin token retorna 401', async () => {
    const res = await request(app).get('/products');
    expect(res.statusCode).toBe(401);
  });
});

describe('Gestión de Productos', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    token = res.body.token;
  });

  test('GET /products retorna lista de productos', async () => {
    const res = await request(app)
      .get('/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  test('POST /products crea un nuevo producto', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Arroz con Leche', price: 8.00, category: 'Postres' });
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Arroz con Leche');
  });

  test('POST /products falla sin datos requeridos', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Postres' });
    expect(res.statusCode).toBe(400);
  });
});
