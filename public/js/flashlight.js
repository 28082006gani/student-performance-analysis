/**
 * FLASHLITE INTERACTIVE ENGINE
 * Manages the dynamic spotlight cursor tracking, torch modes, and luminescent card lighting.
 */

(function () {
  let flashlightEnabled = localStorage.getItem('torch_enabled') !== 'false';
  let currentTorchMode = localStorage.getItem('torch_mode') || 'cyan';

  // Apply initial mode
  document.body.setAttribute('data-torch-mode', currentTorchMode);

  // Create spotlight element if missing
  let spotlightEl = document.querySelector('.flashlight-spotlight');
  if (!spotlightEl) {
    spotlightEl = document.createElement('div');
    spotlightEl.className = 'flashlight-spotlight';
    document.body.prepend(spotlightEl);
  }

  // Create background mesh grid if missing
  if (!document.querySelector('.bg-mesh-grid')) {
    const meshEl = document.createElement('div');
    meshEl.className = 'bg-mesh-grid';
    document.body.prepend(meshEl);
  }

  function updateFlashlightState() {
    document.documentElement.style.setProperty('--flashlight-opacity', flashlightEnabled ? '1' : '0');
    const toggleBtns = document.querySelectorAll('.torch-toggle-btn');
    toggleBtns.forEach(btn => {
      btn.innerHTML = flashlightEnabled 
        ? '🔦 <span style="font-size:0.75rem;">Beam: ON</span>' 
        : '🔦 <span style="font-size:0.75rem;opacity:0.6;">Beam: OFF</span>';
    });
    localStorage.setItem('torch_enabled', flashlightEnabled ? 'true' : 'false');
  }

  window.toggleFlashlight = function () {
    flashlightEnabled = !flashlightEnabled;
    updateFlashlightState();
    if (window.showToast) {
      window.showToast(flashlightEnabled ? '🔦 Flashlight spotlight activated' : '🔦 Flashlight turned off', 'info');
    }
  };

  window.setTorchMode = function (mode) {
    currentTorchMode = mode;
    document.body.setAttribute('data-torch-mode', mode);
    localStorage.setItem('torch_mode', mode);

    document.querySelectorAll('.torch-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  };

  // Track mouse and update CSS custom properties
  let ticking = false;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!ticking) {
      window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--cursor-x', `${mouseX}px`);
        document.documentElement.style.setProperty('--cursor-y', `${mouseY}px`);

        // Update cards within visible viewport
        const targets = document.querySelectorAll('.torch-target');
        targets.forEach(card => {
          const rect = card.getBoundingClientRect();
          card.style.setProperty('--card-left', `${rect.left}px`);
          card.style.setProperty('--card-top', `${rect.top}px`);
        });

        ticking = false;
      });
      ticking = true;
    }
  });

  // Keyboard shortcut Alt+F
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      window.toggleFlashlight();
    }
  });

  // Attach controls when DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    updateFlashlightState();
    window.setTorchMode(currentTorchMode);

    document.querySelectorAll('.torch-toggle-btn').forEach(btn => {
      btn.addEventListener('click', window.toggleFlashlight);
    });

    document.querySelectorAll('.torch-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.setTorchMode(btn.dataset.mode);
      });
    });
  });
})();
