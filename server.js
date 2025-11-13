const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { execSync } = require('child_process');

const app = express();
const DATA_FILE = path.join(__dirname, 'data', 'artists.json');
const PENDING_FILE = path.join(__dirname, 'data', 'pending_artists.json');

// Git auto-commit helper (lightweight)
function gitCommit(message) {
  try {
    execSync('git add -A', { cwd: __dirname, stdio: 'pipe' });
    const safeMsg = message.replace(/"/g, '\\"').slice(0, 100); // Escape and limit length
    execSync(`git commit -m "${safeMsg}"`, { cwd: __dirname, stdio: 'pipe' });
    console.log('Git commit:', message);
  } catch (err) {
    // git may fail if no changes or not a repo; silently continue
    console.debug('Git commit info:', err.message.slice(0, 50));
  }
}

// Pending artists file helpers
function readPending() {
  try {
    if (!fs.existsSync(PENDING_FILE)) {
      writePending([]);
    }
    const raw = fs.readFileSync(PENDING_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Error reading pending:', e);
    return [];
  }
}
function writePending(arr) {
  console.log('writePending called with', arr.length, 'items');
  fs.writeFileSync(PENDING_FILE, JSON.stringify(arr, null, 2), 'utf8');
  console.log('Pending file written');
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname))); // serve site files

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = file.fieldname === 'music' ? 'music' : 'images';
    const destPath = path.join(__dirname, dest);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    
    cb(null, destPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
})

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'music') {
      if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
        cb(null, true)
      } else {
        cb(new Error('Not an MP3 file'), false)
      }
    } else if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'), false)
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for music files
  }
})

// File upload endpoint
app.post('/api/upload', (req, res) => {
  if (!checkAuth(req, res)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  
  upload.single('image')(req, res, function (err) {
    if (err) {
      console.error('Upload error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ ok: false, error: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ ok: false, error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    try {
      // Verify the file was actually written
      const filePath = path.join(__dirname, 'images', req.file.filename);
      if (!fs.existsSync(filePath)) {
        throw new Error('File failed to save');
      }

      res.json({ 
        ok: true, 
        path: 'images/' + req.file.filename
      });
    } catch (error) {
      console.error('File verification error:', error);
      return res.status(500).json({ ok: false, error: 'Failed to save file' });
    }
  });
});

// Music endpoints
const SONGS_FILE = path.join(__dirname, 'data', 'songs.json');

function readSongs() {
  try {
    if (!fs.existsSync(SONGS_FILE)) {
      writeSongs({ songs: [] });
    }
    const raw = fs.readFileSync(SONGS_FILE, 'utf8');
    const data = JSON.parse(raw || '{"songs":[]}');
    return data;
  } catch (e) {
    console.error('Error reading songs:', e);
    return { songs: [] };
  }
}

function writeSongs(data) {
  try {
    const dir = path.dirname(SONGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SONGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    gitCommit('Update songs data');
  } catch (e) {
    console.error('Error writing songs:', e);
    throw e;
  }
}

app.post('/api/upload-music', (req, res) => {
  try {
    if (!checkAuth(req, res)) return res.status(401).json({ ok: false, error: 'unauthorized' });
    
    // Make sure music directory exists
    const musicDir = path.join(__dirname, 'music');
    if (!fs.existsSync(musicDir)) {
      fs.mkdirSync(musicDir, { recursive: true });
    }

    upload.single('music')(req, res, function (err) {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ ok: false, error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'No file uploaded' });
      }

      try {
        const songData = {
          id: uuidv4(),
          title: req.body.title || req.file.originalname.replace('.mp3', ''),
          artist: req.body.artist || 'Unknown Artist',
          path: 'music/' + req.file.filename
        };

        const songs = readSongs();
        songs.songs.push(songData);
        writeSongs(songs);

        console.log('Song added successfully:', songData);
        res.json({ 
          ok: true, 
          song: songData
        });
      } catch (error) {
        console.error('Error saving song data:', error);
        res.status(500).json({ ok: false, error: 'Failed to save song data' });
      }
    });
  } catch (error) {
    console.error('Upload handler error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.get('/api/songs', (req, res) => {
  try {
    console.log('Reading songs from:', SONGS_FILE);
    const songs = readSongs();
    console.log('Songs found:', songs.songs.length);
    
    // Verify all songs exist
    songs.songs = songs.songs.filter(song => {
      const filePath = path.join(__dirname, song.path);
      return fs.existsSync(filePath);
    });
    
    res.setHeader('Content-Type', 'application/json');
    res.json(songs.songs);
  } catch (error) {
    console.error('Error reading songs:', error);
    res.status(500).json({ error: 'Failed to read songs' });
  }
});

app.delete('/api/songs/:id', (req, res) => {
  if (!checkAuth(req, res)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  
  const songs = readSongs();
  const songIndex = songs.songs.findIndex(s => s.id === req.params.id);
  
  if (songIndex === -1) {
    return res.status(404).json({ ok: false, error: 'Song not found' });
  }

  const song = songs.songs[songIndex];
  const filePath = path.join(__dirname, song.path);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.error('Failed to delete file:', e);
  }

  songs.songs.splice(songIndex, 1);
  writeSongs(songs);
  
  res.json({ ok: true });
});

// Simple in-memory sessions (token -> expiry)
const SESSIONS = {};
// Artist sessions for public users (artistToken -> {id, expiry})
const ARTIST_SESSIONS = {};
// Read admin credentials from environment variables in production
// (falls back to defaults for local development)
const ADMIN_USER = process.env.ADMIN_USER || 'blunt';
const ADMIN_PASS = process.env.ADMIN_PASS || '198801';
const TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    console.log('readData: Loaded', Array.isArray(parsed) ? parsed.length : 'invalid', 'artists from', DATA_FILE);
    return parsed;
  } catch (e) {
    console.error('readData error:', e.message);
    return [];
  }
}
function writeData(arr) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf8');
  gitCommit('Update artists data');
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  console.log('Login attempt:', { username, password, expected: { user: ADMIN_USER, pass: ADMIN_PASS } });
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = uuidv4();
    SESSIONS[token] = Date.now() + TOKEN_TTL_MS;
    console.log('Login successful, token:', token);
    return res.json({ ok: true, token });
  }
  console.log('Login failed - credentials do not match');
  return res.status(401).json({ ok: false, error: 'Invalid credentials' });
});

