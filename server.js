const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'axtral-os-ultra-secure-key-2026';

// Initialize SQLite database using native node:sqlite
const db = new DatabaseSync(path.join(__dirname, 'axtral.db'));

// Enable foreign key support
db.exec('PRAGMA foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'store',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS store_info (
    store_id TEXT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT DEFAULT '',
    cnpj TEXT DEFAULT '',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    header_msg TEXT DEFAULT '',
    footer_msg TEXT DEFAULT 'Obrigado pela preferência!\nVolte sempre!',
    logo_url TEXT DEFAULT '',
    primary_color TEXT DEFAULT '#7c3aed',
    secondary_color TEXT DEFAULT '#c084fc'
  );

  CREATE TABLE IF NOT EXISTS store_settings (
    store_id TEXT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    audio INTEGER DEFAULT 1,
    low_stock_alert INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    cost REAL NOT NULL,
    stock INTEGER NOT NULL,
    min_stock INTEGER NOT NULL,
    color TEXT,
    sold INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, sku)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    points INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0.0,
    tier TEXT DEFAULT 'Bronze',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    store_id TEXT REFERENCES stores(id) ON DELETE CASCADE,
    sale_code TEXT NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    customer_name TEXT DEFAULT 'Consumidor Geral',
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0.0,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id TEXT REFERENCES sales(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL
  );
