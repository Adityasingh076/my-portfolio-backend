require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'] }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── DB (tumhara existing connection — unchanged) ─────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ─── UPLOADS FOLDER ───────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ─── AUTH MIDDLEWARE ──────────────────────────────────────
global.activeSessions = global.activeSessions || new Set();

function requireAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !global.activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── PROFILE ──────────────────────────────────────────────
app.get('/api/profile', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profile LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const { name, title, branch, university, bio, email, phone, github, linkedin, location, skills } = req.body;
    const check = await pool.query('SELECT id FROM profile LIMIT 1');
    if (check.rows.length === 0) {
      await pool.query(
        `INSERT INTO profile (name,title,branch,university,bio,email,phone,github,linkedin,location,skills)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [name, title, branch, university, bio, email, phone, github, linkedin, location, skills]
      );
    } else {
      await pool.query(
        `UPDATE profile SET name=$1,title=$2,branch=$3,university=$4,bio=$5,
         email=$6,phone=$7,github=$8,linkedin=$9,location=$10,skills=$11 WHERE id=$12`,
        [name, title, branch, university, bio, email, phone, github, linkedin, location, skills, check.rows[0].id]
      );
    }
    const result = await pool.query('SELECT * FROM profile LIMIT 1');
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PROJECTS ─────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/projects', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data || '{}');
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO projects (title,description,tech,github,live,featured,image)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [data.title, data.description, data.tech || [], data.github, data.live, data.featured || false, imagePath]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/projects/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data || '{}');
    const newImage = req.file ? `/uploads/${req.file.filename}` : (data.existingImage || null);
    const result = await pool.query(
      `UPDATE projects SET title=$1,description=$2,tech=$3,github=$4,live=$5,featured=$6,image=$7
       WHERE id=$8 RETURNING *`,
      [data.title, data.description, data.tech || [], data.github, data.live, data.featured || false, newImage, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CERTIFICATES ─────────────────────────────────────────
app.get('/api/certificates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM certificates ORDER BY created_at DESC');
    res.json(result.rows.map(r => ({ ...r, credentialId: r.credential_id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/certificates', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data || '{}');
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO certificates (title,issuer,date,credential_id,image)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.title, data.issuer, data.date, data.credentialId, imagePath]
    );
    res.json({ ...result.rows[0], credentialId: result.rows[0].credential_id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/certificates/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM certificates WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── RESUME ───────────────────────────────────────────────
app.get('/api/resume', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resume LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/resume/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = `/uploads/${req.file.filename}`;
    const check = await pool.query('SELECT id FROM resume LIMIT 1');
    if (check.rows.length === 0) {
      await pool.query('INSERT INTO resume (resume) VALUES ($1)', [filePath]);
    } else {
      await pool.query('UPDATE resume SET resume=$1, updated_at=NOW() WHERE id=$2', [filePath, check.rows[0].id]);
    }
    res.json({ success: true, path: filePath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/resume/download', async (req, res) => {
  try {
    const result = await pool.query('SELECT resume FROM resume LIMIT 1');
    if (!result.rows[0]?.resume) return res.status(404).json({ error: 'No resume uploaded' });
    res.download(path.join(__dirname, result.rows[0].resume), 'Aditya_Singh_Resume.pdf');
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CONTACT ──────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    await pool.query('INSERT INTO contacts (name,email,message) VALUES ($1,$2,$3)', [name, email, message]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── STATS ────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const [proj, cert, prof] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM projects'),
      pool.query('SELECT COUNT(*) FROM certificates'),
      pool.query('SELECT skills FROM profile LIMIT 1')
    ]);
    res.json({
      projects: parseInt(proj.rows[0].count),
      certificates: parseInt(cert.rows[0].count),
      skills: prof.rows[0]?.skills?.length || 0
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN LOGIN / LOGOUT ─────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== (process.env.ADMIN_PASSWORD || 'aditya@2025')) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  global.activeSessions.add(token);
  res.json({ success: true, token });
});

app.post('/api/admin/logout', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token) global.activeSessions.delete(token);
  res.json({ success: true });
});

// ─── SERVER START ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
