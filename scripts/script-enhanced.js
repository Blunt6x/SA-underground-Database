// Enhanced SA Underground Script with Sorting, Better UI, and User Signup

const artistsEl = document.getElementById('artists');
const searchEl = document.getElementById('search');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');
const adminBtn = document.getElementById('adminBtn');
const signupBtn = document.getElementById('signupBtn');
const signupModal = document.getElementById('signupModal');
const signupForm = document.getElementById('signupForm');

let artists = [];
let currentSort = 'featured';

// ========== SORTING FUNCTIONALITY ==========
const sortButtons = document.querySelectorAll('.sort-btn');
sortButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    sortButtons.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentSort = e.target.dataset.sort;
    renderList(filterAndSort(artists));
  });
});

function filterAndSort(list) {
  if (!list || !list.length) return list;

  const filtered = list.filter(a => {
    const query = searchEl.value.trim().toLowerCase();
    if (!query) return true;
    return (a.name || '').toLowerCase().includes(query) ||
           (a.id || '').toLowerCase().includes(query);
  });

  const sorted = [...filtered];
  
  switch (currentSort) {
    case 'name':
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'followers':
      sorted.sort((a, b) => {
        const aFollowers = parseInt((a.followers || '0').match(/\d+/)?.[0] || 0);
        const bFollowers = parseInt((b.followers || '0').match(/\d+/)?.[0] || 0);
        return bFollowers - aFollowers;
      });
      break;
    case 'recently-added':
      sorted.reverse();
      break;
    case 'featured':
    default:
      // Featured order (manual order)
      break;
  }
  
  return sorted;
}

// ========== LOAD ARTISTS ==========
fetch('data/artists.json')
  .then(r => r.json())
  .then(data => {
    artists = data;
    renderList(artists);
  })
  .catch(err => {
    console.error('Failed to load artists.json', err);
    artistsEl.innerHTML = '<li style="color:var(--muted); grid-column: 1/-1; text-align: center; padding: 40px;">No artist data yet. Add artists.json in /data/</li>';
  });

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function renderList(list) {
  if(!list || !list.length){
    artistsEl.innerHTML = '<li style="color:var(--muted); grid-column: 1/-1; text-align: center; padding: 40px;">No artists found.</li>';
    return;
  }
  artistsEl.innerHTML = '';
  list.forEach((a, index) => {
    const li = document.createElement('li');
    li.className = 'artist-card';
    li.style.animationDelay = `${index * 0.05}s`;
    li.tabIndex = 0;
    li.innerHTML = `
      <img class="artist-thumb" src="${a.image || 'images/default.jpg'}" alt="${escapeHtml(a.name)}">
      <div class="artist-info">
        <div class="artist-name">${escapeHtml(a.name)}</div>
        <div class="artist-meta">${escapeHtml(a.followers || '—')}</div>
      </div>
    `;
    li.addEventListener('click', (e)=> openDetail(a, e));
    li.addEventListener('keypress', (e)=>{ if(e.key==='Enter') openDetail(a, e); });
    artistsEl.appendChild(li);
  });
}

searchEl.addEventListener('input', (e) => {
  renderList(filterAndSort(artists));
});

