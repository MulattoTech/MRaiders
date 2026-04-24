(function bootstrapOverlay() {
  const canvas = document.getElementById('overlay-canvas');
  const context = canvas.getContext('2d');
  const statusChip = document.getElementById('status-chip');
  const calibrationShell = document.getElementById('calibration-shell');

  const controls = {
    mapSelect: document.getElementById('map-select'),
    opacityRange: document.getElementById('opacity-range'),
    opacityOutput: document.getElementById('opacity-output'),
    markerSizeRange: document.getElementById('marker-size-range'),
    markerSizeOutput: document.getElementById('marker-size-output'),
    offsetXInput: document.getElementById('offset-x-input'),
    offsetYInput: document.getElementById('offset-y-input'),
    scaleXInput: document.getElementById('scale-x-input'),
    scaleYInput: document.getElementById('scale-y-input'),
    showLabelsInput: document.getElementById('show-labels-input'),
    followWindowInput: document.getElementById('follow-window-input'),
    windowTitleHintInput: document.getElementById('window-title-hint-input'),
    closePanelButton: document.getElementById('close-panel'),
    resetCalibrationButton: document.getElementById('reset-calibration-button'),
    reloadDataButton: document.getElementById('reload-data-button'),
    mapDescription: document.getElementById('map-description'),
    markerCount: document.getElementById('marker-count'),
    trackingStatus: document.getElementById('tracking-status'),
    dataSource: document.getElementById('data-source')
  };

  const uiState = {
    overlayState: null,
    renderQueued: false,
    syncingControls: false
  };

  const SETTING_LIMITS = {
    opacity: { min: 0.2, max: 1 },
    markerSize: { min: 4, max: 24 },
    xOffset: { min: -1500, max: 1500 },
    yOffset: { min: -1500, max: 1500 },
    scaleX: { min: 0.25, max: 2.5 },
    scaleY: { min: 0.25, max: 2.5 }
  };

  function queueRender() {
    if (uiState.renderQueued) {
      return;
    }

    uiState.renderQueued = true;
    window.requestAnimationFrame(() => {
      uiState.renderQueued = false;
      renderOverlay();
    });
  }

  function setCanvasSize() {
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function drawCalibrationFrame(width, height) {
    context.save();
    context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    context.lineWidth = 2;
    context.setLineDash([10, 10]);
    context.strokeRect(24, 24, width - 48, height - 48);

    context.setLineDash([4, 12]);
    context.strokeStyle = 'rgba(255, 123, 87, 0.24)';
    context.beginPath();
    context.moveTo(width / 2, 24);
    context.lineTo(width / 2, height - 24);
    context.moveTo(24, height / 2);
    context.lineTo(width - 24, height / 2);
    context.stroke();
    context.restore();
  }

  function drawMarkers(width, height, overlayState) {
    const { activeMap, settings } = overlayState;
    const markerRadius = settings.markerSize;
    const accentColor = activeMap.accentColor || '#ff7b57';

    context.save();
    context.globalAlpha = settings.opacity;

    for (const spawn of activeMap.spawns) {
      const x = spawn.x * width * settings.scaleX + settings.xOffset;
      const y = spawn.y * height * settings.scaleY + settings.yOffset;

      context.beginPath();
      context.fillStyle = accentColor;
      context.shadowColor = accentColor;
      context.shadowBlur = 18;
      context.arc(x, y, markerRadius, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.lineWidth = 2;
      context.strokeStyle = 'rgba(248, 243, 233, 0.95)';
      context.arc(x, y, Math.max(4, markerRadius - 2), 0, Math.PI * 2);
      context.stroke();

      if (settings.showLabels) {
        context.shadowBlur = 0;
        context.font = '600 13px Bahnschrift, Tahoma, sans-serif';
        context.textBaseline = 'middle';
        context.fillStyle = '#f8f3e9';
        context.strokeStyle = 'rgba(14, 20, 28, 0.88)';
        context.lineWidth = 4;
        context.strokeText(spawn.label, x + markerRadius + 10, y);
        context.fillText(spawn.label, x + markerRadius + 10, y);
      }
    }

    context.restore();
  }

  function renderOverlay() {
    if (!uiState.overlayState) {
      return;
    }

    setCanvasSize();

    const width = window.innerWidth;
    const height = window.innerHeight;
    context.clearRect(0, 0, width, height);

    const overlayState = uiState.overlayState;

    if (!overlayState.settings.visible) {
      return;
    }

    drawMarkers(width, height, overlayState);

    if (overlayState.status.calibrationMode) {
      drawCalibrationFrame(width, height);
    }
  }

  function updateStatusChip() {
    if (!uiState.overlayState) {
      return;
    }

    const { activeMap, status } = uiState.overlayState;
    const hasLoadError = Boolean(activeMap.loadError);
    const shouldShowChip =
      status.calibrationMode ||
      (status.followGameWindow && !status.trackedWindow) ||
      hasLoadError;

    statusChip.hidden = !shouldShowChip;
    if (!shouldShowChip) {
      statusChip.textContent = '';
      return;
    }

    statusChip.textContent = hasLoadError
      ? `${activeMap.name} · Data load error: ${activeMap.loadError}`
      : `${activeMap.name} · ${activeMap.spawns.length} markers · ${status.trackingMessage}`;
  }

  function syncSelectOptions(maps, activeMapId) {
    const existingIds = Array.from(controls.mapSelect.options).map((option) => option.value);
    const incomingIds = maps.map((map) => map.id);

    if (existingIds.join('|') !== incomingIds.join('|')) {
      controls.mapSelect.replaceChildren(
        ...maps.map((map) => {
          const option = document.createElement('option');
          option.value = map.id;
          option.textContent = `${map.name} (${map.markerCount})`;
          return option;
        })
      );
    } else {
      maps.forEach((map, index) => {
        controls.mapSelect.options[index].textContent = `${map.name} (${map.markerCount})`;
      });
    }

    controls.mapSelect.value = activeMapId;
  }

  function updatePanel() {
    if (!uiState.overlayState) {
      return;
    }

    const { activeMap, maps, settings, status } = uiState.overlayState;

    uiState.syncingControls = true;

    syncSelectOptions(maps, activeMap.id);
    controls.opacityRange.value = String(settings.opacity);
    controls.opacityOutput.textContent = `${Math.round(settings.opacity * 100)}%`;
    controls.markerSizeRange.value = String(settings.markerSize);
    controls.markerSizeOutput.textContent = `${settings.markerSize}px`;
    controls.offsetXInput.value = String(settings.xOffset);
    controls.offsetYInput.value = String(settings.yOffset);
    controls.scaleXInput.value = Number(settings.scaleX).toFixed(2);
    controls.scaleYInput.value = Number(settings.scaleY).toFixed(2);
    controls.showLabelsInput.checked = Boolean(settings.showLabels);
    controls.followWindowInput.checked = Boolean(settings.followGameWindow);
    controls.windowTitleHintInput.value = settings.windowTitleHint || '';

    controls.mapDescription.textContent = activeMap.description || `${activeMap.name} marker layer.`;
    controls.markerCount.textContent = activeMap.loadError
      ? `Could not load ${activeMap.name}: ${activeMap.loadError}`
      : `Loaded ${activeMap.spawns.length} static marker(s) from ${activeMap.name}.`;
    controls.trackingStatus.textContent = status.trackingMessage;
    controls.dataSource.textContent = activeMap.loadError
      ? 'Source unavailable until the JSON loads successfully.'
      : `Source: ${activeMap.source}${activeMap.updatedAt ? ` · Updated ${activeMap.updatedAt}` : ''}`;

    calibrationShell.hidden = !status.calibrationMode;
    calibrationShell.setAttribute('aria-hidden', status.calibrationMode ? 'false' : 'true');
    document.body.classList.toggle('is-calibrating', status.calibrationMode);

    uiState.syncingControls = false;
  }

  function applyPreviewSettings(partial) {
    if (!uiState.overlayState || !partial) {
      return;
    }

    const normalizedPartial = normalizePreviewSettings(partial);

    uiState.overlayState = {
      ...uiState.overlayState,
      settings: {
        ...uiState.overlayState.settings,
        ...normalizedPartial
      }
    };

    queueRender();
  }

  function parseNumberInput(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizePreviewSettings(partial) {
    return Object.fromEntries(
      Object.entries(partial).map(([key, value]) => {
        const limits = SETTING_LIMITS[key];
        if (!limits || typeof value !== 'number' || !Number.isFinite(value)) {
          return [key, value];
        }

        return [key, clamp(value, limits.min, limits.max)];
      })
    );
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  async function persistPatch(partial) {
    if (!partial || uiState.syncingControls) {
      return;
    }

    uiState.overlayState = await window.overlayApi.updateSettings(partial);
    updatePanel();
    updateStatusChip();
    queueRender();
  }

  function handleState(nextState) {
    uiState.overlayState = nextState;
    updatePanel();
    updateStatusChip();
    queueRender();
  }

  function bindControls() {
    controls.mapSelect.addEventListener('change', async (event) => {
      await persistPatch({ activeMapId: event.target.value });
    });

    controls.opacityRange.addEventListener('input', (event) => {
      const nextOpacity = Number(event.target.value);
      controls.opacityOutput.textContent = `${Math.round(nextOpacity * 100)}%`;
      applyPreviewSettings({ opacity: nextOpacity });
    });

    controls.opacityRange.addEventListener('change', async (event) => {
      await persistPatch({ opacity: Number(event.target.value) });
    });

    controls.markerSizeRange.addEventListener('input', (event) => {
      const nextSize = Number(event.target.value);
      controls.markerSizeOutput.textContent = `${nextSize}px`;
      applyPreviewSettings({ markerSize: nextSize });
    });

    controls.markerSizeRange.addEventListener('change', async (event) => {
      await persistPatch({ markerSize: Number(event.target.value) });
    });

    controls.offsetXInput.addEventListener('input', (event) => {
      const nextValue = parseNumberInput(event.target.value);
      if (nextValue !== null) {
        applyPreviewSettings({ xOffset: nextValue });
      }
    });

    controls.offsetXInput.addEventListener('change', async (event) => {
      const nextValue = parseNumberInput(event.target.value);
      if (nextValue === null) {
        updatePanel();
        queueRender();
        return;
      }

      await persistPatch({ xOffset: nextValue });
    });

    controls.offsetYInput.addEventListener('input', (event) => {
      const nextValue = parseNumberInput(event.target.value);
      if (nextValue !== null) {
        applyPreviewSettings({ yOffset: nextValue });
      }
    });

    controls.offsetYInput.addEventListener('change', async (event) => {
      const nextValue = parseNumberInput(event.target.value);
      if (nextValue === null) {
        updatePanel();
        queueRender();
        return;
      }

      await persistPatch({ yOffset: nextValue });
    });

    controls.scaleXInput.addEventListener('input', (event) => {
      const nextValue = parseNumberInput(event.target.value);
      if (nextValue !== null) {
        applyPreviewSettings({ scaleX: nextValue });
      }
    });

    controls.scaleXInput.addEventListener('change', async (event) => {
      const nextValue = parseNumberInput(event.target.value);
      if (nextValue === null) {
        updatePanel();
        queueRender();
        return;
      }

      await persistPatch({ scaleX: nextValue });
    });

    controls.scaleYInput.addEventListener('input', (event) => {
      const nextValue = parseNumberInput(event.target.value);
      if (nextValue !== null) {
        applyPreviewSettings({ scaleY: nextValue });
      }
    });

    controls.scaleYInput.addEventListener('change', async (event) => {
      const nextValue = parseNumberInput(event.target.value);
      if (nextValue === null) {
        updatePanel();
        queueRender();
        return;
      }

      await persistPatch({ scaleY: nextValue });
    });

    controls.showLabelsInput.addEventListener('change', async (event) => {
      await persistPatch({ showLabels: event.target.checked });
    });

    controls.followWindowInput.addEventListener('change', async (event) => {
      await persistPatch({ followGameWindow: event.target.checked });
    });

    controls.windowTitleHintInput.addEventListener('change', async (event) => {
      const nextHint = event.target.value.trim() || 'Arc Raiders';
      event.target.value = nextHint;
      await persistPatch({ windowTitleHint: nextHint });
    });

    controls.windowTitleHintInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur();
      }
    });

    controls.closePanelButton.addEventListener('click', async () => {
      const nextState = await window.overlayApi.togglePanel(false);
      handleState(nextState);
    });

    controls.resetCalibrationButton.addEventListener('click', async () => {
      const nextState = await window.overlayApi.resetCalibration();
      handleState(nextState);
    });

    controls.reloadDataButton.addEventListener('click', async () => {
      const nextState = await window.overlayApi.reloadData();
      handleState(nextState);
    });

    window.addEventListener('keydown', async (event) => {
      if (event.key === 'Escape' && uiState.overlayState?.status.calibrationMode) {
        event.preventDefault();
        const nextState = await window.overlayApi.togglePanel(false);
        handleState(nextState);
      }
    });

    window.addEventListener('resize', () => {
      queueRender();
    });
  }

  async function init() {
    bindControls();
    window.overlayApi.onState(handleState);

    const initialState = await window.overlayApi.getBootstrap();
    handleState(initialState);
  }

  init().catch((error) => {
    console.error('Failed to initialize overlay renderer', error);
  });
})();
