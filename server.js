require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'] }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ─── ROUTES ──────────────────────────────────────────────

// Profile Route
app.get('/api/profile', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profile LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Projects Route
app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Certificates Route
app.get('/api/certificates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM certificates ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Resume Route
app.get('/api/resume', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resume LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== (process.env.ADMIN_PASSWORD || 'aditya@2025')) return res.status(401).json({ error: 'Invalid password' });
  const token = require('crypto').randomBytes(32).toString('hex');
  global.activeSessions = global.activeSessions || new Set();
  global.activeSessions.add(token);
  res.json({ success: true, token });
});

// ─── SERVER START ────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});