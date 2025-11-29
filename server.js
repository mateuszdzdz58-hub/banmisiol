// Bank Miśiołów - simple demo server (Express + SQLite)
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbFile = path.join(__dirname, 'bank.db');
const db = new sqlite3.Database(dbFile);

// Initialize DB if needed
const initSql = fs.readFileSync(path.join(__dirname, 'db_init.sql'), 'utf8');
db.exec(initSql, (err) => {
  if (err) console.error('Init DB error:', err);
});

// Seed some users if empty
const seedUsers = async () => {
  db.get("SELECT COUNT(*) as c FROM users", async (err, row) => {
    if (err) return console.error(err);
    if (row.c === 0) {
      const users = [
        { username: 'misiu1', password: 'haslo1', balance: 1000, role: 'user' },
        { username: 'misiu2', password: 'haslo2', balance: 500, role: 'user' },
        { username: 'admin', password: 'adminpass', balance: 100000, role: 'admin' }
      ];
      for (const u of users) {
        const ph = await bcrypt.hash(u.password, 10);
        db.run("INSERT INTO users (username, password_hash, balance, role) VALUES (?, ?, ?, ?)", [u.username, ph, u.balance, u.role]);
      }
      console.log('Seeded users');
    }
  });
};
seedUsers();

function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'No token' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid auth header' });
  jwt.verify(parts[1], JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = payload;
    next();
  });
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const ph = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, ph], function(err) {
    if (err) return res.status(400).json({ error: 'Username taken' });
    db.get('SELECT id, username, role, balance FROM users WHERE id = ?', [this.lastID], (err2, user) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      const token = createToken(user);
      res.json({ user, token });
    });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT id, username, password_hash, role, balance FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = createToken(row);
    res.json({ user: { id: row.id, username: row.username, role: row.role, balance: row.balance }, token });
  });
});

app.get('/api/me', authMiddleware, (req, res) => {
  db.get('SELECT id, username, balance, role FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ user: row });
  });
});

app.get('/api/users', authMiddleware, (req, res) => {
  db.all('SELECT id, username, balance FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ users: rows });
  });
});

app.post('/api/transfer', authMiddleware, (req, res) => {
  const fromId = req.user.id;
  const { toUsername, amount } = req.body;
  const amt = parseInt(amount, 10);
  if (!toUsername || !amt || amt <= 0) return res.status(400).json({ error: 'Invalid transfer' });

  db.serialize(() => {
    db.get('SELECT id, balance FROM users WHERE username = ?', [toUsername], (err, toRow) => {
      if (err || !toRow) return res.status(400).json({ error: 'Recipient not found' });
      db.get('SELECT id, balance FROM users WHERE id = ?', [fromId], (err2, fromRow) => {
        if (err2 || !fromRow) return res.status(500).json({ error: 'Sender not found' });
        if (fromRow.balance < amt) return res.status(400).json({ error: 'Insufficient funds' });

        db.run('BEGIN TRANSACTION');
        db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [amt, fromId], function(err3) {
          if (err3) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Transfer failed' });
          }
          db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [amt, toRow.id], function(err4) {
            if (err4) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Transfer failed' });
            }
            db.run('COMMIT');
            return res.json({ success: true });
          });
        });
      });
    });
  });
});

app.get('/api/admin/users', authMiddleware, adminOnly, (req, res) => {
  db.all('SELECT id, username, balance, role FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ users: rows });
  });
});

app.post('/api/admin/adjust', authMiddleware, adminOnly, (req, res) => {
  const { username, newBalance } = req.body;
  const nb = parseInt(newBalance, 10);
  if (!username || isNaN(nb)) return res.status(400).json({ error: 'Invalid data' });
  db.run('UPDATE users SET balance = ? WHERE username = ?', [nb, username], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
