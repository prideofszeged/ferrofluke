import { defaultState } from '../state/default-state.js';
import { InteractiveMode } from '../modes/interactive-mode.js';
import { LifeMode } from '../modes/life-mode.js';
import { GameMode } from '../modes/game-mode.js';
import { StarMonsterMode } from '../modes/star-monster-mode.js';
import { ScreensaverMode } from '../modes/screensaver-mode.js';
import { TabManager } from './tab-manager.js';

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
  const magnetEnabledToggle = get('magnet-enabled');
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

  // Keep track of base modes for screensaver wrapping
  let interactiveModeInstance = simulation.currentMode;
  let lifeModeInstance = new LifeMode(simulation);

  const syncLifeToggleState = () => {
    if (!lifeMode) return;
    const isLifeMode = simulation.currentMode?.name === 'life' ||
                       simulation.currentMode?.wrappedMode?.name === 'life';
    lifeMode.checked = isLifeMode;
    const particleControls = [particleCount, particleShape, particleGlow, particleSpeed];
    particleControls.forEach((input) => {
      if (!input) return;
      input.disabled = isLifeMode;
    });
  };

  const syncScreensaverToggleState = () => {
    if (!screensaverEnabled) return;
    const isScreensaver = simulation.currentMode?.name?.startsWith('screensaver');
    screensaverEnabled.checked = isScreensaver;
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

  if (magnetEnabledToggle) {
    magnetEnabledToggle.checked = simulation.state.magnetEnabled;
    simulation.updateMagnetToggleUI = (enabled) => {
      magnetEnabledToggle.checked = enabled;
    };
    magnetEnabledToggle.addEventListener('change', (event) => {
      simulation.setState({ magnetEnabled: event.target.checked });
    });
  } else {
    simulation.updateMagnetToggleUI = () => {};
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
    syncScreensaverToggleState();
    screensaverEnabled.addEventListener('change', (event) => {
      if (event.target.checked) {
        // Wrap current mode in screensaver
        const currentMode = simulation.currentMode;
        const wrappedMode = currentMode?.wrappedMode ? currentMode.wrappedMode : currentMode;
        const screensaver = new ScreensaverMode(simulation, wrappedMode);
        simulation.setMode(screensaver);
      } else {
        // Unwrap to base mode
        const baseMode = simulation.currentMode?.wrappedMode;
        if (baseMode) {
          simulation.setMode(baseMode);
        }
      }
      syncScreensaverToggleState();
    });
  }

  if (screensaverDrift) {
    screensaverDrift.value = simulation.state.screensaverDrift;
    const formatter = (value) => `${value} drift`;
    updateRangeTooltip(screensaverDrift, formatter);
    screensaverDrift.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ screensaverDrift: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (screensaverInterval) {
    screensaverInterval.value = simulation.state.screensaverInterval;
    const formatter = (value) => `${value}s`;
    updateRangeTooltip(screensaverInterval, formatter);
    screensaverInterval.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      simulation.setState({ screensaverInterval: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (screensaverRandomize) {
    screensaverRandomize.addEventListener('click', () => {
      if (simulation.currentMode?.name?.startsWith('screensaver')) {
        simulation.currentMode.randomize();
      }
    });
  }

  if (lifeMode) {
    syncLifeToggleState();
    lifeMode.addEventListener('change', (event) => {
      if (event.target.checked) {
        // Check if currently in screensaver mode
        const isScreensaver = simulation.currentMode?.name?.startsWith('screensaver');
        if (isScreensaver) {
          // Switch to Life mode wrapped in screensaver
          lifeModeInstance = new LifeMode(simulation);
          const screensaver = new ScreensaverMode(simulation, lifeModeInstance);
          simulation.setMode(screensaver);
        } else {
          // Switch to Life mode directly
          lifeModeInstance = new LifeMode(simulation);
          simulation.setMode(lifeModeInstance);
        }
      } else {
        // Switch back to Interactive mode
        const isScreensaver = simulation.currentMode?.name?.startsWith('screensaver');
        if (isScreensaver) {
          // Switch to Interactive wrapped in screensaver
          interactiveModeInstance = new InteractiveMode(simulation);
          const screensaver = new ScreensaverMode(simulation, interactiveModeInstance);
          simulation.setMode(screensaver);
        } else {
          // Switch to Interactive mode directly
          interactiveModeInstance = new InteractiveMode(simulation);
          simulation.setMode(interactiveModeInstance);
        }
      }
      syncLifeToggleState();
      syncScreensaverToggleState();
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

  // Initialize game mode
  const gameMode = new GameMode(simulation);

  // Bind game start button to activate Magnet Roundup game mode
  const gameStartButton = document.querySelector('#game-start');
  if (gameStartButton) {
    gameStartButton.addEventListener('click', () => {
      // Switch to game mode
      const currentMode = simulation.currentMode;
      const isScreensaver = currentMode?.name?.startsWith('screensaver');

      // If in screensaver, unwrap first
      if (isScreensaver) {
        const baseMode = currentMode.wrappedMode;
        simulation.setMode(baseMode);
      }

      // Create new game mode instance and switch to it
      const newGameMode = new GameMode(simulation);
      simulation.setMode(newGameMode);

      // Override end button handler to return to interactive mode
      const gameEndButton = document.querySelector('#game-end');
      if (gameEndButton) {
        const handleEndClick = () => {
          // Return to interactive mode
          interactiveModeInstance = new InteractiveMode(simulation);
          simulation.setMode(interactiveModeInstance);
          gameEndButton.removeEventListener('click', handleEndClick);
        };
        gameEndButton.addEventListener('click', handleEndClick);
      }
    });
  }

  // Bind star monster start button to activate Star Monster game mode
  const starMonsterStartButton = document.querySelector('#star-monster-start');
  if (starMonsterStartButton) {
    starMonsterStartButton.addEventListener('click', () => {
      // Switch to star monster mode
      const currentMode = simulation.currentMode;
      const isScreensaver = currentMode?.name?.startsWith('screensaver');

      // If in screensaver, unwrap first
      if (isScreensaver) {
        const baseMode = currentMode.wrappedMode;
        simulation.setMode(baseMode);
      }

      // Create new star monster mode instance and switch to it
      const starMonsterMode = new StarMonsterMode(simulation);
      simulation.setMode(starMonsterMode);

      // Override end button handler to return to interactive mode
      const starMonsterEndButton = document.querySelector('#star-monster-end');
      if (starMonsterEndButton) {
        const handleEndClick = () => {
          // Return to interactive mode
          interactiveModeInstance = new InteractiveMode(simulation);
          simulation.setMode(interactiveModeInstance);
          starMonsterEndButton.removeEventListener('click', handleEndClick);
        };
        starMonsterEndButton.addEventListener('click', handleEndClick);
      }
    });
  }

  // Initialize tab manager
  const controlsSection = document.querySelector('.controls');
  if (controlsSection) {
    const tabManager = new TabManager(controlsSection);

    // Auto-switch to Life tab when Life mode is toggled ON
    if (lifeMode) {
      lifeMode.addEventListener('change', (event) => {
        if (event.target.checked) {
          tabManager.switchTo('life');
        }
      });
    }

    // Auto-switch to Screensaver tab when Screensaver is toggled ON
    if (screensaverEnabled) {
      screensaverEnabled.addEventListener('change', (event) => {
        if (event.target.checked) {
          tabManager.switchTo('screensaver');
        }
      });
    }
  }

  // Panel toggle functionality
  const panelToggle = document.querySelector('.panel-toggle');
  const controlsPanel = document.querySelector('.controls');

  if (panelToggle && controlsPanel) {
    function togglePanel() {
      const isCollapsed = controlsPanel.classList.toggle('collapsed');
      panelToggle.innerHTML = isCollapsed ? '&gt;&gt;' : '&lt;&lt;';
      panelToggle.setAttribute('aria-label', isCollapsed ? 'Show controls panel' : 'Hide controls panel');
    }

    panelToggle.addEventListener('click', togglePanel);

    // Tab key shortcut to toggle panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Only trigger if not typing in an input
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT'
        );

        if (!isTyping) {
          e.preventDefault();
          togglePanel();
        }
      }
    });
  }
}

export { updateRangeTooltip };
