const $ = id => document.getElementById(id);

const screens = {
  input:  $('screen-input'),
  flip:   $('screen-flip'),
  result: $('screen-result'),
  final:  $('screen-final'),
};

function show(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ── State ──────────────────────────────────────────────────────────────────
let choiceA      = '';
let choiceB      = '';
let landed       = '';
let headsChoice  = '';
let tailsChoice  = '';
let countdownTimer = null;

// ── Input screen ──────────────────────────────────────────────────────────
const inputA   = $('choice-a');
const inputB   = $('choice-b');
const btnFlip  = $('btn-flip');

function checkInputs() {
  btnFlip.disabled = !(inputA.value.trim() && inputB.value.trim());
}

inputA.addEventListener('input', checkInputs);
inputB.addEventListener('input', checkInputs);

[inputA, inputB].forEach(el => {
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !btnFlip.disabled) startFlip();
  });
});

btnFlip.addEventListener('click', startFlip);

// ── Flip animation ────────────────────────────────────────────────────────
const coin      = $('coin');
const faceHeads = $('face-heads');
const faceTails = $('face-tails');

function startFlip() {
  choiceA = inputA.value.trim();
  choiceB = inputB.value.trim();

  // Randomly assign heads/tails to choices — coin faces stay blank during spin
  const headsIsA = Math.random() < 0.5;
  headsChoice = headsIsA ? choiceA : choiceB;
  tailsChoice = headsIsA ? choiceB : choiceA;
  faceHeads.textContent = '';
  faceTails.textContent = '';

  // Actual coin result
  landed = Math.random() < 0.5 ? 'heads' : 'tails';

  show('flip');
  animateCoin(landed);
}

function animateCoin(result) {
  // Phase 1: fast spin (constant velocity), Phase 2: ease-out to landing
  const PHASE1_DURATION = 1600; // fast spin
  const PHASE2_DURATION = 1200; // decelerate to landing
  const TOTAL           = PHASE1_DURATION + PHASE2_DURATION;
  const PHASE1_SPINS    = 8;    // rotations during fast phase
  const EXTRA_SPINS     = 4;    // additional rotations in slow phase
  const LAND_DEG        = result === 'heads' ? 0 : 180;
  const PHASE2_END_DEG  = PHASE1_SPINS * 360 + EXTRA_SPINS * 360 + LAND_DEG;

  const wrapper = document.getElementById('coin-wrapper');
  const status  = document.getElementById('flip-status');
  let start = null;
  coin.style.transform = 'rotateY(0deg)';
  wrapper.classList.add('spinning');

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function frame(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;

    let deg;
    if (elapsed < PHASE1_DURATION) {
      // Constant fast spin
      const t = elapsed / PHASE1_DURATION;
      deg = t * PHASE1_SPINS * 360;
    } else {
      // Decelerate to landing
      const t = Math.min((elapsed - PHASE1_DURATION) / PHASE2_DURATION, 1);
      const phase1End = PHASE1_SPINS * 360;
      deg = phase1End + easeOutQuart(t) * (PHASE2_END_DEG - phase1End);

      if (t > 0.6) {
        status.textContent = 'Landing…';
        wrapper.classList.remove('spinning');
      }
    }

    coin.style.transform = `rotateY(${deg}deg)`;

    if (elapsed < TOTAL) {
      requestAnimationFrame(frame);
    } else {
      coin.style.transform = `rotateY(${LAND_DEG}deg)`;
      status.textContent = '';
      setTimeout(showResult, 500);
    }
  }

  requestAnimationFrame(frame);
}

// ── Result screen ─────────────────────────────────────────────────────────
const resultText    = $('result-text');
const countdownBar  = $('countdown-bar');

function lerpColor(a, b, t) {
  const ah = a.replace('#',''), bh = b.replace('#','');
  const ar = parseInt(ah.slice(0,2),16), ag = parseInt(ah.slice(2,4),16), ab = parseInt(ah.slice(4,6),16);
  const br = parseInt(bh.slice(0,2),16), bg = parseInt(bh.slice(2,4),16), bb = parseInt(bh.slice(4,6),16);
  const r = Math.round(ar + (br-ar)*t);
  const g = Math.round(ag + (bg-ag)*t);
  const b2 = Math.round(ab + (bb-ab)*t);
  return `rgb(${r},${g},${b2})`;
}

