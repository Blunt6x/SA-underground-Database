
const artistsEl = document.getElementById('artists');
const searchEl = document.getElementById('search');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');
const adminBtn = document.getElementById('adminBtn');

let artists = [];

fetch('data/artists.json')
  .then(r => r.json())
  .then(data => {
    artists = data;
    renderList(artists);
  })
  .catch(err => {
    console.error('Failed to load artists.json', err);
    artistsEl.innerHTML = '<li style="color:var(--muted)">No artist data yet. Add artists.json in /data/</li>';
  });

function renderList(list){
  if(!list || !list.length){
    artistsEl.innerHTML = '<li style="color:var(--muted)">No artists yet.</li>';
    return;
  }
  artistsEl.innerHTML = '';
  list.forEach((a, index) => {
    const li = document.createElement('li');
    li.className = 'artist-card';
    li.style.animationDelay = `${index * 0.05}s`;
    li.tabIndex = 0;
    li.innerHTML = `
      <img class="artist-thumb" src="${a.image || 'assets/default.jpg'}" alt="${escapeHtml(a.name)}">
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
  const q = e.target.value.trim().toLowerCase();
  renderList(artists.filter(a => a.name.toLowerCase().includes(q)));
});

function openDetail(a, clickEvent){
  // Prevent body scrolling when modal is open
  document.body.style.overflow = 'hidden';

  // Reset any previous modal positioning
  modalBody.style.position = '';
  modalBody.style.top = '';
  modalBody.style.left = '';
  modalBody.style.transform = '';
  
  modalBody.innerHTML = `
    <div class="artist-detail">
      <img src="${a.image || 'assets/default.jpg'}" alt="${escapeHtml(a.name)}">
      <div>
        <h2>${escapeHtml(a.name)}</h2>
        <p class="meta">Followers: ${escapeHtml(a.followers || '—')}</p>
        <p style="color:var(--muted);margin-top:8px">${escapeHtml(a.bio || '')}</p>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          ${a.spotify ? `<a target="_blank" rel="noopener" href="${a.spotify}"><button class="btn">Spotify</button></a>` : ''}
          ${a.soundcloud ? `<a target="_blank" rel="noopener" href="${a.soundcloud}"><button class="btn">SoundCloud</button></a>` : ''}
          ${a.instagram ? `<a target="_blank" rel="noopener" href="${a.instagram}"><button class="btn">Instagram</button></a>` : ''}
        </div>
      </div>
    </div>
  `;
  
  // Show modal
  modal.classList.remove('hidden');
  
  // Focus management for accessibility
  const focusableElements = modalBody.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusableElements.length) {
    setTimeout(() => focusableElements[0].focus(), 100);
  }
  
  // Scroll modal content to top
  modalBody.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e)=> { if(e.target === modal) closeModal(); });

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
    closeModal();
  }
});
document.getElementById('year').textContent = new Date().getFullYear();

adminBtn.addEventListener('click', ()=> {
  window.location.href = 'admin.html';
});

// Music Player
let currentSongIndex = 0;
let songs = [];
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const songTitleEl = document.getElementById('songTitle');
const songArtistEl = document.getElementById('songArtist');

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
    // Try next song
    nextBtn.click();
  };

  // Try to play automatically
  audioPlayer.play().then(() => {
    playBtn.textContent = '⏸️';
  }).catch(error => {
    console.log('Autoplay prevented:', error);
    playBtn.textContent = '▶️';
  });
}

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

// Load and play songs when page loads
async function initializePlayer() {
  try {
    const response = await fetch('/api/songs');
    const data = await response.json();
    songs = data;
    if (songs.length > 0) {
      loadSong(0);
    }
  } catch (error) {
    console.error('Error initializing player:', error);
  }
}

// Start everything when the page loads
document.addEventListener('DOMContentLoaded', initializePlayer);

// simple sanitizer
function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])) }
