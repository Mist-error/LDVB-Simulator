/* ═══════════════════════════════════════════════
   LVDB SIMULATOR – MAIN LOGIC
   DEWA Standard Based Interactive Simulation
   ═══════════════════════════════════════════════ */

// ── STATE ──
const STATE = {
  faultyCircuits: [],         // Array of strings "elcb-mcb"
  isRandomMode: false,       // Hide fault details if true
  isolator: 'off',           // 'off' | 'on'
  elcbs: {
    1: { status: 'off', tripped: false, rating: '40A', sensitivity: '100mA', mcbCount: 6 },
    2: { status: 'off', tripped: false, rating: '40A', sensitivity: '30mA',  mcbCount: 6 },
    3: { status: 'off', tripped: false, rating: '40A', sensitivity: '30mA',  mcbCount: 6 },
  },
  mcbs: {},                  // keyed "elcb-mcb" → 'off' | 'on' | 'tripped'
  faultTriggered: false,
};

// Current load per MCB in Amps (simulated)
const MCB_LOADS = {
  '1-1': 1.2, '1-2': 1.4, '1-3': 1.1, '1-4': 1.5, '1-5': 1.3, '1-6': 1.2,
  '2-1': 1.1, '2-2': 1.5, '2-3': 1.4, '2-4': 1.2, '2-5': 1.3, '2-6': 1.1,
  '3-1': 1.4, '3-2': 1.2, '3-3': 1.5, '3-4': 1.1, '3-5': 1.3, '3-6': 1.2,
};

// ── CUSTOM AUDIO ──
// Preload all sound files
const switchSound = new Audio('sounds/SWITCH ON AND OFF.mp3');
const powerHum    = new Audio('sounds/powerhum.mp3');
const powerOff    = new Audio('sounds/poweroff.mp3');

// Power hum loops continuously while isolator is ON
powerHum.loop = true;
powerHum.volume = 1.0; // Maximized volume

// Pre-configure volumes
switchSound.volume = 1.0; // Maximized volume
powerOff.volume = 1.0;    // Maximized volume

function playSwitchSound() {
  // Clone and play so rapid clicks don't cut each other off
  const click = switchSound.cloneNode();
  click.volume = switchSound.volume;
  click.play().catch(() => {});
}

// Aliases – all switch actions use the same sound
function playSwitchOnSound()  { playSwitchSound(); }
function playSwitchOffSound() { playSwitchSound(); }
function playClickSound()     { playSwitchSound(); }

function playTripSound() {
  // Play the poweroff sound on trip/fault
  const snd = powerOff.cloneNode();
  snd.volume = powerOff.volume;
  snd.play().catch(() => {});
}

function startPowerHum() {
  powerHum.currentTime = 0;
  powerHum.play().catch(() => {});
}

function stopPowerHum() {
  // Fade out smoothly over 300ms
  const fadeOut = setInterval(() => {
    if (powerHum.volume > 0.05) {
      powerHum.volume = Math.max(0, powerHum.volume - 0.05);
    } else {
      clearInterval(fadeOut);
      powerHum.pause();
      powerHum.currentTime = 0;
      powerHum.volume = 0.3; // reset for next play
    }
  }, 30);
}

// ── INITIALIZATION ──
function initMCBStates() {
  for (const elcbId of [1, 2, 3]) {
    const count = STATE.elcbs[elcbId].mcbCount;
    for (let m = 1; m <= count; m++) {
      STATE.mcbs[`${elcbId}-${m}`] = 'off';
    }
  }
}

initMCBStates();

// ── DOM REFS ──
const screens = {
  fault:     document.getElementById('fault-selection-screen'),
  simulator: document.getElementById('simulator-screen'),
};

const dom = {
  faultBtns:     document.querySelectorAll('.fault-btn'),
  noFaultBtn:    document.getElementById('no-fault-btn'),
  isolatorSwitch: document.getElementById('isolator-switch'),
  isolatorPanel: document.getElementById('isolator-panel'),
  backBtn:       document.getElementById('back-btn'),
  clearLogBtn:   document.getElementById('clear-log-btn'),
  eventMessages: document.getElementById('event-messages'),
  faultBadge:    document.getElementById('fault-badge'),
  faultBadgeText:document.getElementById('fault-badge-text'),
  resetBtn:      document.getElementById('reset-btn'),
  randomFaultBtn:document.getElementById('random-fault-btn'),
  topResetBtn:   document.getElementById('top-reset-btn'),
};

// ═══════════════════════════════════════════════
// SCREEN SWITCHING
// ═══════════════════════════════════════════════

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ═══════════════════════════════════════════════
// FAULT SELECTION SCREEN
// ═══════════════════════════════════════════════