`);

// SQL Transaction Helper for node:sqlite
function runInTransaction(fn) {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Helper to seed users and mock data on first startup
function seedDatabase() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM stores');
  const userCount = stmt.get();
  
  if (userCount.count === 0) {
    console.log('Database empty. Creating default user accounts and seeding demo data...');

    const adminHash = bcrypt.hashSync('n@biostoreadmin2026', 10);
    const demoHash = bcrypt.hashSync('demo123', 10);

    runInTransaction(() => {
      // 1. Create Superadmin Account
      db.prepare('INSERT INTO stores (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
        .run('superadmin', 'Nabio Master', 'admin@nabio.com', adminHash, 'superadmin');

      db.prepare('INSERT INTO store_info (store_id, name, email, primary_color, secondary_color) VALUES (?, ?, ?, ?, ?)')
        .run('superadmin', 'Nabio Master', 'admin@nabio.com', '#7c3aed', '#c084fc');

      db.prepare('INSERT INTO store_settings (store_id) VALUES (?)')
        .run('superadmin');

      // 2. Create Demo Store Account
      db.prepare('INSERT INTO stores (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
        .run('loja_demo', 'Loja Demo Nabio', 'demo@nabio.com', demoHash, 'store');

      db.prepare('INSERT INTO store_info (store_id, name, cnpj, address, phone, email, header_msg, logo_url, primary_color, secondary_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(
          'loja_demo',
          'Nabio Store Demo',
          '12.345.678/0001-90',
          'Av. Paulista, 1000 - Bela Vista - São Paulo, SP',
          '(11) 3232-4040',
          'contato@nabio.com',
          'CUPOM DE VENDA NABIO',
          '/logo-nabio-store/logo.png', // default path to standard logo
          '#7c3aed',
          '#c084fc'
        );

      db.prepare('INSERT INTO store_settings (store_id) VALUES (?)')
        .run('loja_demo');

      // 3. Seed Demo Store mock data (from public/mockData.js)
      const mockProducts = [
        { id: 'prod-1', name: 'Mouse Gamer Axtral Neon', sku: 'AXT-MS-88', category: 'Acessórios', price: 249.90, cost: 110.00, stock: 42, minStock: 10, sold: 156, color: 'linear-gradient(135deg, #7c3aed, #a78bfa)' },
        { id: 'prod-2', name: 'Teclado Mecânico Axtral Pro', sku: 'AXT-KB-99', category: 'Periféricos', price: 589.90, cost: 260.00, stock: 15, minStock: 5, sold: 98, color: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
        { id: 'prod-3', name: 'Headset Gamer wireless Pulse', sku: 'AXT-HS-12', category: 'Áudio', price: 429.90, cost: 180.00, stock: 3, minStock: 8, sold: 74, color: 'linear-gradient(135deg, #7c3aed, #c084fc)' },
        { id: 'prod-4', name: 'Monitor Axtral Curved 27\'', sku: 'AXT-MN-27', category: 'Monitores', price: 1899.00, cost: 950.00, stock: 12, minStock: 4, sold: 34, color: 'linear-gradient(135deg, #1e1b4b, #312e81)' },
        { id: 'prod-5', name: 'Cadeira Gamer Ergonomic-X', sku: 'AXT-CH-01', category: 'Móveis', price: 1299.90, cost: 620.00, stock: 6, minStock: 3, sold: 21, color: 'linear-gradient(135deg, #c084fc, #a78bfa)' },
        { id: 'prod-6', name: 'Mousepad Speed XL Spectrum', sku: 'AXT-MP-05', category: 'Acessórios', price: 119.90, cost: 40.00, stock: 65, minStock: 15, sold: 220, color: 'linear-gradient(135deg, #09090b, #7c3aed)' },
        { id: 'prod-7', name: 'Webcam Axtral Streamer 4K', sku: 'AXT-WC-4K', category: 'Periféricos', price: 649.90, cost: 300.00, stock: 2, minStock: 5, sold: 45, color: 'linear-gradient(135deg, #4f46e5, #c084fc)' },
        { id: 'prod-8', name: 'Microfone Condensador Vocalist', sku: 'AXT-MC-02', category: 'Áudio', price: 379.90, cost: 150.00, stock: 25, minStock: 6, sold: 83, color: 'linear-gradient(135deg, #6366f1, #7c3aed)' }
      ];

      const mockCustomers = [
        { id: 'cust-1', name: 'Thiago Silva', email: 'thiago.silva@email.com', phone: '(11) 98765-4321', totalSpent: 2738.80, points: 270, tier: 'Gold' },
        { id: 'cust-2', name: 'Mariana Costa', email: 'mariana.c@email.com', phone: '(21) 99888-7766', totalSpent: 1899.00, points: 190, tier: 'Silver' },
        { id: 'cust-3', name: 'Lucas Oliveira', email: 'lucas.ol@email.com', phone: '(31) 97777-8888', totalSpent: 5128.50, points: 510, tier: 'Platinum' },
        { id: 'cust-4', name: 'Beatriz Santos', email: 'bia.santos@email.com', phone: '(19) 99654-3210', totalSpent: 369.80, points: 35, tier: 'Bronze' },
        { id: 'cust-5', name: 'Felipe Almeida', email: 'felipe.almeida@email.com', phone: '(41) 99123-4567', totalSpent: 0.00, points: 0, tier: 'Bronze' }
      ];

      const mockSales = [
        { id: 'VNDA-1001', date: '2026-05-20T10:30:00.000Z', subtotal: 489.70, discount: 20.00, total: 469.70, paymentMethod: 'Cartão de Crédito', customerName: 'Thiago Silva', items: [{ productId: 'prod-1', quantity: 1, price: 249.90 }, { productId: 'prod-6', quantity: 2, price: 119.90 }] },
        { id: 'VNDA-1002', date: '2026-05-21T14:15:00.000Z', subtotal: 1899.00, discount: 0.00, total: 1899.00, paymentMethod: 'PIX', customerName: 'Mariana Costa', items: [{ productId: 'prod-4', quantity: 1, price: 1899.00 }] },
        { id: 'VNDA-1003', date: '2026-05-21T18:45:00.000Z', subtotal: 809.80, discount: 40.00, total: 769.80, paymentMethod: 'Dinheiro', customerName: 'Lucas Oliveira', items: [{ productId: 'prod-3', quantity: 1, price: 429.90 }, { productId: 'prod-8', quantity: 1, price: 379.90 }] },
        { id: 'VNDA-1004', date: '2026-05-22T09:00:00.000Z', subtotal: 589.90, discount: 0.00, total: 589.90, paymentMethod: 'PIX', customerName: 'Beatriz Santos', items: [{ productId: 'prod-2', quantity: 1, price: 589.90 }] }
      ];

      const insertProduct = db.prepare(`
        INSERT INTO products (id, store_id, name, sku, category, price, cost, stock, min_stock, color, sold)
        VALUES (?, 'loja_demo', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertCustomer = db.prepare(`
        INSERT INTO customers (id, store_id, name, email, phone, total_spent, points, tier)
        VALUES (?, 'loja_demo', ?, ?, ?, ?, ?, ?)
      `);
      const insertSale = db.prepare(`
        INSERT INTO sales (id, store_id, sale_code, date, customer_name, subtotal, discount, total, payment_method)
        VALUES (?, 'loja_demo', ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSaleItem = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, price)
        VALUES (?, ?, ?, ?)
      `);

      for (const p of mockProducts) {
        insertProduct.run(p.id, p.name, p.sku, p.category, p.price, p.cost, p.stock, p.minStock, p.color, p.sold);
      }
      for (const c of mockCustomers) {
        insertCustomer.run(c.id, c.name, c.email, c.phone, c.totalSpent, c.points, c.tier);
      }
      for (const s of mockSales) {
        insertSale.run(s.id, s.id, s.date, s.customerName, s.subtotal, s.discount, s.total, s.paymentMethod);
        for (const item of s.items) {
          insertSaleItem.run(s.id, item.productId, item.quantity, item.price);
        }
      }
    });

    console.log('Database seeded successfully.');
  }
}

