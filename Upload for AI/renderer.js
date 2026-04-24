const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let currentMap = 'dam_battlegrounds';
let markers = [];
let opacity = 0.7;
let visible = true;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

async function loadMarkers(map) {
  try {
    const response = await fetch(`data/${map}_caches.json`);
    const data = await response.json();
    markers = data.spawns || [];
  } catch(e) {
    console.error('Failed to load markers', e);
  }
}

function drawMarkers() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!visible) return;

  ctx.globalAlpha = opacity;
  markers.forEach(m => {
    // Simple scaling - adjust these multipliers/offsets in config
    const screenX = m.x * (canvas.width / 2000);   // example scaling - calibrate!
    const screenY = m.y * (canvas.height / 1200);

    ctx.fillStyle = m.density === 'high' ? '#ff0000' : '#00ff00';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
    ctx.fill();

    if (m.notes) {
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText(m.notes, screenX + 12, screenY);
    }
  });
}

function toggleVisibility() {
  visible = !visible;
  drawMarkers();
}

// Basic loop
function gameLoop() {
  drawMarkers();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('resize', () => {
  resizeCanvas();
  drawMarkers();
});

window.addEventListener('keydown', e => {
  if (e.key === 'F8') toggleVisibility();
  // Add more hotkeys
});

// Load initial data
loadMarkers(currentMap).then(() => {
  resizeCanvas();
  gameLoop();
});

// Expose some controls if needed
window.toggleVisibility = toggleVisibility;