dom.faultBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const elcb = btn.dataset.elcb;
    const mcb  = btn.dataset.mcb;
    const key  = `${elcb}-${mcb}`;
    
    if (STATE.faultyCircuits.includes(key)) {
      STATE.faultyCircuits = STATE.faultyCircuits.filter(k => k !== key);
      btn.classList.remove('selected');
    } else {
      STATE.faultyCircuits.push(key);
      btn.classList.add('selected');
      // Deselect "No Fault"
      dom.noFaultBtn.classList.remove('selected');
    }
    
    STATE.isRandomMode = false;
    toggleLaunchBtn();
  });
});

dom.noFaultBtn.addEventListener('click', () => {
  STATE.faultyCircuits = [];
  STATE.isRandomMode = false;
  dom.faultBtns.forEach(b => b.classList.remove('selected'));
  dom.noFaultBtn.classList.add('selected');
  toggleLaunchBtn();
});

dom.randomFaultBtn.addEventListener('click', () => {
  STATE.faultyCircuits = [];
  STATE.isRandomMode = true;
  dom.faultBtns.forEach(b => b.classList.remove('selected'));
  dom.noFaultBtn.classList.remove('selected');
  
  // Pick 1 to 3 random faults
  const count = Math.floor(Math.random() * 3) + 1;
  const pool = [];
  for (let e = 1; e <= 3; e++) {
    for (let m = 1; m <= 6; m++) pool.push(`${e}-${m}`);
  }
  
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const key = pool.splice(idx, 1)[0];
    STATE.faultyCircuits.push(key);
  }
  
  // In random mode, launch immediately and silently
  launchSimulator();
});

function toggleLaunchBtn() {
  const launchBtn = document.getElementById('start-sim-btn');
  if (launchBtn) {
    launchBtn.classList.add('visible');
  }
}

// Add global listener for the new START SIMULATION button
document.addEventListener('click', (e) => {
  if (e.target.id === 'start-sim-btn') {
    launchSimulator();
  }
});

dom.topResetBtn.addEventListener('click', () => {
  resetAllStates();
  showScreen('fault');
  dom.faultBtns.forEach(b => b.classList.remove('selected'));
});

// ═══════════════════════════════════════════════
// RESET LOGIC
// ═══════════════════════════════════════════════
if (dom.resetBtn) {
  dom.resetBtn.addEventListener('click', () => {
    if (!STATE.faultTriggered) {
      logEvent('info', 'System normal. No active fault to reset.');
      return;
    }

    // Check if ELCB is OFF
    // Note: In this version, we check if any ELCB is tripped
    let trippedElcb = null;
    for(let i=1; i<=3; i++) {
        if(STATE.elcbs[i].status === 'off' && STATE.faultTriggered) {
            // Simplified logic: if fault triggered, assume the one that tripped is the one to reset
            trippedElcb = i;
        }
    }

    if (!trippedElcb) {
        logEvent('info', 'System normal.');
        return;
    }

    // Check if ALL MCBs in that ELCB are OFF
    const count = STATE.elcbs[trippedElcb].mcbCount;
    let allOff = true;
    for (let m = 1; m <= count; m++) {
      if (STATE.mcbs[`${trippedElcb}-${m}`] !== 'off') {
        allOff = false;
        break;
      }
    }

    if (!allOff) {
      logEvent('error', `Cannot Reset: Please switch OFF all MCBs in Section ${trippedElcb}.`);
      return;
    }

    // Success reset
    STATE.faultTriggered = false;
    logEvent('success', 'RESET SUCCESSFUL. Fault cleared. You may now resume sequential switching.');
    playSwitchSound();
  });
}

function launchSimulator() {
  const wasRandom = STATE.isRandomMode;
  const numFaults = STATE.faultyCircuits.length;

  resetAllStates();
  STATE.isRandomMode = wasRandom; // restore after reset
  showScreen('simulator');
  updateUI();

  // Show fault badge ONLY if not random
  if (numFaults > 0 && !STATE.isRandomMode) {
    dom.faultBadge.style.display = 'flex';
    dom.faultBadgeText.textContent =
      `Fault Active (${numFaults} circuits)`;
  } else {
    dom.faultBadge.style.display = 'none';
  }
  
  clearLog();
  logEvent('info', 'System ready. Turn ON the Main Isolator to begin.');

  if (numFaults > 0) {
    if (!STATE.isRandomMode) {
      logEvent('warning', `${numFaults} earth leakage fault(s) currently active.`);
    } else {
      logEvent('info', 'Random fault scenario initialized. Test the board to find any issues.');
    }
  } else {
    logEvent('success', 'No fault simulated – Normal operation mode.');
  }
}