seedDatabase();

// Force update superadmin password on boot to match new requirement
try {
  const forcedAdminHash = bcrypt.hashSync('n@biostoreadmin2026', 10);
  db.prepare('UPDATE stores SET password_hash = ? WHERE id = ?').run(forcedAdminHash, 'superadmin');
  console.log('Superadmin password verified and updated.');
} catch (err) {
  console.error('Failed to update superadmin password at startup:', err);
}

// Middleware configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));

app.use(express.json());
app.use(cookieParser());

// Custom simple JWT extraction middleware
const authenticateJWT = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: 'Acesso não autorizado. Por favor faça login.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.status(401).json({ message: 'Sessão expirada. Por favor faça login novamente.' });
  }
};

// Route security redirects for HTML files
app.get('/', (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/login.html');
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next(); // Authenticated, serve static index.html
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login.html');
  }
});

app.get('/index.html', (req, res) => {
  res.redirect('/');
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serving other static assets
app.use(express.static(path.join(__dirname, 'public')));

/* --- API ROUTES --- */

// Authenticate user & login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'E-mail/usuário e senha são obrigatórios.' });
  }

  try {
    // Find store account by email or store ID
    const user = db.prepare('SELECT * FROM stores WHERE email = ? OR id = ?').get(email, email);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ message: 'E-mail/usuário ou senha incorretos.' });
    }

    // Sign jwt token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to true if running on HTTPS
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    res.json({
      message: 'Login realizado com sucesso.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Erro interno no servidor.' });
  }
});

// Logout user
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout realizado com sucesso.' });
});

// Get logged-in user profile
app.get('/api/auth/me', authenticateJWT, (req, res) => {
  const storeInfo = db.prepare('SELECT name FROM store_info WHERE store_id = ?').get(req.user.id);
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    storeName: storeInfo ? storeInfo.name : req.user.name
  });
});

// PRODUCTS API (Tenant Isolated)
app.get('/api/products', authenticateJWT, (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products WHERE store_id = ?').all(req.user.id);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar produtos.' });
  }
});