function showResult() {
  const landedChoice = landed === 'heads' ? headsChoice : tailsChoice;
  const otherChoice  = landedChoice === choiceA ? choiceB : choiceA;

  resultText.textContent = landedChoice;
  show('result');

  const hint       = document.querySelector('.countdown-hint');
  const resultEl   = $('screen-result');
  // Linear so thresholds map exactly to seconds:
  //   0–1.5s  (0–30%)  "Go with your gut"
  //   1.5–3.5s (30–70%) "Decide."
  //   3.5–5s  (70–100%) "NOW" — 1.5s of red
  const DURATION   = 5000;
  let start        = null;
  let shaking      = false;
  countdownBar.style.transform = 'scaleX(1)';
  countdownBar.style.background = '#777';
  hint.textContent = 'Go with your gut';
  resultEl.style.setProperty('--vignette-opacity', '0');

  clearCountdown();

  function tick(ts) {
    if (!start) start = ts;
    const elapsed   = ts - start;
    const progress  = Math.min(elapsed / DURATION, 1);
    const drained   = progress;                          // linear, no curve
    const remaining = Math.max(0, 1 - drained);

    // Bar scale
    countdownBar.style.transform = `scaleX(${remaining})`;

    // Bar color: gray → amber → red, matching text thresholds
    if (drained < 0.3) {
      countdownBar.style.background = lerpColor('#777777', '#f59e0b', drained / 0.3);
    } else {
      countdownBar.style.background = lerpColor('#f59e0b', '#ef4444', (drained - 0.3) / 0.7);
    }

    // Vignette creep — starts later, more gradual
    const vignette = Math.max(0, (drained - 0.6) / 0.4);
    resultEl.style.setProperty('--vignette-opacity', vignette.toFixed(3));

    // Text escalation — Decide at 30%, NOW at 70%
    if (drained < 0.3) {
      hint.textContent = 'Go with your gut';
      hint.style.color = '';
      hint.style.fontWeight = '';
      hint.style.letterSpacing = '';
    } else if (drained < 0.7) {
      hint.textContent = 'Decide.';
      hint.style.color = '#f59e0b';
      hint.style.fontWeight = '';
      hint.style.letterSpacing = '';
    } else {
      hint.textContent = 'NOW';
      hint.style.color = '#ef4444';
      hint.style.fontWeight = '700';
      hint.style.letterSpacing = '0.15em';
    }

    // Shake through the whole NOW phase (last 1.5s)
    if (elapsed > DURATION - 1500 && !shaking) {
      shaking = true;
      resultEl.classList.add('shaking');
    }

    if (elapsed < DURATION) {
      countdownTimer = requestAnimationFrame(tick);
    } else {
      resultEl.classList.remove('shaking');
      resolve('keep', landedChoice, otherChoice);
    }
  }

  countdownTimer = requestAnimationFrame(tick);

  // Buttons
  $('btn-keep').onclick = () => {
    clearCountdown();
    resolve('keep', landedChoice, otherChoice);
  };

  $('btn-again').onclick = () => {
    clearCountdown();
    resolve('again', landedChoice, otherChoice);
  };

  // Keybinds — arrow keys match button layout (left = flip again, right = keep)
  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      clearCountdown();
      document.removeEventListener('keydown', onKey);
      resolve('keep', landedChoice, otherChoice);
    } else if (e.key === 'ArrowLeft') {
      clearCountdown();
      document.removeEventListener('keydown', onKey);
      resolve('again', landedChoice, otherChoice);
    }
  }
  document.addEventListener('keydown', onKey);

  // Store cleanup ref so reset can remove it
  window._resultKeyHandler = onKey;
}

function clearCountdown() {
  if (countdownTimer) {
    cancelAnimationFrame(countdownTimer);
    countdownTimer = null;
  }
}

// ── Final screen ──────────────────────────────────────────────────────────
const finalText = $('final-text');
const finalNote = $('final-note');

function resolve(action, landedChoice, otherChoice) {
  if (window._resultKeyHandler) {
    document.removeEventListener('keydown', window._resultKeyHandler);
    window._resultKeyHandler = null;
  }
  // Clean up urgency state
  const hint = document.querySelector('.countdown-hint');
  hint.style.color = '';
  hint.style.fontWeight = '';
  hint.style.letterSpacing = '';
  $('screen-result').style.setProperty('--vignette-opacity', '0');
  $('screen-result').classList.remove('shaking');

  let answer, note;

  const keepNotes = [
    'You didn\'t flinch.',
    'No hesitation.',
    'Trust it.',
    'That\'s your answer.',
    'Still waters.',
  ];

  const againNotes = [
    'The hesitation said it all.',
    'You already knew.',
    'Your gut spoke first.',
    'That feeling was the answer.',
    'The coin knew too.',
  ];

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  if (action === 'keep') {
    answer = landedChoice;
    note   = pick(keepNotes);
  } else {
    answer = otherChoice;
    note   = pick(againNotes);
  }

  finalText.textContent = answer;
  finalNote.textContent = note;
  show('final');
}

// ── FAQ ───────────────────────────────────────────────────────────────────
const faqOverlay = $('faq-overlay');
$('btn-faq').addEventListener('click', () => faqOverlay.classList.add('open'));
$('faq-close').addEventListener('click', () => faqOverlay.classList.remove('open'));
faqOverlay.addEventListener('click', e => {
  if (e.target === faqOverlay) faqOverlay.classList.remove('open');
});

// ── Reset ─────────────────────────────────────────────────────────────────
$('btn-reset').addEventListener('click', () => {
  inputA.value = '';
  inputB.value = '';
  btnFlip.disabled = true;
  coin.style.transform = 'rotateY(0deg)';
  show('input');
  setTimeout(() => inputA.focus(), 50);
});
