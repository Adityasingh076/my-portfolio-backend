require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg'); // Ek hi baar import

const app = express();
const PORT = process.env.PORT || 5000;

// ─── MIDDLEWARE ──────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token', 'Accept']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── DATABASE POOL CONFIGURATION ────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query('SELECT NOW()')
  .then(() => {
    console.log('✅ PostgreSQL connected successfully!');
    initDB();
  })
  .catch((err) => {
    console.error('❌ PostgreSQL connection failed:', err.message);
  });

// ─── ADMIN AUTH & FUNCTIONS ──────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aditya@2025';
const activeSessions = new Set();

function generateToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

function requireAdmin(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  const token = req.headers['x-admin-token'];
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── DATABASE INITIALIZATION ─────────────────────────────
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profile (id SERIAL PRIMARY KEY, name VARCHAR(100), title VARCHAR(150), branch VARCHAR(150), university VARCHAR(200), bio TEXT, email VARCHAR(100), phone VARCHAR(30), github VARCHAR(200), linkedin VARCHAR(200), location VARCHAR(150), skills TEXT, updated_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS projects (id SERIAL PRIMARY KEY, title VARCHAR(200) NOT NULL, description TEXT, tech TEXT, github VARCHAR(200), live VARCHAR(200), image VARCHAR(300), featured BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS certificates (id SERIAL PRIMARY KEY, title VARCHAR(200) NOT NULL, issuer VARCHAR(200), date VARCHAR(20), credential_id VARCHAR(100), image VARCHAR(300), created_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS resume (id SERIAL PRIMARY KEY, file_path VARCHAR(300), uploaded_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), message TEXT, created_at TIMESTAMP DEFAULT NOW());
    `);
    console.log('✅ All tables verified and ready!');
  } catch (err) { console.error('❌ DB init error:', err.message); }
}

// ─── FILE UPLOAD CONFIG ──────────────────────────────────
['uploads/resume', 'uploads/projects', 'uploads/certificates'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads';
    if (req.originalUrl.includes('/resume')) folder = 'uploads/resume';
    else if (req.originalUrl.includes('/projects')) folder = 'uploads/projects';
    else if (req.originalUrl.includes('/certificates')) folder = 'uploads/certificates';
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── ROUTES (Briefly) ────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
  const token = generateToken();
  activeSessions.add(token);
  res.json({ success: true, token });
});

app.post('/api/resume/upload', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' }); // Fixed variable name
  const filePath = `/uploads/resume/${req.file.filename}`;
  try {
    await pool.query('DELETE FROM resume');
    await pool.query('INSERT INTO resume (file_path) VALUES ($1)', [filePath]);
    res.json({ success: true, path: filePath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ... (Baaki routes pehle jaise hi rakhein)

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});