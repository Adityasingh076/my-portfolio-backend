# Aditya Singh — Portfolio

A full-stack personal portfolio with an admin panel to manage projects, certificates, and resume.

---

## 📁 Project Structure

```
portfolio-backend/
  ├── server.js        ← Node.js + Express API
  └── package.json

portfolio-frontend/
  ├── index.html       ← Main HTML
  ├── style.css        ← Styles
  └── app.js           ← All JS logic
```

---

## 🚀 Setup & Run

### Backend
```bash
cd portfolio-backend
npm install
npm start
# Runs on http://localhost:5000
```

### Frontend
Just open `portfolio-frontend/index.html` in a browser.
Or serve it with:
```bash
cd portfolio-frontend
npx serve .
# Runs on http://localhost:3000
```

---

## ✨ Features

| Feature | Description |
|---|---|
| **Hero Section** | Animated name, bio, live stats counter |
| **About** | Bio, university info, tech stack cloud |
| **Projects** | Cards with image, tech badges, GitHub + Live links |
| **Certificates** | Grid with issuer, date, credential ID |
| **Contact Form** | Sends message to backend |
| **Resume Download** | Upload PDF and expose download button |
| **Admin Panel** | Full CRUD for profile, projects, certs, resume |
| **Demo Mode** | Works without backend (falls back to demo data) |

---

## 🔧 API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/profile` | Get profile data |
| PUT | `/api/profile` | Update profile |
| GET | `/api/projects` | Get all projects |
| POST | `/api/projects` | Add a project (with image) |
| DELETE | `/api/projects/:id` | Delete a project |
| GET | `/api/certificates` | Get all certs |
| POST | `/api/certificates` | Add a certificate |
| DELETE | `/api/certificates/:id` | Delete a certificate |
| POST | `/api/resume/upload` | Upload resume file |
| GET | `/api/resume` | Get resume path |
| POST | `/api/contact` | Submit contact message |
| GET | `/api/stats` | Get portfolio stats |

---

## 🛠️ To Upgrade for Production

- Replace in-memory `db` object with **MongoDB** or **SQLite**
- Add **JWT authentication** for the admin panel
- Deploy backend on **Railway / Render / Heroku**
- Deploy frontend on **Vercel / Netlify**
- Add **nodemailer** for real email notifications

---

Made with ❤ for Aditya Singh
