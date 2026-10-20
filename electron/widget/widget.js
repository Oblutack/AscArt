(() => {
  const api = window.widgetApi;
  const $ = (id) => document.getElementById(id);

  const container = $("widget-container");
  const content = $("ascii-content");
  const display = $("ascii-display");
  const menu = $("context-menu");
  const playButton = $("btn-play");
  const frameInfo = $("frame-info");
  const sizeInfo = $("size-info");

  const MIN_FONT = 2;
  const MAX_FONT = 20;

  let frames = [];
  let delays = [];
  let current = 0;
  let isPlaying = false;
  let timer = null;
  let fontSize = 6;
  let controlsVisible = true;

  // ---------- Animation ----------

  function showFrame(index) {
    current = index;
    content.innerHTML = frames[index];
    frameInfo.textContent = `Frame ${index + 1}/${frames.length}`;
  }

  function scheduleNext() {
    clearTimeout(timer);
    if (!isPlaying || frames.length < 2) return;

    timer = setTimeout(
      () => {
        showFrame((current + 1) % frames.length);
        scheduleNext();
      },
      Math.max(20, delays[current] || 100),
    );
  }

  function setPlaying(playing) {
    isPlaying = playing;
    playButton.textContent = playing ? "|| Pause" : "▶ Play";
    if (playing) {
      scheduleNext();
    } else {
      clearTimeout(timer);
    }
  }

  function step(direction) {
    if (frames.length < 2) return;
    clearTimeout(timer);
    showFrame((current + direction + frames.length) % frames.length);
    scheduleNext();
  }

  // ---------- Controls ----------

  function setFontSize(size) {
    fontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, size));
    content.style.fontSize = `${fontSize}px`;
    content.style.lineHeight = `${fontSize}px`;
    sizeInfo.textContent = `${fontSize}px`;
  }

  function setControlsVisible(visible) {
    controlsVisible = visible;
    container.classList.toggle("controls-visible", visible);
  }

  function closeWidget() {
    clearTimeout(timer);
    api.close();
  }

  const actions = {
    "toggle-controls": () => setControlsVisible(!controlsVisible),
    "show-controls": () => {
      setControlsVisible(true);
      menu.classList.remove("visible");
    },
    close: closeWidget,
    "toggle-play": () => setPlaying(!isPlaying),
    prev: () => step(-1),
    next: () => step(1),
    smaller: () => setFontSize(fontSize - 1),
    larger: () => setFontSize(fontSize + 1),
  };

  document.addEventListener("click", (e) => {
    const button = e.target.closest("[data-action]");
    if (button && actions[button.dataset.action]) {
      actions[button.dataset.action]();
    }
  });

  // ---------- Dragging the window ----------
  // The art area is not a native drag region (so clicks reach it), which means
  // we move the window ourselves and tell a click apart from a drag.

  let isDragging = false;
  let hasMoved = false;
  let lastX = 0;
  let lastY = 0;

  display.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    hasMoved = false;
    lastX = e.screenX;
    lastY = e.screenY;
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaX = e.screenX - lastX;
    const deltaY = e.screenY - lastY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      hasMoved = true;
      api.moveBy(deltaX, deltaY);
      lastX = e.screenX;
      lastY = e.screenY;
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button !== 0 || !isDragging) return;
    isDragging = false;

    // A click (no drag) closes the menu, or brings the controls back
    if (!hasMoved) {
      if (menu.classList.contains("visible")) {
        menu.classList.remove("visible");
      } else if (!controlsVisible) {
        setControlsVisible(true);
      }
    }
    hasMoved = false;
  });

  display.addEventListener("dragstart", (e) => e.preventDefault());

  // ---------- Context menu ----------

  display.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.add("visible");
  });

  document.addEventListener("mousedown", (e) => {
    if (!menu.contains(e.target) && !display.contains(e.target)) {
      menu.classList.remove("visible");
    }
  });

  // ---------- Start ----------

  api.onData((data) => {
    const isGif =
      Boolean(data.isGif) &&
      Array.isArray(data.frames) &&
      data.frames.length > 0;
    setFontSize(fontSize);

    if (isGif) {
      frames = data.frames;
      delays = Array.isArray(data.delays) ? data.delays : [];
      $("playback-controls").classList.remove("hidden");
      showFrame(0);
      setPlaying(frames.length > 1);
    } else {
      content.innerHTML = data.ascii || "";
    }
  });
})();