app.post('/api/products', authenticateJWT, (req, res) => {
  const { id, name, sku, category, price, cost, stock, minStock, color } = req.body;
  if (!name || !sku || !category || price === undefined || cost === undefined || stock === undefined || minStock === undefined) {
    return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
  }

  const generatedId = id || `prod-${Date.now()}`;

  try {
    db.prepare(`
      INSERT INTO products (id, store_id, name, sku, category, price, cost, stock, min_stock, color, sold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(generatedId, req.user.id, name, sku, category, price, cost, stock, minStock, color);

    res.status(201).json({ message: 'Produto cadastrado com sucesso.' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'Já existe um produto cadastrado com este código SKU.' });
    }
    res.status(500).json({ message: 'Erro ao cadastrar produto.' });
  }
});

app.put('/api/products/:id', authenticateJWT, (req, res) => {
  const { id } = req.params;
  const { name, sku, category, price, cost, stock, minStock, color } = req.body;

  try {
    const result = db.prepare(`
      UPDATE products
      SET name = ?, sku = ?, category = ?, price = ?, cost = ?, stock = ?, min_stock = ?, color = ?
      WHERE id = ? AND store_id = ?
    `).run(name, sku, category, price, cost, stock, minStock, color, id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }
    res.json({ message: 'Produto atualizado com sucesso.' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'Código SKU já está sendo utilizado por outro produto.' });
    }
    res.status(500).json({ message: 'Erro ao atualizar produto.' });
  }
});

app.delete('/api/products/:id', authenticateJWT, (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM products WHERE id = ? AND store_id = ?').run(id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }
    res.json({ message: 'Produto removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao remover produto.' });
  }
});

// CUSTOMERS API (Tenant Isolated)
app.get('/api/customers', authenticateJWT, (req, res) => {
  try {
    const customers = db.prepare('SELECT * FROM customers WHERE store_id = ?').all(req.user.id);
    res.json(customers.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      points: c.points,
      totalSpent: c.total_spent,
      tier: c.tier
    })));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar clientes.' });
  }
});

app.post('/api/customers', authenticateJWT, (req, res) => {
  const { id, name, email, phone } = req.body;
  if (!name || !email) {
    return res.status(400).json({ message: 'Nome e E-mail são obrigatórios.' });
  }

  const generatedId = id || `cust-${Date.now()}`;

  try {
    db.prepare(`
      INSERT INTO customers (id, store_id, name, email, phone, points, total_spent, tier)
      VALUES (?, ?, ?, ?, ?, 0, 0.0, 'Bronze')
    `).run(generatedId, req.user.id, name, email, phone);

    res.status(201).json({ message: 'Cliente cadastrado com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao cadastrar cliente.' });
  }
});

app.put('/api/customers/:id', authenticateJWT, (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;

  try {
    const result = db.prepare(`
      UPDATE customers
      SET name = ?, email = ?, phone = ?
      WHERE id = ? AND store_id = ?
    `).run(name, email, phone, id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }
    res.json({ message: 'Cliente atualizado com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar cliente.' });
  }
});

app.delete('/api/customers/:id', authenticateJWT, (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM customers WHERE id = ? AND store_id = ?').run(id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }
    res.json({ message: 'Cliente removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao remover cliente.' });
  }
});

// SALES TRANSACTION API (Tenant Isolated)
app.get('/api/sales', authenticateJWT, (req, res) => {
  try {
    const sales = db.prepare('SELECT * FROM sales WHERE store_id = ? ORDER BY date DESC').all(req.user.id);
    const salesList = [];

    for (const s of sales) {
      const items = db.prepare('SELECT product_id, quantity, price FROM sale_items WHERE sale_id = ?').all(s.id);
      salesList.push({
        id: s.id,
        date: s.date,
        subtotal: s.subtotal,
        discount: s.discount,
        total: s.total,
        paymentMethod: s.payment_method,
        customerName: s.customer_name,
        products: items.map(i => ({
          productId: i.product_id,
          quantity: i.quantity,
          price: i.price
        }))
      });
    }

    res.json(salesList);
  } catch (err) {
    console.error('Error fetching sales:', err);
    res.status(500).json({ message: 'Erro ao buscar vendas.' });
  }
});

app.post('/api/sales', authenticateJWT, (req, res) => {
  const { id, products, subtotal, discount, total, paymentMethod, customerName } = req.body;
  if (!products || products.length === 0 || subtotal === undefined || total === undefined || !paymentMethod) {
    return res.status(400).json({ message: 'Dados da transação incompletos.' });
  }

  const saleId = id || `VNDA-${1000 + Date.now() % 100000}`;

  try {
    runInTransaction(() => {
      // 1. Verify stock levels for all products first
      const checkStockStmt = db.prepare('SELECT stock, name, sold FROM products WHERE id = ? AND store_id = ?');
      const deductStockStmt = db.prepare('UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ? AND store_id = ?');

      for (const item of products) {
        const prod = checkStockStmt.get(item.productId, req.user.id);
        if (!prod || prod.stock < item.quantity) {
          throw new Error(`Estoque insuficiente para o produto: ${prod ? prod.name : 'Desconhecido'}`);
        }
      }

      // 2. Deduct stocks
      for (const item of products) {
        deductStockStmt.run(item.quantity, item.quantity, item.productId, req.user.id);
      }

      // 3. Create Sale record
      db.prepare(`
        INSERT INTO sales (id, store_id, sale_code, date, customer_name, subtotal, discount, total, payment_method)
        VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?)
      `).run(saleId, req.user.id, saleId, customerName || 'Consumidor Geral', subtotal, discount, total, paymentMethod);

      // 4. Create Sale items
      const insertItemStmt = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, price)
        VALUES (?, ?, ?, ?)
      `);

      for (const item of products) {
        insertItemStmt.run(saleId, item.productId, item.quantity, item.price);
      }

      // 5. If registered customer, increment their points and totalSpent
      if (customerName && customerName !== 'Consumidor Geral') {
        const cust = db.prepare('SELECT id, points, total_spent FROM customers WHERE name = ? AND store_id = ?')
          .get(customerName, req.user.id);

        if (cust) {
          const newTotalSpent = cust.total_spent + total;
          const newPoints = cust.points + Math.floor(total / 10);
          
          let newTier = 'Bronze';
          if (newPoints >= 500) newTier = 'Platinum';
          else if (newPoints >= 250) newTier = 'Gold';
          else if (newPoints >= 100) newTier = 'Silver';

          db.prepare(`
            UPDATE customers
            SET total_spent = ?, points = ?, tier = ?
            WHERE id = ?
          `).run(newTotalSpent, newPoints, newTier, cust.id);
        }
      }
    });

    res.status(201).json({ id: saleId, message: 'Venda processada com sucesso!' });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(400).json({ message: err.message || 'Erro ao processar checkout.' });
  }
});

