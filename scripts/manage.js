// Artist manage script: login, view profile, upload tracks
const loginForm = document.getElementById('loginForm');
const artistIdInput = document.getElementById('artistId');
const artistEmailInput = document.getElementById('artistEmail');
const accountArea = document.getElementById('accountArea');
const profileInfo = document.getElementById('profileInfo');
const messageEl = document.getElementById('message');
const uploadForm = document.getElementById('uploadForm');
const trackFile = document.getElementById('trackFile');
const trackTitle = document.getElementById('trackTitle');
const signoutBtn = document.getElementById('signoutBtn');

const ARTIST_TOKEN_KEY = 'sa_ug_artist_token_v1';

// Edit form elements
const editForm = document.getElementById('editForm');
const editName = document.getElementById('editName');
const editBio = document.getElementById('editBio');
const editSpotify = document.getElementById('editSpotify');
const editInstagram = document.getElementById('editInstagram');
const editImage = document.getElementById('editImage');
const saveProfileBtn = document.getElementById('saveProfileBtn');

function showMsg(t, isError){ messageEl.textContent = t; messageEl.style.color = isError ? 'var(--accent2)' : 'var(--accent)'; }

async function setProfileFromToken(){
  const token = localStorage.getItem(ARTIST_TOKEN_KEY);
  if (!token) return;
  try {
    const res = await fetch('/api/artist/me', { headers: { 'X-Artist-Token': token } });
    if (!res.ok) { throw new Error('Unauthorized'); }
    const j = await res.json();
    if (j.ok) {
      accountArea.style.display = 'block';
        profileInfo.innerHTML = `<div style="display:flex;gap:12px;align-items:center"><img src="${j.artist.image||'images/default.jpg'}" style="width:84px;height:84px;border-radius:10px;object-fit:cover"/><div><strong>${j.artist.name}</strong><div class="note">ID: ${j.artist.id}</div></div></div>`;
        // populate edit form
        editName.value = j.artist.name || '';
        editBio.value = j.artist.bio || '';
        editSpotify.value = j.artist.spotify || '';
        editInstagram.value = j.artist.instagram || '';
    }
  } catch (err) {
    console.error('Profile load failed', err);
    localStorage.removeItem(ARTIST_TOKEN_KEY);
    accountArea.style.display = 'none';
  }
}

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id = artistIdInput.value.trim();
  const email = artistEmailInput.value.trim();
  if (!id || !email) { showMsg('Please enter ID and email', true); return; }
  try {
    const res = await fetch('/api/artist-login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, email }) });
    const j = await res.json();
    if (!res.ok) { showMsg('Sign in failed: ' + (j.error||res.statusText), true); return; }
    localStorage.setItem(ARTIST_TOKEN_KEY, j.token);
    showMsg('Signed in — loading profile...', false);
    await setProfileFromToken();
  } catch (err) { console.error(err); showMsg('Sign in error: ' + err.message, true); }
});

uploadForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const token = localStorage.getItem(ARTIST_TOKEN_KEY);
  if (!token) { showMsg('Please sign in first', true); return; }
  const file = trackFile.files[0];
  if (!file) { showMsg('Please choose an MP3 file', true); return; }
  const fd = new FormData(); fd.append('music', file); fd.append('title', trackTitle.value || file.name.replace('.mp3',''));
  try {
    const res = await fetch('/api/artist-upload-music', { method: 'POST', headers: { 'X-Artist-Token': token }, body: fd });
    const j = await res.json();
    if (!res.ok) { showMsg('Upload failed: ' + (j.error||res.statusText), true); return; }
    showMsg('Upload successful! Your track has been added.', false);
    trackFile.value = ''; trackTitle.value = '';
  } catch (err) { console.error(err); showMsg('Upload error: ' + err.message, true); }
});

// Save profile edits (including optional image)
saveProfileBtn.addEventListener('click', async () => {
  const token = localStorage.getItem(ARTIST_TOKEN_KEY);
  if (!token) { showMsg('Please sign in first', true); return; }

  showMsg('Saving profile...', false);
  let imagePath = null;
  if (editImage && editImage.files && editImage.files[0]) {
    const f = new FormData();
    f.append('image', editImage.files[0]);
    try {
      const ir = await fetch('/api/public-upload-image', { method: 'POST', body: f });
      const id = await ir.json();
      if (ir.ok && id.ok) imagePath = id.path;
      else console.warn('Image upload failed', id);
    } catch (err) { console.error('Image upload error', err); }
  }

  const payload = {
    name: editName.value.trim(),
    bio: editBio.value.trim(),
    spotify: editSpotify.value.trim(),
    instagram: editInstagram.value.trim()
  };
  if (imagePath) payload.image = imagePath;

  try {
    const res = await fetch('/api/artist/me', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Artist-Token': localStorage.getItem(ARTIST_TOKEN_KEY) }, body: JSON.stringify(payload) });
    const j = await res.json();
    if (!res.ok) { showMsg('Save failed: ' + (j.error||res.statusText), true); return; }
    showMsg('Profile updated', false);
    // refresh
    await setProfileFromToken();
  } catch (err) { console.error(err); showMsg('Save error: ' + err.message, true); }
});

signoutBtn.addEventListener('click', ()=>{
  localStorage.removeItem(ARTIST_TOKEN_KEY);
  accountArea.style.display = 'none';
  showMsg('Signed out', false);
});

// On load, check token
setProfileFromToken();