function checkAuth(req, res) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (!token || !SESSIONS[token]) return false;
  if (Date.now() > SESSIONS[token]) { delete SESSIONS[token]; return false; }
  // refresh expiry
  SESSIONS[token] = Date.now() + TOKEN_TTL_MS;
  return true;
}

function checkArtistAuth(req, res) {
  const token = req.headers['x-artist-token'] || req.query.artist_token;
  if (!token || !ARTIST_SESSIONS[token]) return false;
  const entry = ARTIST_SESSIONS[token];
  if (Date.now() > entry.expiry) { delete ARTIST_SESSIONS[token]; return false; }
  // refresh expiry
  entry.expiry = Date.now() + TOKEN_TTL_MS;
  return true;
}

function getArtistIdFromToken(req) {
  const token = req.headers['x-artist-token'] || req.query.artist_token;
  if (!token) return null;
  const entry = ARTIST_SESSIONS[token];
  return entry ? entry.id : null;
}

app.get('/api/artists', (req, res) => {
  const data = readData();
  console.log('GET /api/artists: returning', Array.isArray(data) ? data.length : 'invalid', 'artists');
  res.json(data);
});

app.post('/api/artists', (req, res) => {
  if (!checkAuth(req, res)) return res.status(401).json({ ok:false, error:'unauthorized' });
  const data = readData();
  const newArtist = req.body;
  if (!newArtist.id) newArtist.id = (newArtist.name || 'artist').toLowerCase().replace(/\\s+/g,'_').replace(/[^\\w\\-]/g,'');
  // ensure unique id
  if (data.find(a=>a.id === newArtist.id)) {
    newArtist.id = newArtist.id + '_' + Math.floor(Math.random()*1000);
  }
  data.push(newArtist);
  writeData(data);
  res.json({ ok:true, artist:newArtist });
});

app.put('/api/artists/:id', (req, res) => {
  if (!checkAuth(req, res)) return res.status(401).json({ ok:false, error:'unauthorized' });
  const id = req.params.id;
  const body = req.body;
  const data = readData();
  const idx = data.findIndex(a=>a.id === id);
  if (idx === -1) return res.status(404).json({ ok:false, error:'not found' });
  data[idx] = Object.assign({}, data[idx], body);
  writeData(data);
  res.json({ ok:true, artist:data[idx] });
});

app.delete('/api/artists/:id', (req, res) => {
  if (!checkAuth(req, res)) return res.status(401).json({ ok:false, error:'unauthorized' });
  const id = req.params.id;
  let data = readData();
  const idx = data.findIndex(a=>a.id === id);
  if (idx === -1) return res.status(404).json({ ok:false, error:'not found' });
  const removed = data.splice(idx,1);
  writeData(data);
  res.json({ ok:true, removed: removed[0] });
});