// ========== ENHANCED ARTIST DETAIL MODAL ==========
function openDetail(a, clickEvent){
  document.body.style.overflow = 'hidden';

  modalBody.innerHTML = `
    <div class="artist-detail-enhanced">
      <!-- Left: Image & Stats -->
      <div class="artist-image-section">
        <img src="${a.image || 'images/default.jpg'}" alt="${escapeHtml(a.name)}" class="artist-main-image">
        <div class="artist-stats">
          <div class="stat-box">
            <div class="stat-label">Followers</div>
            <div class="stat-value">${escapeHtml((a.followers || '—').split(' ')[0])}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Status</div>
            <div class="stat-value">Active</div>
          </div>
        </div>
      </div>

      <!-- Right: Info -->
      <div class="artist-info-section">
        <h2>${escapeHtml(a.name)}</h2>
        ${a.bio ? `<div class="artist-bio">${escapeHtml(a.bio)}</div>` : ''}
        
        <div class="social-links">
          ${a.spotify ? `<a href="${a.spotify}" target="_blank" rel="noopener">🎵 Spotify</a>` : ''}
          ${a.instagram ? `<a href="${a.instagram}" target="_blank" rel="noopener">📸 Instagram</a>` : ''}
          ${a.soundcloud ? `<a href="${a.soundcloud}" target="_blank" rel="noopener">🎧 SoundCloud</a>` : ''}
        </div>

        <div class="tracks-section">
          <h3>Featured Tracks</h3>
          <div id="artistTracks" style="max-height: 400px; overflow-y: auto;">
            <div style="text-align: center; color: var(--muted); padding: 20px;">Loading tracks...</div>
          </div>
        </div>

        <div style="margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
          <button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>
          ${a.spotify ? `<a href="${a.spotify}" target="_blank" class="btn" style="text-decoration: none;">Listen on Spotify</a>` : ''}
        </div>
      </div>
    </div>
  `;
  
  modal.classList.remove('hidden');
  loadArtistTracks(a.name);
  
  const focusableElements = modalBody.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusableElements.length) {
    setTimeout(() => focusableElements[0].focus(), 100);
  }
  
  modalBody.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadArtistTracks(artistName) {
  fetch('/api/songs')
    .then(r => r.json())
    .then(songs => {
      const artistTracks = songs.filter(s => 
        (s.artist || '').toLowerCase().includes(artistName.toLowerCase())
      );
      
      const tracksContainer = document.getElementById('artistTracks');
      if (!tracksContainer) return;
      
      if (artistTracks.length === 0) {
        tracksContainer.innerHTML = '<div style="text-align: center; color: var(--muted); padding: 20px;">No tracks available</div>';
        return;
      }
      
      tracksContainer.innerHTML = '';
      artistTracks.forEach(track => {
        const div = document.createElement('div');
        div.className = 'track-item';
        div.innerHTML = `
          <div>
            <div class="track-name">${escapeHtml(track.title)}</div>
            <div class="track-artist">${escapeHtml(track.artist)}</div>
          </div>
          <button class="play-track-btn" onclick="playTrack('${track.path}', '${track.title}', '${track.artist}')">Play</button>
        `;
        tracksContainer.appendChild(div);
      });
    })
    .catch(err => {
      const tracksContainer = document.getElementById('artistTracks');
      if (tracksContainer) tracksContainer.innerHTML = '<div style="color: var(--accent2);">Error loading tracks</div>';
    });
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e)=> { if(e.target === modal) closeModal(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
    closeModal();
  }
});

document.getElementById('year').textContent = new Date().getFullYear();

adminBtn.addEventListener('click', ()=> {
  window.location.href = 'admin.html';
});

// ========== ENHANCED MUSIC PLAYER ==========
let currentSongIndex = 0;
let songs = [];
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const songTitleEl = document.getElementById('songTitle');
const songArtistEl = document.getElementById('songArtist');
const progressBar = document.getElementById('progressBar');
const timeDisplay = document.getElementById('timeDisplay');

