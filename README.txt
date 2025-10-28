
SA Underground - Site + Simple Admin Backend
-------------------------------------------

How to run locally:

1. Make sure Node.js is installed (v14+).

2. In this folder, run:
   npm install
   npm start

3. Open http://localhost:3000 in your browser to see the site.
   Admin panel: http://localhost:3000/admin.html

Admin credentials (hard-coded as requested):
  username: blunt
  password: 198801

Notes:
- The backend serves the static site and exposes API endpoints under /api/*
  to read/write data/artists.json. The JSON file is updated in-place.
- This is intended for local use or simple deployments. For production,
  add HTTPS, proper auth, and storage persistence.
