import { defaultState } from '../state/default-state.js';

function updateRangeTooltip(input, formatter = (value) => value) {
  if (!input) return;
  const formatted = formatter(input.value);
  input.title = formatted;
  input.setAttribute('aria-valuetext', formatted);
}

export function setupControls(simulation) {
  const form = document.getElementById('controls-form');
  if (!form) return;

  form.addEventListener('submit', (event) => event.preventDefault());

  const root = document.documentElement;
  const get = (id) => /** @type {HTMLInputElement | HTMLSelectElement | HTMLButtonElement | null} */ (
    document.getElementById(id)
  );

  const particleCount = get('particle-count');
  const particleShape = get('particle-shape');
  const particleColor = get('particle-color');
  const particleGlow = get('particle-glow');
  const particleSpeed = get('particle-speed');
  const magnetStrength = get('magnet-strength');
  const magnetFalloff = get('magnet-falloff');
  const magnetSize = get('magnet-size');
  const magnetColor = get('magnet-color');
  const magnetAdd = get('magnet-add');
  const magnetReset = get('magnet-reset');
  const showFieldLines = get('show-field-lines');
  const fieldLineColor = get('field-line-color');
  const resetParticlesButton = get('reset-button');

  const lifeMode = get('life-mode');
  const lifeSpeed = get('life-speed');
  const lifeCellSize = get('life-cell-size');
  const lifeRule = get('life-rule');
  const lifePreset = get('life-preset');
  const lifeMagnetBias = get('life-magnet-bias');
  const lifeAliveColor = get('life-alive-color');
  const lifeDeadColor = get('life-dead-color');
  const lifeRandomize = get('life-randomize');
  const lifeClear = get('life-clear');
  const screensaverEnabled = get('screensaver-enabled');
  const screensaverDrift = get('screensaver-drift');
  const screensaverInterval = get('screensaver-interval');
  const screensaverRandomize = get('screensaver-randomize');

  const syncLifeToggleState = () => {
    if (!lifeMode) return;
    lifeMode.checked = simulation.state.lifeMode;
    const particleControls = [particleCount, particleShape, particleGlow, particleSpeed];
    particleControls.forEach((input) => {
      if (!input) return;
      input.disabled = simulation.state.lifeMode;
    });
  };

  const syncLifePresetSelector = () => {
    if (!lifePreset) return;
    const currentRule = simulation.state.lifeRule;
    const option = Array.from(lifePreset.options).find((opt) => opt.value === currentRule);
    lifePreset.value = option ? option.value : 'custom';
  };

  if (particleCount) {
    particleCount.value = simulation.state.particleCount;
    const formatter = (value) => `${value} particles`;
    updateRangeTooltip(particleCount, formatter);
    particleCount.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ particleCount: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (particleShape) {
    particleShape.value = simulation.state.particleShape;
    particleShape.addEventListener('change', (event) => {
      simulation.setState({ particleShape: event.target.value });
    });
  }

  if (particleColor) {
    particleColor.value = simulation.state.particleColor;
    root.style.setProperty('--accent', simulation.state.particleColor);
    particleColor.addEventListener('input', (event) => {
      const color = event.target.value;
      simulation.setState({ particleColor: color });
      root.style.setProperty('--accent', color);
    });
  }

  if (particleGlow) {
    particleGlow.value = simulation.state.particleGlow;
    const formatter = (value) => `${value}px glow`;
    updateRangeTooltip(particleGlow, formatter);
    particleGlow.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ particleGlow: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (particleSpeed) {
    particleSpeed.value = simulation.state.particleSpeed;
    const formatter = (value) => `${Number(value).toFixed(2)}× speed`;
    updateRangeTooltip(particleSpeed, formatter);
    particleSpeed.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ particleSpeed: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (magnetStrength) {
    magnetStrength.value = simulation.state.magnetStrength;
    const formatter = (value) => `Strength ${value}`;
    updateRangeTooltip(magnetStrength, formatter);
    magnetStrength.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ magnetStrength: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (magnetFalloff) {
    magnetFalloff.value = simulation.state.magnetFalloff;
    const formatter = (value) => `Falloff ${Number(value).toFixed(1)}`;
    updateRangeTooltip(magnetFalloff, formatter);
    magnetFalloff.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ magnetFalloff: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (magnetSize) {
    magnetSize.value = simulation.state.magnetSize;
    const formatter = (value) => `${Math.round(value)}px radius`;
    updateRangeTooltip(magnetSize, formatter);
    magnetSize.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ magnetSize: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (magnetColor) {
    magnetColor.value = simulation.state.magnetColor;
    magnetColor.addEventListener('input', (event) => {
      simulation.setState({ magnetColor: event.target.value });
    });
  }

  if (magnetAdd) {
    magnetAdd.addEventListener('click', () => {
      simulation.addMagnet();
    });
  }

  if (magnetReset) {
    magnetReset.addEventListener('click', () => {
      simulation.resetMagnets();
    });
  }

  if (screensaverEnabled) {
    screensaverEnabled.checked = simulation.state.screensaverEnabled;
    screensaverEnabled.addEventListener('change', (event) => {
      simulation.setState({ screensaverEnabled: event.target.checked });
    });
  }

  if (screensaverDrift) {
    screensaverDrift.value = simulation.state.screensaverDrift;
    const formatter = (value) => `${value} drift`; // simple tooltip
    updateRangeTooltip(screensaverDrift, formatter);
    screensaverDrift.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ screensaverDrift: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (screensaverInterval) {
    screensaverInterval.value = simulation.state.screensaverInterval;
    const formatter = (value) => `${value}s`; // seconds
    updateRangeTooltip(screensaverInterval, formatter);
    screensaverInterval.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ screensaverInterval: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (screensaverRandomize) {
    screensaverRandomize.addEventListener('click', () => {
      simulation.randomizeScreensaver();
    });
  }

  if (lifeMode) {
    syncLifeToggleState();
    lifeMode.addEventListener('change', (event) => {
      simulation.setState({ lifeMode: event.target.checked });
      syncLifeToggleState();
    });
  }

  if (lifeSpeed) {
    lifeSpeed.value = simulation.state.lifeSpeed;
    const formatter = (value) => `${value} gen/s`;
    updateRangeTooltip(lifeSpeed, formatter);
    lifeSpeed.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ lifeSpeed: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (lifeCellSize) {
    lifeCellSize.value = simulation.state.lifeCellSize;
    const formatter = (value) => `${value}px cells`;
    updateRangeTooltip(lifeCellSize, formatter);
    lifeCellSize.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ lifeCellSize: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (lifeRule) {
    lifeRule.value = simulation.state.lifeRule;
    lifeRule.addEventListener('change', (event) => {
      simulation.setState({ lifeRule: event.target.value });
      lifeRule.value = simulation.state.lifeRule;
      syncLifePresetSelector();
    });
  }

  if (lifePreset) {
    syncLifePresetSelector();
    lifePreset.addEventListener('change', (event) => {
      if (event.target.value === 'custom') return;
      simulation.setState({ lifeRule: event.target.value });
      if (lifeRule) {
        lifeRule.value = simulation.state.lifeRule;
      }
      syncLifePresetSelector();
    });
  }

  if (lifeMagnetBias) {
    lifeMagnetBias.value = simulation.state.lifeMagnetBias;
    const formatter = (value) => `${Number(value).toFixed(2)} magnet bias`;
    updateRangeTooltip(lifeMagnetBias, formatter);
    lifeMagnetBias.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ lifeMagnetBias: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (lifeAliveColor) {
    lifeAliveColor.value = simulation.state.lifeAliveColor;
    lifeAliveColor.addEventListener('input', (event) => {
      simulation.setState({ lifeAliveColor: event.target.value });
    });
  }

  if (lifeDeadColor) {
    lifeDeadColor.value = simulation.state.lifeDeadColor;
    lifeDeadColor.addEventListener('input', (event) => {
      simulation.setState({ lifeDeadColor: event.target.value });
    });
  }

  if (lifeRandomize) {
    lifeRandomize.addEventListener('click', () => {
      simulation.randomizeLife(0.45);
    });
  }

  if (lifeClear) {
    lifeClear.addEventListener('click', () => {
      simulation.clearLife();
    });
  }

  if (showFieldLines) {
    showFieldLines.checked = simulation.state.showFieldLines;
    if (fieldLineColor) {
      fieldLineColor.disabled = !showFieldLines.checked;
    }
    showFieldLines.addEventListener('change', (event) => {
      const checked = event.target.checked;
      simulation.setState({ showFieldLines: checked });
      if (fieldLineColor) {
        fieldLineColor.disabled = !checked;
      }
    });
  }

  if (fieldLineColor) {
    fieldLineColor.value = simulation.state.fieldLineColor;
    fieldLineColor.addEventListener('input', (event) => {
      simulation.setState({ fieldLineColor: event.target.value });
    });
  }

  if (resetParticlesButton) {
    resetParticlesButton.addEventListener('click', () => {
      simulation.resetParticles();
    });
  }
}

export { updateRangeTooltip };
