(function () {
  const fullSteps = Array.isArray(window.walkthroughSteps) ? window.walkthroughSteps : [];
  const quickSteps = Array.isArray(window.quickTourSteps) ? window.quickTourSteps : [];

  if (!fullSteps.length && !quickSteps.length) return;

  const audio = new Audio();
  audio.preload = 'auto';

  const state = {
    active: false,
    completed: false,
    paused: false,
    audioError: false,
    mode: 'full',
    index: 0,
    steps: fullSteps,
    activeHighlightElement: null,
    activeHighlightSelector: '',
    activeSection: null,
    lastScrolledSelector: '',
    status: '',
    minimized: false,
  };

  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const launcher = document.createElement('div');
  launcher.className = 'ai-walkthrough-launcher';
  launcher.innerHTML = `
    <button class="ai-walkthrough-start" type="button" aria-label="Start AI walkthrough">
      Start AI Walkthrough
    </button>
    <button class="ai-walkthrough-quick" type="button" aria-label="Start quick 60 second AI tour">
      Quick 60-sec Tour
    </button>
  `;

  const controller = document.createElement('div');
  controller.className = 'ai-walkthrough-controller';
  controller.setAttribute('role', 'region');
  controller.setAttribute('aria-live', 'polite');
  controller.setAttribute('aria-label', 'AI walkthrough controller');
  controller.innerHTML = `
    <div class="ai-walkthrough-meta">
      <span class="ai-walkthrough-label">AI Walkthrough</span>
      <div class="ai-walkthrough-meta-actions">
        <span class="ai-walkthrough-count">0 / 0</span>
        <button class="ai-walkthrough-toggle" type="button" aria-label="Minimize AI walkthrough panel">
          Minimize
        </button>
      </div>
    </div>
    <div class="ai-walkthrough-body">
      <div class="ai-walkthrough-caption"></div>
      <div class="ai-walkthrough-status" role="status"></div>
      <div class="ai-walkthrough-progress" aria-hidden="true">
        <span class="ai-walkthrough-progress-fill"></span>
      </div>
      <div class="ai-walkthrough-controls">
        <button type="button" data-action="pause" aria-label="Pause walkthrough audio">Pause</button>
        <button type="button" data-action="resume" aria-label="Resume walkthrough audio">Resume</button>
        <button type="button" data-action="previous" aria-label="Go to previous walkthrough section">Previous</button>
        <button type="button" data-action="next" aria-label="Go to next walkthrough section">Next</button>
        <button type="button" data-action="restart" aria-label="Restart AI walkthrough">Restart</button>
        <button type="button" data-action="exit" aria-label="Exit AI walkthrough">Exit</button>
      </div>
    </div>
  `;

  document.body.append(launcher, controller);

  const refs = {
    start: launcher.querySelector('.ai-walkthrough-start'),
    quick: launcher.querySelector('.ai-walkthrough-quick'),
    label: controller.querySelector('.ai-walkthrough-label'),
    count: controller.querySelector('.ai-walkthrough-count'),
    toggle: controller.querySelector('.ai-walkthrough-toggle'),
    caption: controller.querySelector('.ai-walkthrough-caption'),
    status: controller.querySelector('.ai-walkthrough-status'),
    progressFill: controller.querySelector('.ai-walkthrough-progress-fill'),
    controls: controller.querySelector('.ai-walkthrough-controls'),
  };

  function currentStep() {
    return state.steps[state.index] || null;
  }

  function getElement(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch (err) {
      console.info('Walkthrough selector is invalid:', selector, err.message);
      return null;
    }
  }

  function scrollToSelector(selector, block = 'center') {
    const target = getElement(selector);
    if (!target) return false;

    target.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block,
      inline: 'nearest',
    });
    return true;
  }

  function clearHighlight() {
    if (state.activeHighlightElement) {
      state.activeHighlightElement.classList.remove('walkthrough-highlight');
    }
    if (state.activeSection) {
      state.activeSection.classList.remove('walkthrough-section-active');
    }
    state.activeHighlightElement = null;
    state.activeHighlightSelector = '';
    state.activeSection = null;
  }

  function setHighlight(highlight) {
    const step = currentStep();

    if (!highlight) {
      clearHighlight();
      refs.caption.textContent = step ? step.caption : '';
      return;
    }

    if (highlight.selector === state.activeHighlightSelector) {
      refs.caption.textContent = highlight.caption || (step ? step.caption : '');
      return;
    }

    const target = getElement(highlight.selector);
    clearHighlight();

    if (!target) {
      refs.caption.textContent = step ? step.caption : '';
      return;
    }

    const section = target.closest('section');
    if (section) {
      section.classList.add('walkthrough-section-active');
      state.activeSection = section;
    }

    target.classList.add('walkthrough-highlight');
    state.activeHighlightElement = target;
    state.activeHighlightSelector = highlight.selector;
    refs.caption.textContent = highlight.caption || (step ? step.caption : '');

    if (state.lastScrolledSelector !== highlight.selector) {
      scrollToSelector(highlight.selector, 'center');
      state.lastScrolledSelector = highlight.selector;
    }
  }

  function syncMinimizedState() {
    controller.classList.toggle('is-minimized', state.minimized);
    refs.toggle.textContent = state.minimized ? 'Expand' : 'Minimize';
    refs.toggle.setAttribute(
      'aria-label',
      state.minimized ? 'Expand AI walkthrough panel' : 'Minimize AI walkthrough panel'
    );
  }

  function findActiveHighlight(step, time) {
    const highlights = Array.isArray(step.highlights) ? step.highlights : [];
    const inRange = highlights.filter(item => time >= item.start && time < item.end);

    for (const highlight of inRange) {
      if (getElement(highlight.selector)) return highlight;
      console.info('Walkthrough highlight skipped because selector was not found:', highlight.selector);
    }

    return null;
  }

  // Timestamped highlights are driven by audio.currentTime, so UI and scroll
  // updates stay synced with the pre-generated narration files.
  function syncHighlightToAudio() {
    const step = currentStep();
    if (!step || !state.active) return;
    setHighlight(findActiveHighlight(step, audio.currentTime || 0));
  }

  function setProgress(percent) {
    refs.progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function updateClipProgress() {
    const step = currentStep();
    const fallbackDuration = step
      ? Math.max(0, ...(step.highlights || []).map(item => item.end || 0))
      : 0;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : fallbackDuration;
    const percent = duration ? ((audio.currentTime || 0) / duration) * 100 : 0;
    setProgress(percent);
  }

  function updateButtons() {
    const buttons = controller.querySelectorAll('button[data-action]');
    buttons.forEach(button => {
      const action = button.dataset.action;
      button.disabled = false;

      if (action === 'pause') {
        button.disabled = !state.active || state.completed || state.paused || state.audioError;
      }
      if (action === 'resume') {
        button.disabled = !state.active || state.completed || !state.paused || state.audioError;
      }
      if (action === 'previous') {
        button.disabled = !state.active || state.index === 0;
      }
      if (action === 'next') {
        button.disabled = !state.active || state.completed;
        button.textContent = state.index === state.steps.length - 1 ? 'Finish' : 'Next';
      }
      if (action === 'restart') {
        button.disabled = !state.active && !state.completed;
      }
      if (action === 'exit') {
        button.disabled = !state.active && !state.completed;
      }
    });
  }

  function updateUI() {
    const step = currentStep();

    if (state.completed) {
      refs.label.textContent = 'Completed';
      refs.count.textContent = `${state.steps.length} / ${state.steps.length}`;
      refs.caption.textContent = 'Walkthrough complete. Thanks for taking the tour.';
      refs.status.textContent = '';
      setProgress(100);
      updateButtons();
      return;
    }

    refs.label.textContent = step ? step.label : 'AI Walkthrough';
    refs.count.textContent = step ? `${state.index + 1} / ${state.steps.length}` : '0 / 0';
    refs.caption.textContent = step ? step.caption : '';
    refs.status.textContent = state.status;
    updateClipProgress();
    updateButtons();
  }

  function stopAudio(resetTime) {
    audio.pause();
    if (resetTime) {
      try {
        audio.currentTime = 0;
      } catch (err) {
        // Some browsers disallow currentTime changes before metadata is ready.
      }
    }
  }

  async function playCurrentAudio() {
    const step = currentStep();
    if (!step) return;

    state.status = '';
    state.paused = false;
    state.audioError = false;
    updateUI();

    try {
      await audio.play();
    } catch (err) {
      state.paused = true;
      state.status = err.name === 'NotAllowedError'
        ? 'Audio is paused. Press Resume to continue.'
        : `Audio could not play. Use Next to continue, or check ${step.audio}.`;
      updateUI();
    }
  }

  function goToStep(index) {
    if (index >= state.steps.length) {
      completeWalkthrough();
      return;
    }

    state.index = Math.max(0, index);
    state.active = true;
    state.completed = false;
    state.paused = false;
    state.audioError = false;
    state.status = '';
    state.lastScrolledSelector = '';

    const step = currentStep();
    if (!step) return;

    stopAudio(true);
    clearHighlight();
    document.body.classList.add('walkthrough-active');
    controller.classList.add('is-visible');
    launcher.classList.add('is-hidden');
    syncMinimizedState();
    setProgress(0);

    audio.src = step.audio;
    audio.load();

    if (scrollToSelector(step.selector, 'start')) {
      state.lastScrolledSelector = step.selector;
    }

    setHighlight(findActiveHighlight(step, 0));
    updateUI();
    playCurrentAudio();
  }

  function startWalkthrough(mode) {
    state.mode = mode === 'quick' ? 'quick' : 'full';
    state.steps = state.mode === 'quick' && quickSteps.length ? quickSteps : fullSteps;
    state.minimized = false;
    goToStep(0);
  }

  function pauseWalkthrough() {
    if (!state.active || state.completed) return;
    audio.pause();
    state.paused = true;
    state.status = 'Paused';
    updateUI();
  }

  function resumeWalkthrough() {
    if (!state.active || state.completed || state.audioError) return;
    state.status = '';
    playCurrentAudio();
  }

  function completeWalkthrough() {
    stopAudio(true);
    state.active = false;
    state.completed = true;
    state.paused = false;
    state.audioError = false;
    state.status = '';
    state.minimized = false;
    document.body.classList.remove('walkthrough-active');
    clearHighlight();
    controller.classList.add('is-visible');
    launcher.classList.add('is-hidden');
    syncMinimizedState();
    updateUI();
  }

  function exitWalkthrough() {
    stopAudio(true);
    audio.removeAttribute('src');
    audio.load();

    state.active = false;
    state.completed = false;
    state.paused = false;
    state.audioError = false;
    state.index = 0;
    state.status = '';
    state.lastScrolledSelector = '';
    state.minimized = false;

    document.body.classList.remove('walkthrough-active');
    clearHighlight();
    controller.classList.remove('is-visible');
    launcher.classList.remove('is-hidden');
    syncMinimizedState();
    setProgress(0);
    updateUI();
  }

  function handleAudioTimeUpdate() {
    syncHighlightToAudio();
    updateClipProgress();
  }

  function handleAudioEnded() {
    if (!state.active) return;
    goToStep(state.index + 1);
  }

  function handleAudioError() {
    if (!state.active) return;
    const step = currentStep();
    state.audioError = true;
    state.paused = true;
    state.status = step
      ? `Audio unavailable. Add ${step.audio}, or use Next to skip this section.`
      : 'Audio unavailable. Use Next to continue.';
    stopAudio(false);
    updateUI();
  }

  function handleControlsClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    if (action === 'pause') pauseWalkthrough();
    if (action === 'resume') resumeWalkthrough();
    if (action === 'next') goToStep(state.index + 1);
    if (action === 'previous') goToStep(state.index - 1);
    if (action === 'restart') startWalkthrough(state.mode);
    if (action === 'exit') exitWalkthrough();
  }

  function toggleMinimized() {
    if (!state.active && !state.completed) return;
    state.minimized = !state.minimized;
    syncMinimizedState();
  }

  function handleKeyboard(event) {
    if (!state.active && !state.completed) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      exitWalkthrough();
    }

    if (!state.active) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToStep(state.index + 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToStep(state.index - 1);
    }
  }

  function destroyWalkthrough() {
    exitWalkthrough();
    refs.start.removeEventListener('click', startFull);
    refs.quick.removeEventListener('click', startQuick);
    refs.toggle.removeEventListener('click', toggleMinimized);
    refs.controls.removeEventListener('click', handleControlsClick);
    document.removeEventListener('keydown', handleKeyboard);
    window.removeEventListener('pagehide', exitWalkthrough);
    audio.removeEventListener('timeupdate', handleAudioTimeUpdate);
    audio.removeEventListener('loadedmetadata', updateClipProgress);
    audio.removeEventListener('ended', handleAudioEnded);
    audio.removeEventListener('error', handleAudioError);
    launcher.remove();
    controller.remove();
  }

  function startFull() {
    startWalkthrough('full');
  }

  function startQuick() {
    startWalkthrough('quick');
  }

  refs.start.addEventListener('click', startFull);
  refs.quick.addEventListener('click', startQuick);
  refs.toggle.addEventListener('click', toggleMinimized);
  refs.controls.addEventListener('click', handleControlsClick);
  document.addEventListener('keydown', handleKeyboard);
  window.addEventListener('pagehide', exitWalkthrough);
  audio.addEventListener('timeupdate', handleAudioTimeUpdate);
  audio.addEventListener('loadedmetadata', updateClipProgress);
  audio.addEventListener('ended', handleAudioEnded);
  audio.addEventListener('error', handleAudioError);

  window.aiWalkthrough = {
    start: startWalkthrough,
    exit: exitWalkthrough,
    destroy: destroyWalkthrough,
  };
}());