// ═══════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════

function resetAllStates() {
  STATE.isolator = 'off';
  STATE.faultTriggered = false;
  STATE.isRandomMode = false;
  for (const id of [1, 2, 3]) {
    STATE.elcbs[id].status = 'off';
    STATE.elcbs[id].tripped = false;
  }
  for (const key in STATE.mcbs) {
    STATE.mcbs[key] = 'off';
  }
  stopPowerHum();
  removeFaultOverlay();
}

// ═══════════════════════════════════════════════
// ISOLATOR LOGIC
// ═══════════════════════════════════════════════

dom.isolatorSwitch.addEventListener('click', () => {
  if (STATE.isolator === 'off') {
    STATE.isolator = 'on';
    playSwitchOnSound();
    startPowerHum();
    logEvent('success', 'Main Isolator switched ON – System energized.');
  } else {
    STATE.isolator = 'off';
    playSwitchOffSound();
    stopPowerHum();
    logEvent('warning', 'Main Isolator switched OFF – System de-energized.');
  }
  updateUI();
});

// ═══════════════════════════════════════════════
// ELCB LOGIC
// ═══════════════════════════════════════════════

document.querySelectorAll('.elcb-switch-area').forEach(area => {
  area.addEventListener('click', () => {
    // Traverse up to find the element containing data-elcb
    const elcbUnit = area.closest('[data-elcb]');
    if (!elcbUnit) return;
    const elcbId = parseInt(elcbUnit.dataset.elcb);
    handleELCBClick(elcbId);
  });
});

// TEST buttons
document.querySelectorAll('.elcb-test-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const elcbId = parseInt(btn.dataset.elcb);
    if (STATE.elcbs[elcbId].status === 'on') {
      tripELCB(elcbId, 'TEST button pressed');
    }
  });
});

function handleELCBClick(elcbId) {
  const elcb = STATE.elcbs[elcbId];
  const elcbUnit = document.getElementById(`elcb-unit-${elcbId}`);
  if (!elcbUnit) return;

  if (STATE.isolator !== 'on') {
    logEvent('error', 'Cannot switch ELCB – Main Isolator is OFF.');
    flashElement(dom.isolatorSwitch);
    return;
  }

  // Handle turning ON
  if (elcb.status === 'off') {
    // Check if any MCB is already ON and Faulty
    let faultyMCB = null;
    for (let m = 1; m <= elcb.mcbCount; m++) {
      const key = `${elcbId}-${m}`;
      if (STATE.mcbs[key] === 'on' && STATE.faultyCircuits.includes(key)) {
        faultyMCB = m;
        break;
      }
    }

    if (faultyMCB) {
      // Immediate Trip Behavior
      elcb.status = 'on';
      playSwitchOnSound();
      updateUI();
      setTimeout(() => {
        tripELCB(elcbId, `Fault still present on MCB ${faultyMCB}. Switch it OFF and press RESET!`);
      }, 150);
      return;
    }

    elcb.status = 'on';
    elcb.tripped = false; // reset trip on manual ON
    playSwitchOnSound();
    logEvent('success', `ELCB-${elcbId} switched ON.`);
  } else {
    elcb.status = 'off';
    elcb.tripped = false; // reset trip on manual OFF
    playSwitchOffSound();
    logEvent('warning', `ELCB-${elcbId} switched OFF – Downstream load disconnected.`);
  }
  updateUI();
}

function tripELCB(elcbId, reason) {
  STATE.elcbs[elcbId].status = 'off';
  STATE.elcbs[elcbId].tripped = true; // turn on RED lamp
  playTripSound();

  STATE.faultTriggered = true;
  logEvent('fault', `ELCB-${elcbId} TRIPPED OFF! Reason: ${reason}`);
  logEvent('warning', `Please manually switch OFF the faulty MCB, then switch ELCB-${elcbId} ON to restore power.`);
  updateUI();
}

// ═══════════════════════════════════════════════
// MCB LOGIC
// ═══════════════════════════════════════════════

document.querySelectorAll('.mcb').forEach(mcbEl => {
  mcbEl.addEventListener('click', () => {
    const elcbId = parseInt(mcbEl.dataset.elcb);
    const mcbId  = parseInt(mcbEl.dataset.mcb);
    handleMCBClick(elcbId, mcbId);
  });
});