// Public artist submission endpoint
app.post('/api/artists-public', (req, res) => {
  try {
    const data = readData();
    const pending = readPending(); // <-- Read pending artists first!
    const newArtist = req.body;
    
    if (!newArtist.name) {
      return res.status(400).json({ ok: false, error: 'Artist name is required' });
    }
    
    if (!newArtist.email) {
      return res.status(400).json({ ok: false, error: 'Email is required' });
    }
    
    // Generate ID if not provided
    if (!newArtist.id) {
      newArtist.id = (newArtist.name || 'artist').toLowerCase().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    }
    
    // Ensure unique ID across both live and pending artists
    const allIds = new Set([...data.map(a => a.id), ...pending.map(a => a.id)]);
    let baseId = newArtist.id;
    let counter = 1;
    while (allIds.has(newArtist.id)) {
      newArtist.id = baseId + '_' + counter++;
    }
    
    // Set default values
    newArtist.image = newArtist.image || 'images/default.jpg';
    newArtist.followers = newArtist.followers || 'New Artist';
    newArtist.monthly_listeners = newArtist.monthly_listeners || '0';
    newArtist.likes = 0;
    newArtist.status = 'pending'; // Mark as pending for admin review
    newArtist.submitted_at = new Date().toISOString();
    
    console.log('About to push artist to pending:', newArtist.name);
    pending.push(newArtist);
    console.log('Artist pushed, pending now has', pending.length, 'items');
    writePending(pending);
    gitCommit(`Add pending artist submission: ${newArtist.name}`);
    
    console.log('New artist submitted (pending):', newArtist.name, 'from', newArtist.email);
    res.json({ ok: true, artist: newArtist, message: 'Profile submitted for review. An admin will approve it shortly!' });
  } catch (err) {
    console.error('Error adding artist:', err);
    res.status(500).json({ ok: false, error: 'Server error: ' + err.message });
  }
});