function loadSongs() {
  fetch('/api/songs')
    .then(r => r.json())
    .then(data => {
      songs = data;
      if (songs.length > 0) {
        loadSong(0);
      }
    })
    .catch(console.error);
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function loadSong(index) {
  if (!songs.length) return;
  currentSongIndex = index;
  const song = songs[index];
  audioPlayer.src = song.path;
  songTitleEl.textContent = song.title;
  songArtistEl.textContent = song.artist;
  
  audioPlayer.onerror = function() {
    console.error('Error loading audio:', audioPlayer.error);
    alert('Error playing the song. Please try another.');
    nextBtn.click();
  };

  audioPlayer.play().then(() => {
    playBtn.textContent = '⏸️';
  }).catch(error => {
    console.log('Autoplay prevented:', error);
    playBtn.textContent = '▶️';
  });
}

function playTrack(path, title, artist) {
  audioPlayer.src = path;
  songTitleEl.textContent = title;
  songArtistEl.textContent = artist;
  audioPlayer.play().then(() => {
    playBtn.textContent = '⏸️';
  }).catch(console.error);
}

// Update progress bar
audioPlayer.addEventListener('timeupdate', () => {
  if (audioPlayer.duration) {
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.style.setProperty('--progress', percent + '%');
    const style = progressBar.querySelector(':not(:first-child)') || progressBar;
    if (style.style) {
      style.style.width = percent + '%';
    }
    // Find and update the after pseudo-element width
    const afterStyle = document.createElement('style');
    if (!document.getElementById('progressStyle')) {
      afterStyle.id = 'progressStyle';
      afterStyle.textContent = `.progress-bar::after { width: ${percent}% !important; }`;
      document.head.appendChild(afterStyle);
    } else {
      document.getElementById('progressStyle').textContent = `.progress-bar::after { width: ${percent}% !important; }`;
    }
    
    timeDisplay.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
  }
});

// Click on progress bar to seek
progressBar.addEventListener('click', (e) => {
  const rect = progressBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  audioPlayer.currentTime = percent * audioPlayer.duration;
});

// Volume control
const volumeSlider = document.getElementById('volumeSlider');
volumeSlider.addEventListener('input', (e) => {
  audioPlayer.volume = e.target.value / 100;
});

playBtn.addEventListener('click', () => {
  if (audioPlayer.paused) {
    audioPlayer.play();
    playBtn.textContent = '⏸️';
  } else {
    audioPlayer.pause();
    playBtn.textContent = '▶️';
  }
});

prevBtn.addEventListener('click', () => {
  if (songs.length === 0) return;
  let newIndex = currentSongIndex - 1;
  if (newIndex < 0) newIndex = songs.length - 1;
  loadSong(newIndex);
  if (!audioPlayer.paused) audioPlayer.play();
});

nextBtn.addEventListener('click', () => {
  if (songs.length === 0) return;
  let newIndex = currentSongIndex + 1;
  if (newIndex >= songs.length) newIndex = 0;
  loadSong(newIndex);
  if (!audioPlayer.paused) audioPlayer.play();
});

audioPlayer.addEventListener('ended', () => {
  let newIndex = currentSongIndex + 1;
  if (newIndex >= songs.length) newIndex = 0;
  loadSong(newIndex);
  audioPlayer.play();
});

loadSongs();

// ========== SIGNUP FUNCTIONALITY ==========
signupBtn.addEventListener('click', () => {
  signupModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
});

function closeSignupModal() {
  signupModal.classList.add('hidden');
  document.body.style.overflow = '';
  signupForm.reset();
}

document.querySelector('#signupModal .close').addEventListener('click', closeSignupModal);
signupModal.addEventListener('click', (e) => {
  if (e.target === signupModal) closeSignupModal();
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const newArtist = {
    name: document.getElementById('signupName').value.trim(),
    email: document.getElementById('signupEmail').value.trim(),
    id: document.getElementById('signupId').value.trim() || 
        document.getElementById('signupName').value.trim().toLowerCase().replace(/\s+/g, '_'),
    bio: document.getElementById('signupBio').value.trim(),
    spotify: document.getElementById('signupSpotify').value.trim(),
    instagram: document.getElementById('signupInstagram').value.trim(),
    soundcloud: document.getElementById('signupSoundcloud').value.trim(),
    image: 'images/default.jpg',
    followers: 'New Artist'
  };

  try {
    const res = await fetch('/api/artists-public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newArtist)
    });

    const data = await res.json();

    if (res.ok) {
      alert('🎉 Welcome to SA Underground! Your profile has been added. Check it out!');
      closeSignupModal();
      // Reload artists
      fetch('data/artists.json')
        .then(r => r.json())
        .then(data => {
          artists = data;
          renderList(artists);
        });
    } else {
      alert('Error: ' + (data.error || 'Could not add profile'));
    }
  } catch (err) {
    alert('Error submitting profile: ' + err.message);
  }
});

// Close signup modal with Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !signupModal.classList.contains('hidden')) {
    closeSignupModal();
  }
});