function handleMCBClick(elcbId, mcbId) {
  const key  = `${elcbId}-${mcbId}`;
  const elcb = STATE.elcbs[elcbId];

  // Check isolator
  if (STATE.isolator !== 'on') {
    logEvent('error', 'Cannot switch MCB – Main Isolator is OFF.');
    flashElement(dom.isolatorSwitch);
    return;
  }

  // If MCB is currently ON, allow switching it to OFF (part of reset procedure)
  if (STATE.mcbs[key] === 'on') {
    STATE.mcbs[key] = 'off';
    playSwitchOffSound();
    const visualMcb = (elcbId - 1) * 6 + mcbId;
    logEvent('info', `MCB ${visualMcb} (ELCB-${elcbId}) switched OFF.`);
    updateUI();
    return;
  }

  // Check ELCB is ON before allowing a switch to ON
  if (elcb.status !== 'on') {
    logEvent('error', `Cannot switch MCB ON – ELCB-${elcbId} is not ON.`);
    flashElement(document.getElementById(`elcb-unit-${elcbId}`));
    return;
  }

  if (STATE.mcbs[key] === 'off') {
    // ── FAULT CHECK ──
    const circuitKey = `${elcbId}-${mcbId}`;
    const isFaulty   = STATE.faultyCircuits.includes(circuitKey);

    if (isFaulty) {
      // Momentarily show ON
      STATE.mcbs[circuitKey] = 'on';
      STATE.faultTriggered = true;
      updateUI();
      
      setTimeout(() => {
        // ELCB trips and shuts down directly due to fault
        tripELCB(elcbId, `Earth Leakage Fault Detected on MCB ${(elcbId - 1) * 6 + mcbId}`);

        // Show fault overlay ONLY if not hidden random mode
        if (!STATE.isRandomMode) {
            showFaultOverlay(elcbId, mcbId);
        }
        updateUI();
      }, 50); // Faster trip response
      return;
    }

    // STATE.mcbs[key] is 'off' here, cannot reach this block if ELCB is not ON
    STATE.mcbs[key] = 'on';
    playSwitchOnSound();
    const visualMcb = (elcbId - 1) * 6 + mcbId;
    logEvent('success', `MCB ${visualMcb} (ELCB-${elcbId}) switched ON. Load active.`);
  }
  updateUI();
}

// ═══════════════════════════════════════════════
// FAULT TRIGGER
// ═══════════════════════════════════════════════

