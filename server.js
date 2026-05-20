require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'] }));
app.use(express.json());

// ─── CLOUDINARY CONFIG ────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dfdybxtua',
  api_key: process.env.CLOUDINARY_API_KEY || '528842456513411',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'lhdIJezb5nB-GEC06vnsgiMsr9w'
});

// ─── MULTER CLOUDINARY STORAGE ────────────────────────────
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'portfolio',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 800, crop: 'limit' }]
  })
});

const resumeStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'portfolio/resume',
    allowed_formats: ['pdf'],
    resource_type: 'raw'
  }
});

const upload = multer({ storage: imageStorage });
const uploadResumeMulter = multer({ storage: resumeStorage });

// ─── DB ───────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ─── AUTH ─────────────────────────────────────────────────
global.activeSessions = global.activeSessions || new Set();

async function requireAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  if (global.activeSessions.has(token)) return next();
  // DB se check karo
  try {
    const result = await pool.query('SELECT token FROM sessions WHERE token=$1', [token]);
    if (result.rows.length > 0) {
      global.activeSessions.add(token);
      return next();
    }
  } catch(e) {}
  return res.status(401).json({ error: 'Unauthorized' });
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

// Profile photo upload
app.post('/api/profile/photo', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const imageUrl = req.file.path;
    const check = await pool.query('SELECT id FROM profile LIMIT 1');
    if (check.rows.length === 0) {
      await pool.query('INSERT INTO profile (photo) VALUES ($1)', [imageUrl]);
    } else {
      await pool.query('UPDATE profile SET photo=$1 WHERE id=$2', [imageUrl, check.rows[0].id]);
    }
    res.json({ success: true, url: imageUrl });
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
    const imageUrl = req.file ? req.file.path : null;
    const result = await pool.query(
      `INSERT INTO projects (title,description,tech,github,live,featured,image)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [data.title, data.description, data.tech || [], data.github, data.live, data.featured || false, imageUrl]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/projects/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const data = JSON.parse(req.body.data || '{}');
    const newImage = req.file ? req.file.path : (data.existingImage || null);
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
    const imageUrl = req.file ? req.file.path : null;
    const result = await pool.query(
      `INSERT INTO certificates (title,issuer,date,credential_id,image)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [data.title, data.issuer, data.date, data.credentialId, imageUrl]
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

app.post('/api/resume/upload', requireAuth, uploadResumeMulter.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = req.file.path;
    const check = await pool.query('SELECT id FROM resume LIMIT 1');
    if (check.rows.length === 0) {
      await pool.query('INSERT INTO resume (file_path) VALUES ($1)', [fileUrl]);
    } else {
      await pool.query('UPDATE resume SET file_path=$1 WHERE id=$2', [fileUrl, check.rows[0].id]);
    }
    res.json({ success: true, path: fileUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/resume/download', async (req, res) => {
  try {
    const result = await pool.query('SELECT file_path FROM resume LIMIT 1');
    if (!result.rows[0]?.file_path) return res.status(404).json({ error: 'No resume uploaded' });
    // fl_attachment:filename — proper PDF naam se download hoga
    let url = result.rows[0].file_path;
    url = url.replace('/upload/', '/upload/fl_attachment:Aditya_Singh_Resume.pdf/');
    res.redirect(url);
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
    const skillsRaw = prof.rows[0]?.skills;
    const skillsCount = typeof skillsRaw === 'string'
      ? skillsRaw.replace(/[{}"]/g, '').split(',').filter(Boolean).length
      : (Array.isArray(skillsRaw) ? skillsRaw.length : 0);
    res.json({
      projects: parseInt(proj.rows[0].count),
      certificates: parseInt(cert.rows[0].count),
      skills: skillsCount
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ADMIN LOGIN / LOGOUT ─────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (password !== (process.env.ADMIN_PASSWORD || 'aditya@2025')) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  global.activeSessions.add(token);
  // DB mein bhi save karo
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '7 days'`);
    await pool.query(`INSERT INTO sessions (token) VALUES ($1)`, [token]);
  } catch(e) {}
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
