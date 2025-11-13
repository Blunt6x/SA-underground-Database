// Join page client script
const joinForm = document.getElementById('joinForm');
const msgEl = document.getElementById('msg');
const imageFileInput = document.getElementById('imageFile');
const musicFileInput = document.getElementById('musicFile');

function showMsg(t, isError){ msgEl.textContent = t; msgEl.style.color = isError ? 'var(--accent2)' : 'var(--accent)'; }

joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg('Submitting profile...', false);

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  if (!name || !email) { showMsg('Name and email are required', true); return; }

  const payload = {
    name,
    email,
    id: document.getElementById('id').value.trim() || undefined,
    bio: document.getElementById('bio').value.trim(),
    spotify: document.getElementById('spotify').value.trim(),
    instagram: document.getElementById('instagram').value.trim(),
    image: 'images/default.jpg',
    followers: 'New Artist'
  };

  // If an image file is selected, upload it first and use returned path
  const imageFile = imageFileInput.files[0];
  if (imageFile) {
    try {
      const fdf = new FormData();
      fdf.append('image', imageFile);
      const ir = await fetch('/api/public-upload-image', { method: 'POST', body: fdf });
      const idata = await ir.json();
      if (ir.ok && idata.ok) {
        payload.image = idata.path;
      } else {
        console.warn('Image upload failed, continuing with default image', idata);
      }
    } catch (e) {
      console.warn('Image upload error, continuing with default image', e);
    }
  }

  try {
    const res = await fetch('/api/artists-public', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { showMsg('Error: ' + (data.error || 'Failed to create profile'), true); return; }

    const artist = data.artist;
    showMsg('Profile created. Uploading files (if provided)...', false);

    // If a music file provided, upload it to public upload endpoint
    const musicFile = musicFileInput.files[0];
    if (musicFile) {
      const fd = new FormData();
      fd.append('music', musicFile);
      fd.append('artistId', artist.id);
      fd.append('title', musicFile.name.replace('.mp3',''));

      const up = await fetch('/api/public-upload-music', { method: 'POST', body: fd });
      const upData = await up.json();
      if (!up.ok) {
        console.error('Music upload failed', upData);
        showMsg('Profile created but music upload failed: ' + (upData.error||'error'), true);
        return;
      }
    }

    showMsg('Success! Your profile is live. Redirecting...', false);
    setTimeout(()=> window.location.href='/', 1400);
  } catch (err) {
    console.error(err);
    showMsg('Error submitting profile: ' + err.message, true);
  }
});