function showFaultOverlay(elcbId, mcbId) {
  // Remove existing if any
  removeFaultOverlay();

  const overlay = document.createElement('div');
  overlay.className = 'fault-overlay';
  overlay.id = 'fault-overlay';
  overlay.innerHTML = `
    <div class="fault-overlay-content">
      <div class="fault-overlay-icon">⚠</div>
      <div class="fault-overlay-title">FAULT DETECTED</div>
      <div class="fault-overlay-msg">
        Earth Leakage Fault Detected on<br>
        <strong>ELCB-${elcbId} → MCB ${(elcbId - 1) * 6 + mcbId}</strong><br><br>
        ELCB-${elcbId} has been tripped.<br>
        Other circuits remain operational.
      </div>
      <button class="fault-overlay-dismiss" onclick="removeFaultOverlay()">
        ACKNOWLEDGE
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
}

function removeFaultOverlay() {
  const existing = document.getElementById('fault-overlay');
  if (existing) existing.remove();
}

// ═══════════════════════════════════════════════
// BACK BUTTON
// ═══════════════════════════════════════════════

dom.backBtn.addEventListener('click', () => {
  resetAllStates();
  updateUI();
  dom.faultBtns.forEach(b => b.classList.remove('selected'));
  showScreen('fault');
});

// ═══════════════════════════════════════════════
// CLEAR LOG
// ═══════════════════════════════════════════════

dom.clearLogBtn.addEventListener('click', () => {
  clearLog();
});

function clearLog() {
  dom.eventMessages.innerHTML = '';
}

// ═══════════════════════════════════════════════
// EVENT LOGGING
// ═══════════════════════════════════════════════

function logEvent(type, message) {
  const msg = document.createElement('div');
  msg.className = `event-msg ${type}`;

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  msg.textContent = `[${time}] ${message}`;
  dom.eventMessages.appendChild(msg);
  dom.eventMessages.scrollTop = dom.eventMessages.scrollHeight;
}

// ═══════════════════════════════════════════════
// UI UPDATE
// ═══════════════════════════════════════════════

function updateUI() {
  updateIsolatorUI();
  updateELCBsUI();
  updateMCBsUI();
  updateInfoPanels();
}

// ── Isolator ──
function updateIsolatorUI() {
  const sw = dom.isolatorSwitch;
  const panel = document.querySelector('.isolator-panel'); // select the panel directly

  if (STATE.isolator === 'on') {
    sw.classList.add('on');
    sw.querySelector('.iso-label').textContent = 'ON';
    if (panel) panel.classList.add('energized');
  } else {
    sw.classList.remove('on');
    sw.querySelector('.iso-label').textContent = 'OFF';
    if (panel) panel.classList.remove('energized');
  }
}

// ── ELCBs ──
function updateELCBsUI() {
  for (const id of [1, 2, 3]) {
    const unit = document.getElementById(`elcb-unit-${id}`);
    const elcb = STATE.elcbs[id];

    unit.classList.remove('on', 'tripped', 'disabled', 'unpowered');

    // ELCB is unpowered if the Main Isolator is OFF
    if (STATE.isolator !== 'on') {
      unit.classList.add('unpowered');
    }

    if (elcb.status === 'on') {
      unit.classList.add('on');
    }

    // Show tripped indicator if this ELCB is in 'tripped' state
    if (elcb.tripped) {
      unit.classList.add('tripped');
    }
  }
}

// ── MCBs ──
function updateMCBsUI() {
  document.querySelectorAll('.mcb').forEach(mcbEl => {
    const elcbId = parseInt(mcbEl.dataset.elcb);
    const mcbId  = parseInt(mcbEl.dataset.mcb);
    const key    = `${elcbId}-${mcbId}`;
    const status = STATE.mcbs[key];
    const elcb   = STATE.elcbs[elcbId];

    mcbEl.classList.remove('on', 'tripped', 'disabled', 'unpowered', 'powered');

    const isPowered = (STATE.isolator === 'on' && elcb.status === 'on');
    if (isPowered) {
      mcbEl.classList.add('powered');
    }

    // Logic for greying out (unpowered)
    // 1. If Main Isolator is OFF, EVERYTHING greys out.
    // 2. If ELCB is turned OFF manually (not tripped), MCBs grey out.
    // 3. During a TRIP, MCBs stay vivid for manual identification.
    if (STATE.isolator !== 'on' || (elcb.status === 'off' && !elcb.tripped)) {
      mcbEl.classList.add('unpowered');
    }

    if (status === 'on') {
      mcbEl.classList.add('on');
    } else if (status === 'tripped') {
      mcbEl.classList.add('tripped');
    }
  });
}

// ── Info Panels ──
function updateInfoPanels() {
  for (const id of [1, 2, 3]) {
    const elcb   = STATE.elcbs[id];
    const voltEl = document.getElementById(`val-volt-${id}`);
    const currEl = document.getElementById(`val-curr-${id}`);
    const leakEl = document.getElementById(`val-leak-${id}`);

    let voltage = 0;
    let current = 0;
    let leakage = 0;

    if (STATE.isolator === 'on' && elcb.status === 'on') {
      voltage = 230;

      // Sum current from active MCBs
      const count = elcb.mcbCount;
      for (let m = 1; m <= count; m++) {
        const key = `${id}-${m}`;
        if (STATE.mcbs[key] === 'on') {
          current += MCB_LOADS[key] || 0;
        }
      }

      // Simulate small leakage (normal)
      if (current > 0) {
        leakage = Math.round(Math.random() * 3 + 1); // 1-4 mA normal
      }
    }

    if (elcb.status === 'tripped') {
      voltEl.textContent = '0 V';
      voltEl.className = 'info-value fault';
      currEl.textContent = '0 A';
      currEl.className = 'info-value fault';
      leakEl.textContent = `${elcb.sensitivity === '100mA' ? '> 100' : '> 30'} mA`;
      leakEl.className = 'info-value fault';
    } else if (voltage > 0) {
      voltEl.textContent = `${voltage} V`;
      voltEl.className = 'info-value active';
      currEl.textContent = `${current.toFixed(1)} A`;
      currEl.className = 'info-value active';
      leakEl.textContent = `${leakage} mA`;
      leakEl.className = 'info-value';
    } else {
      voltEl.textContent = '0 V';
      voltEl.className = 'info-value';
      currEl.textContent = '0 A';
      currEl.className = 'info-value';
      leakEl.textContent = '0 mA';
      leakEl.className = 'info-value';
    }
  }
}

// ═══════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════

function flashElement(el) {
  if (!el) return;
  el.style.transition = 'box-shadow 0.15s';
  el.style.boxShadow = '0 0 15px rgba(231, 76, 60, 0.7)';
  setTimeout(() => {
    el.style.boxShadow = '';
  }, 400);
}

// ── INITIAL STATE ──
showScreen('fault');