// SETTINGS API
app.get('/api/settings', authenticateJWT, (req, res) => {
  try {
    let info = db.prepare('SELECT * FROM store_info WHERE store_id = ?').get(req.user.id);
    let settings = db.prepare('SELECT * FROM store_settings WHERE store_id = ?').get(req.user.id);

    if (!info) {
      db.prepare('INSERT INTO store_info (store_id, name) VALUES (?, ?)').run(req.user.id, req.user.name);
      info = db.prepare('SELECT * FROM store_info WHERE store_id = ?').get(req.user.id);
    }
    if (!settings) {
      db.prepare('INSERT INTO store_settings (store_id) VALUES (?)').run(req.user.id);
      settings = db.prepare('SELECT * FROM store_settings WHERE store_id = ?').get(req.user.id);
    }

    res.json({
      settings: {
        audio: !!settings.audio,
        lowStockAlert: !!settings.low_stock_alert
      },
      storeInfo: {
        name: info.name || '',
        cnpj: info.cnpj || '',
        address: info.address || '',
        phone: info.phone || '',
        email: info.email || '',
        headerMsg: info.header_msg || '',
        footerMsg: info.footer_msg || '',
        logoUrl: info.logo_url || '',
        primaryColor: info.primary_color || '#7c3aed',
        secondaryColor: info.secondary_color || '#c084fc'
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar configurações.' });
  }
});

app.post('/api/settings', authenticateJWT, (req, res) => {
  const { settings, storeInfo } = req.body;

  try {
    runInTransaction(() => {
      if (storeInfo) {
        db.prepare(`
          UPDATE store_info
          SET name = ?, cnpj = ?, address = ?, phone = ?, email = ?, header_msg = ?, footer_msg = ?, logo_url = ?, primary_color = ?, secondary_color = ?
          WHERE store_id = ?
        `).run(
          storeInfo.name || '',
          storeInfo.cnpj || '',
          storeInfo.address || '',
          storeInfo.phone || '',
          storeInfo.email || '',
          storeInfo.headerMsg || '',
          storeInfo.footerMsg || '',
          storeInfo.logoUrl || '',
          storeInfo.primaryColor || '#7c3aed',
          storeInfo.secondaryColor || '#c084fc',
          req.user.id
        );
      }

      if (settings) {
        db.prepare(`
          UPDATE store_settings
          SET audio = ?, low_stock_alert = ?
          WHERE store_id = ?
        `).run(
          settings.audio ? 1 : 0,
          settings.lowStockAlert ? 1 : 0,
          req.user.id
        );
      }
    });

    res.json({ message: 'Configurações salvas com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao salvar configurações.' });
  }
});

// Endpoint para fazer upload de logotipo customizado em Base64
app.post('/api/upload-logo', authenticateJWT, (req, res) => {
  const { filename, base64 } = req.body;
  if (!filename || !base64) {
    return res.status(400).json({ message: 'Arquivo e conteúdo são obrigatórios.' });
  }

  try {
    const fs = require('fs');
    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ message: 'Formato de imagem inválido.' });
    }

    const imageBuffer = Buffer.from(matches[2], 'base64');
    const ext = path.extname(filename) || '.png';
    const storeId = req.user.id;
    
    // Nome do arquivo único por loja
    const relativePath = `/logo-nabio-store/logo-${storeId}${ext}`;
    const absolutePath = path.join(__dirname, 'public', relativePath);

    // Garantir que a pasta exista
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(absolutePath, imageBuffer);

    res.json({
      message: 'Upload realizado com sucesso.',
      logoUrl: relativePath
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Erro ao salvar o logotipo no servidor.' });
  }
});

// SUPERADMIN MANAGEMENT ROUTES
const requireSuperadmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Acesso negado. Apenas super usuário pode realizar esta ação.' });
  }
  next();
};

