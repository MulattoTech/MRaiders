(function bootstrapOverlay() {
  const canvas = document.getElementById('overlay-canvas');
  const context = canvas.getContext('2d');
  const statusChip = document.getElementById('status-chip');
  const calibrationShell = document.getElementById('calibration-shell');
  const initialWindowRole =
    new URLSearchParams(window.location.search).get('display') === 'companion'
      ? 'companion'
      : 'overlay';

  const controls = {
    overlayVisibleInput: document.getElementById('overlay-visible-input'),
    companionVisibleInput: document.getElementById('companion-visible-input'),
    mapSelect: document.getElementById('map-select'),
    markerSearchInput: document.getElementById('marker-search-input'),
    clearMarkerSearchButton: document.getElementById(
      'clear-marker-search-button'
    ),
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
    windowModeStatus: document.getElementById('window-mode-status'),
    mapDescription: document.getElementById('map-description'),
    markerCount: document.getElementById('marker-count'),
    trackingStatus: document.getElementById('tracking-status'),
    companionStatus: document.getElementById('companion-status'),
    dataSource: document.getElementById('data-source'),
    markerSearchSummary: document.getElementById('marker-search-summary'),
    markerList: document.getElementById('marker-list')
  };

  const uiState = {
    overlayState: null,
    renderQueued: false,
    syncingControls: false,
    markerSearch: '',
    windowRole: initialWindowRole
  };

  const SETTING_LIMITS = {
    opacity: { min: 0.2, max: 1 },
    markerSize: { min: 4, max: 24 },
    xOffset: { min: -1500, max: 1500 },
    yOffset: { min: -1500, max: 1500 },
    scaleX: { min: 0.25, max: 2.5 },
    scaleY: { min: 0.25, max: 2.5 }
  };

  applyWindowRoleClass(uiState.windowRole);

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

  function applyWindowRoleClass(windowRole) {
    document.body.classList.toggle(
      'window-role--companion',
      windowRole === 'companion'
    );
  }

  function normalizeSearchTerm(value) {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  function markerMatchesSearch(spawn, searchTerm) {
    if (!searchTerm) {
      return true;
    }

    const haystack = [spawn.label, spawn.notes, spawn.id]
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchTerm);
  }

  function getMatchingSpawns(activeMap) {
    const searchTerm = normalizeSearchTerm(uiState.markerSearch);

    if (!searchTerm) {
      return activeMap.spawns;
    }

    return activeMap.spawns.filter((spawn) =>
      markerMatchesSearch(spawn, searchTerm)
    );
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

  function drawMarker(
    width,
    height,
    spawn,
    settings,
    accentColor,
    alphaMultiplier
  ) {
    const markerRadius = settings.markerSize;
    const x = spawn.x * width * settings.scaleX + settings.xOffset;
    const y = spawn.y * height * settings.scaleY + settings.yOffset;

    context.save();
    context.globalAlpha = settings.opacity * alphaMultiplier;
    context.beginPath();
    context.fillStyle = accentColor;
    context.shadowColor = accentColor;
    context.shadowBlur = alphaMultiplier >= 1 ? 18 : 8;
    context.arc(x, y, markerRadius, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.lineWidth = 2;
    context.strokeStyle = 'rgba(248, 243, 233, 0.95)';
    context.arc(x, y, Math.max(4, markerRadius - 2), 0, Math.PI * 2);
    context.stroke();

    if (settings.showLabels && alphaMultiplier >= 1) {
      context.shadowBlur = 0;
      context.font = '600 13px Bahnschrift, Tahoma, sans-serif';
      context.textBaseline = 'middle';
      context.fillStyle = '#f8f3e9';
      context.strokeStyle = 'rgba(14, 20, 28, 0.88)';
      context.lineWidth = 4;
      context.strokeText(spawn.label, x + markerRadius + 10, y);
      context.fillText(spawn.label, x + markerRadius + 10, y);
    }

    context.restore();
  }

  function drawMarkers(width, height, overlayState) {
    const { activeMap, settings } = overlayState;
    const accentColor = activeMap.accentColor || '#ff7b57';
    const searchTerm = normalizeSearchTerm(uiState.markerSearch);
    const matchingSpawns = getMatchingSpawns(activeMap);

    if (!searchTerm) {
      for (const spawn of activeMap.spawns) {
        drawMarker(width, height, spawn, settings, accentColor, 1);
      }
      return;
    }

    const matchingIds = new Set(matchingSpawns.map((spawn) => spawn.id));

    for (const spawn of activeMap.spawns) {
      if (!matchingIds.has(spawn.id)) {
        drawMarker(width, height, spawn, settings, accentColor, 0.18);
      }
    }

    for (const spawn of matchingSpawns) {
      drawMarker(width, height, spawn, settings, accentColor, 1);
    }
  }

  function renderOverlay() {
    if (!uiState.overlayState) {
      return;
    }

    setCanvasSize();

    const width = window.innerWidth;
    const height = window.innerHeight;
    context.clearRect(0, 0, width, height);

    if (!uiState.overlayState.status.currentWindowVisible) {
      return;
    }

    drawMarkers(width, height, uiState.overlayState);

    if (
      uiState.overlayState.status.calibrationMode &&
      uiState.overlayState.status.windowRole === 'overlay'
    ) {
      drawCalibrationFrame(width, height);
    }
  }

  function updateStatusChip() {
    if (!uiState.overlayState) {
      return;
    }

    const { activeMap, status } = uiState.overlayState;
    const matchingSpawns = getMatchingSpawns(activeMap);
    const hasLoadError = Boolean(activeMap.loadError);
    const shouldShowChip =
      hasLoadError ||
      (status.windowRole === 'overlay' &&
        (status.calibrationMode ||
          (status.followGameWindow && !status.trackedWindow))) ||
      (status.windowRole === 'companion' && !status.multipleDisplaysAvailable);

    statusChip.hidden = !shouldShowChip;
    if (!shouldShowChip) {
      statusChip.textContent = '';
      return;
    }

    const filterMessage = uiState.markerSearch
      ? ` · Filter ${matchingSpawns.length}/${activeMap.spawns.length}`
      : '';

    if (hasLoadError) {
      statusChip.textContent = `${activeMap.name} · Data load error: ${activeMap.loadError}`;
      return;
    }

    if (status.windowRole === 'companion') {
      statusChip.textContent = `${status.windowLabel} · ${activeMap.spawns.length} markers${filterMessage} · ${status.companionMessage}`;
      return;
    }

    statusChip.textContent = `${activeMap.name} · ${activeMap.spawns.length} markers${filterMessage} · ${status.trackingMessage}`;
  }

  function syncSelectOptions(maps, activeMapId) {
    const existingIds = Array.from(controls.mapSelect.options).map(
      (option) => option.value
    );
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
        controls.mapSelect.options[index].textContent =
          `${map.name} (${map.markerCount})`;
      });
    }

    controls.mapSelect.value = activeMapId;
  }

  function renderMarkerList(activeMap) {
    const matchingSpawns = getMatchingSpawns(activeMap);

    controls.markerSearchSummary.textContent = uiState.markerSearch
      ? `${matchingSpawns.length} of ${activeMap.spawns.length} markers`
      : `${activeMap.spawns.length} markers loaded`;

    if (!matchingSpawns.length) {
      const emptyState = document.createElement('p');
      emptyState.className = 'empty-state';
      emptyState.textContent = uiState.markerSearch
        ? 'No markers match the current search.'
        : 'No markers are available for this layer.';
      controls.markerList.replaceChildren(emptyState);
      return;
    }

    controls.markerList.replaceChildren(
      ...matchingSpawns.map((spawn) => {
        const card = document.createElement('article');
        const title = document.createElement('h3');
        const notes = document.createElement('p');
        const coords = document.createElement('p');

        card.className = 'marker-card';
        title.className = 'marker-card__title';
        notes.className = 'marker-card__notes';
        coords.className = 'marker-card__coords';

        title.textContent = spawn.label;
        notes.textContent = spawn.notes || 'Static route reference point.';
        coords.textContent = `${spawn.id} · x:${spawn.x.toFixed(3)} · y:${spawn.y.toFixed(3)}`;

        card.append(title, notes, coords);
        return card;
      })
    );
  }

  function updatePanel() {
    if (!uiState.overlayState) {
      return;
    }

    const { activeMap, maps, settings, status } = uiState.overlayState;

    uiState.syncingControls = true;
    uiState.windowRole = status.windowRole || uiState.windowRole;

    applyWindowRoleClass(uiState.windowRole);
    document.title = `${status.windowLabel} | Arc Raiders Cache Companion`;

    syncSelectOptions(maps, activeMap.id);
    if (document.activeElement !== controls.markerSearchInput) {
      controls.markerSearchInput.value = uiState.markerSearch;
    }
    controls.overlayVisibleInput.checked = Boolean(status.overlayVisible);
    controls.companionVisibleInput.checked = Boolean(status.companionVisible);
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

    controls.windowModeStatus.textContent = `${status.windowLabel} is currently open. Game overlay: ${
      status.overlayVisible ? 'on' : 'off'
    } · Second monitor view: ${status.companionVisible ? 'on' : 'off'}.`;
    controls.mapDescription.textContent =
      activeMap.description || `${activeMap.name} marker layer.`;
    controls.markerCount.textContent = activeMap.loadError
      ? `Could not load ${activeMap.name}: ${activeMap.loadError}`
      : `Loaded ${activeMap.spawns.length} static marker(s) from ${activeMap.name}.`;
    controls.trackingStatus.textContent = status.trackingMessage;
    controls.companionStatus.textContent = status.companionMessage;
    controls.dataSource.textContent = activeMap.loadError
      ? 'Source unavailable until the JSON loads successfully.'
      : `Source: ${activeMap.source}${activeMap.updatedAt ? ` · Updated ${activeMap.updatedAt}` : ''}`;

    calibrationShell.hidden = !status.calibrationMode;
    calibrationShell.setAttribute(
      'aria-hidden',
      status.calibrationMode ? 'false' : 'true'
    );
    document.body.classList.toggle('is-calibrating', status.calibrationMode);

    renderMarkerList(activeMap);
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

  function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(target.closest('input, textarea, select, button'));
  }

  async function handleCalibrationNudge(event) {
    if (
      !uiState.overlayState?.status.calibrationMode ||
      isEditableTarget(event.target)
    ) {
      return false;
    }

    const step = event.shiftKey ? 10 : 1;
    const delta = { xOffset: 0, yOffset: 0 };

    switch (event.key) {
      case 'ArrowLeft':
        delta.xOffset = -step;
        break;
      case 'ArrowRight':
        delta.xOffset = step;
        break;
      case 'ArrowUp':
        delta.yOffset = -step;
        break;
      case 'ArrowDown':
        delta.yOffset = step;
        break;
      default:
        return false;
    }

    event.preventDefault();
    const nextState = await window.overlayApi.nudgeCalibration(delta);
    handleState(nextState);
    return true;
  }

  function bindControls() {
    controls.overlayVisibleInput.addEventListener('change', async (event) => {
      await persistPatch({ visible: event.target.checked });
    });

    controls.companionVisibleInput.addEventListener('change', async (event) => {
      await persistPatch({ companionVisible: event.target.checked });
    });

    controls.mapSelect.addEventListener('change', async (event) => {
      await persistPatch({ activeMapId: event.target.value });
    });

    controls.markerSearchInput.addEventListener('input', (event) => {
      uiState.markerSearch = event.target.value;
      updatePanel();
      updateStatusChip();
      queueRender();
    });

    controls.clearMarkerSearchButton.addEventListener('click', () => {
      uiState.markerSearch = '';
      controls.markerSearchInput.value = '';
      updatePanel();
      updateStatusChip();
      queueRender();
      controls.markerSearchInput.focus();
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
      if (
        event.key === 'Escape' &&
        uiState.overlayState?.status.calibrationMode
      ) {
        event.preventDefault();
        const nextState = await window.overlayApi.togglePanel(false);
        handleState(nextState);
        return;
      }

      await handleCalibrationNudge(event);
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
