const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const app = express();
const DATA_FILE = path.join(__dirname, 'data', 'artists.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname))); // serve site files

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = file.fieldname === 'music' ? 'music' : 'images';
    cb(null, path.join(__dirname, dest))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
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
      return res.status(400).json({ ok: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }
    res.json({ 
      ok: true, 
      path: 'images/' + req.file.filename
    });
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
// Read admin credentials from environment variables in production
// (falls back to defaults for local development)
const ADMIN_USER = process.env.ADMIN_USER || 'blunt';
const ADMIN_PASS = process.env.ADMIN_PASS || '198801';
const TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}
function writeData(arr) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = uuidv4();
    SESSIONS[token] = Date.now() + TOKEN_TTL_MS;
    return res.json({ ok: true, token });
  }
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

app.get('/api/artists', (req, res) => {
  res.json(readData());
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