app.get('/api/admin/stores', authenticateJWT, requireSuperadmin, (req, res) => {
  try {
    const stores = db.prepare("SELECT id, name, email, role, created_at FROM stores WHERE role != 'superadmin'").all();
    res.json(stores);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar lojas.' });
  }
});

app.post('/api/admin/stores', authenticateJWT, requireSuperadmin, (req, res) => {
  const { id, name, email, password } = req.body;
  if (!id || !name || !email || !password) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    
    runInTransaction(() => {
      db.prepare('INSERT INTO stores (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
        .run(id, name, email, hash, 'store');

      db.prepare('INSERT INTO store_info (store_id, name, email) VALUES (?, ?, ?)')
        .run(id, name, email);

      db.prepare('INSERT INTO store_settings (store_id) VALUES (?)')
        .run(id);
    });

    res.status(201).json({ message: 'Nova loja criada com sucesso!' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'Já existe uma loja registrada com este ID ou E-mail.' });
    }
    res.status(500).json({ message: 'Erro ao criar loja.' });
  }
});

app.delete('/api/admin/stores/:id', authenticateJWT, requireSuperadmin, (req, res) => {
  const { id } = req.params;
  if (id === 'superadmin' || id === 'loja_demo') {
    return res.status(400).json({ message: 'Não é possível remover lojas do sistema padrão.' });
  }

  try {
    const result = db.prepare("DELETE FROM stores WHERE id = ? AND role = 'store'").run(id);
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Loja não encontrada.' });
    }
    res.json({ message: 'Loja removida do sistema com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao remover loja.' });
  }
});

app.get('/api/admin/stats', authenticateJWT, requireSuperadmin, (req, res) => {
  try {
    const totalStores = db.prepare("SELECT COUNT(*) as count FROM stores WHERE role = 'store'").get().count;
    const totalProducts = db.prepare("SELECT COUNT(*) as count FROM products").get().count;
    const totalRevenue = db.prepare("SELECT SUM(total) as sum FROM sales").get().sum || 0.0;
    const totalSales = db.prepare("SELECT COUNT(*) as count FROM sales").get().count;

    res.json({
      totalStores,
      totalProducts,
      totalRevenue,
      totalSales
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao calcular estatísticas globais.' });
  }
});

app.listen(PORT, () => {
  console.log(`AXTRAL OS secure backend listening on http://localhost:${PORT}`);
});