// Artist login (public) - returns artist_token when id+email match
app.post('/api/artist-login', (req, res) => {
  try {
    const { id, email } = req.body || {};
    if (!id || !email) return res.status(400).json({ ok: false, error: 'id and email required' });
    const data = readData();
    const artist = data.find(a => (a.id || '').toLowerCase() === (id || '').toLowerCase() && (a.email || '').toLowerCase() === (email || '').toLowerCase());
    if (!artist) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const token = uuidv4();
    ARTIST_SESSIONS[token] = { id: artist.id, expiry: Date.now() + TOKEN_TTL_MS };
    return res.json({ ok: true, token, artist: artist });
  } catch (err) {
    console.error('Artist login error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Get current artist profile (auth)
app.get('/api/artist/me', (req, res) => {
  try {
    if (!checkArtistAuth(req, res)) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const artistId = getArtistIdFromToken(req);
    const data = readData();
    const artist = data.find(a => a.id === artistId);
    if (!artist) return res.status(404).json({ ok: false, error: 'not found' });
    return res.json({ ok: true, artist });
  } catch (err) {
    console.error('Get artist me error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Update current artist profile (auth)
app.put('/api/artist/me', (req, res) => {
  try {
    if (!checkArtistAuth(req, res)) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const artistId = getArtistIdFromToken(req);
    const data = readData();
    const idx = data.findIndex(a => a.id === artistId);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'not found' });
    const updated = Object.assign({}, data[idx], req.body);
    data[idx] = updated;
    writeData(data);
    return res.json({ ok: true, artist: updated });
  } catch (err) {
    console.error('Update artist me error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Authenticated artist upload music (must send x-artist-token)
app.post('/api/artist-upload-music', (req, res) => {
  try {
    if (!checkArtistAuth(req, res)) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const artistId = getArtistIdFromToken(req);

    upload.single('music')(req, res, function (err) {
      if (err) {
        console.error('Artist upload error:', err);
        return res.status(400).json({ ok: false, error: err.message });
      }
      if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });

      const songData = {
        id: uuidv4(),
        title: req.body.title || req.file.originalname.replace('.mp3',''),
        artist: artistId,
        path: 'music/' + req.file.filename
      };

      const songs = readSongs();
      songs.songs.push(songData);
      writeSongs(songs);

      console.log('Artist uploaded song:', songData);
      return res.json({ ok: true, song: songData });
    });
  } catch (err) {
    console.error('Artist upload handler error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Public music upload for new users (no auth)
app.post('/api/public-upload-music', upload.single('music'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });

    const songData = {
      id: uuidv4(),
      title: req.body.title || req.file.originalname.replace('.mp3',''),
      artist: req.body.artistId || req.body.artistName || 'Unknown Artist',
      path: 'music/' + req.file.filename
    };

    const songs = readSongs();
    songs.songs.push(songData);
    writeSongs(songs);

    console.log('Public song uploaded:', songData);
    return res.json({ ok: true, song: songData });
  } catch (err) {
    console.error('Public upload error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Public image upload for new users (no auth)
app.post('/api/public-upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    // ensure file is image (multer fileFilter already checks)
    const imgPath = 'images/' + req.file.filename;
    console.log('Public image uploaded:', imgPath);
    return res.json({ ok: true, path: imgPath });
  } catch (err) {
    console.error('Public image upload error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Like an artist (increments like counter)
// Like an artist (increments like counter) with lightweight IP-protection
const ARTIST_LIKES_IPS = {}; // artistId -> { ip -> timestamp }
const LIKE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours per IP like window

app.post('/api/artists/:id/like', (req, res) => {
  try {
    const id = req.params.id;
    const data = readData();
    const idx = data.findIndex(a => a.id === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Artist not found' });

    // basic IP dedupe (lightweight, in-memory)
    const ip = (req.ip || req.connection.remoteAddress || 'unknown').toString();
    ARTIST_LIKES_IPS[id] = ARTIST_LIKES_IPS[id] || {};
    // cleanup old entries
    Object.keys(ARTIST_LIKES_IPS[id]).forEach(k => {
      if (Date.now() - ARTIST_LIKES_IPS[id][k] > LIKE_TTL_MS) delete ARTIST_LIKES_IPS[id][k];
    });

    if (ARTIST_LIKES_IPS[id][ip]) {
      return res.status(429).json({ ok: false, error: 'You have already liked this artist recently' });
    }

    ARTIST_LIKES_IPS[id][ip] = Date.now();

    const artist = data[idx];
    artist.likes = (artist.likes || 0) + 1;
    data[idx] = artist;
    writeData(data);

    console.log(`Artist liked: ${artist.name} (${artist.id}) -> ${artist.likes} (by ${ip})`);
    return res.json({ ok: true, likes: artist.likes });
  } catch (err) {
    console.error('Like error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin: Get all pending artist submissions
app.get('/api/pending-artists', (req, res) => {
  try {
    if (!checkAuth(req, res)) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const pending = readPending();
    return res.json({ ok: true, pending });
  } catch (err) {
    console.error('Get pending error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin: Approve a pending artist submission
app.post('/api/pending-artists/:id/approve', (req, res) => {
  try {
    if (!checkAuth(req, res)) return res.status(401).json({ ok: false, error: 'unauthorized' });
    
    const id = req.params.id;
    const pending = readPending();
    const idx = pending.findIndex(a => a.id === id);
    
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Pending artist not found' });
    
    const artist = pending[idx];
    delete artist.status;
    delete artist.submitted_at;
    
    // Add to live artists
    const data = readData();
    data.push(artist);
    writeData(data);
    
    // Remove from pending
    pending.splice(idx, 1);
    writePending(pending);
    
    gitCommit(`Approve artist: ${artist.name}`);
    
    console.log('Artist approved:', artist.name);
    return res.json({ ok: true, artist, message: 'Artist approved and published!' });
  } catch (err) {
    console.error('Approve error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Admin: Reject a pending artist submission
app.post('/api/pending-artists/:id/reject', (req, res) => {
  try {
    if (!checkAuth(req, res)) return res.status(401).json({ ok: false, error: 'unauthorized' });
    
    const id = req.params.id;
    const pending = readPending();
    const idx = pending.findIndex(a => a.id === id);
    
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Pending artist not found' });
    
    const artist = pending[idx];
    pending.splice(idx, 1);
    writePending(pending);
    
    gitCommit(`Reject artist: ${artist.name}`);
    
    console.log('Artist rejected:', artist.name);
    return res.json({ ok: true, message: 'Artist submission rejected' });
  } catch (err) {
    console.error('Reject error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// fallback to index.html for SPA routing
app.get('*', (req, res) => {
  const file = path.join(__dirname, 'index.html');
  if (fs.existsSync(file)) return res.sendFile(file);
  res.status(404).send('Not found');
});

const port = process.env.PORT || 3000;

// Function to find an available port
const findAvailablePort = async (startPort) => {
  let currentPort = startPort;
  while (currentPort < startPort + 10) {
    try {
      await new Promise((resolve, reject) => {
        const server = app.listen(currentPort)
          .once('error', () => {
            server.removeAllListeners();
            resolve(false);
          })
          .once('listening', () => {
            server.removeAllListeners();
            server.close(() => resolve(true));
          });
      });
      return currentPort;
    } catch (err) {
      currentPort++;
    }
  }
  throw new Error('No available ports found');
};

// Start the server
findAvailablePort(port)
  .then(availablePort => {
    app.listen(availablePort, () => {
      console.log(`Server running on port ${availablePort}`);
      console.log(`Open http://localhost:${availablePort} in your browser`);
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
