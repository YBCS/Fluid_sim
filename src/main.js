import { FluidSolver } from './fluidsolver.js';
import { Cigarette } from './cigarette.js';

const NUM_OF_CELLS = 96;
const DENSITY_DECAY = 0.995;
const IDLE_SMOKE_DENSITY = 5;
const IDLE_SMOKE_VELOCITY = -0.5;
const EXHALE_BASE_DENSITY = 50;
const EXHALE_MAX_DENSITY = 120;
const EXHALE_BASE_FRAMES = 12;
const EXHALE_MAX_FRAMES = 35;
const EXHALE_VELOCITY = -3.5;
const INHALE_MAX_SECONDS = 2.0;

const STATE_IDLE = 0;
const STATE_INHALING = 1;
const STATE_EXHALING = 2;

const canvas = document.getElementById('smoke-canvas');
const ctx = canvas.getContext('2d');

let cellSizeX, cellSizeY;
let fdBuffer;
let animFrameId;
let lastTime = performance.now();

// Solver
const fs = new FluidSolver(NUM_OF_CELLS);
fs.dt = 0.15;
fs.diffusion = 0.0001;
fs.viscosity = 0;
fs.iterations = 10;
fs.doVorticityConfinement = true;
fs.doBuoyancy = true;

// Cigarette
let cig;

// Puff state
let state = STATE_IDLE;
let inhaleStartTime = 0;
let exhaleFramesRemaining = 0;
let currentExhaleDensity = 0;
let exhaleGridI = 0;
let exhaleGridJ = 0;

function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxDim = 800;
    const w = Math.min(canvas.clientWidth * dpr, maxDim);
    const h = Math.min(canvas.clientHeight * dpr, maxDim * 2);
    canvas.width = w;
    canvas.height = h;
    cellSizeX = w / NUM_OF_CELLS;
    cellSizeY = h / NUM_OF_CELLS;
    fdBuffer = ctx.createImageData(w, h);

    if (!cig) {
        cig = new Cigarette(w, h);
    } else {
        cig.resize(w, h);
    }
}

function clearBuffer() {
    const data = fdBuffer.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
    }
}

function canvasToGrid(px, py) {
    const i = Math.floor(px / cellSizeX) + 1;
    const j = Math.floor(py / cellSizeY) + 1;
    return {
        i: Math.max(1, Math.min(NUM_OF_CELLS, i)),
        j: Math.max(1, Math.min(NUM_OF_CELLS, j))
    };
}

function injectSmoke() {
    if (state === STATE_IDLE && !cig.isDone) {
        const tip = cig.getTipPosition();
        const g = canvasToGrid(tip.x, tip.y);
        fs.dOld[fs.I(g.i, g.j)] += IDLE_SMOKE_DENSITY;
        fs.vOld[fs.I(g.i, g.j)] += IDLE_SMOKE_VELOCITY;
        fs.uOld[fs.I(g.i, g.j)] += (Math.random() - 0.5) * 0.2;
    }

    if (state === STATE_EXHALING && exhaleFramesRemaining > 0) {
        const totalFrames = EXHALE_BASE_FRAMES +
            (EXHALE_MAX_FRAMES - EXHALE_BASE_FRAMES) * getHoldFactor();
        const progress = 1 - (exhaleFramesRemaining / totalFrames);
        const falloff = Math.max(0, 1 - progress * 1.5);

        for (let di = -2; di <= 2; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                const ci = exhaleGridI + di;
                const cj = exhaleGridJ + dj;
                if (ci >= 1 && ci <= NUM_OF_CELLS && cj >= 1 && cj <= NUM_OF_CELLS) {
                    const idx = fs.I(ci, cj);
                    fs.dOld[idx] += currentExhaleDensity * falloff;
                    fs.vOld[idx] += EXHALE_VELOCITY * falloff;
                    fs.uOld[idx] += (Math.random() - 0.5) * 0.8;
                }
            }
        }

        exhaleFramesRemaining--;
        if (exhaleFramesRemaining <= 0) {
            state = STATE_IDLE;
        }
    }
}

let _holdFactor = 0;
function getHoldFactor() { return _holdFactor; }

function startInhale() {
    if (cig.isDone) return;
    state = STATE_INHALING;
    inhaleStartTime = performance.now();
}

function startExhale() {
    if (state !== STATE_INHALING) return;

    const holdTime = (performance.now() - inhaleStartTime) / 1000;
    _holdFactor = Math.min(holdTime / INHALE_MAX_SECONDS, 1.0);

    exhaleFramesRemaining = Math.floor(
        EXHALE_BASE_FRAMES + _holdFactor * (EXHALE_MAX_FRAMES - EXHALE_BASE_FRAMES)
    );
    currentExhaleDensity = EXHALE_BASE_DENSITY +
        _holdFactor * (EXHALE_MAX_DENSITY - EXHALE_BASE_DENSITY);

    const tip = cig.getTipPosition();
    const g = canvasToGrid(tip.x, tip.y);
    exhaleGridI = g.i;
    exhaleGridJ = g.j;

    cig.puff();
    state = STATE_EXHALING;

    if (cig.isDone) {
        setTimeout(() => {
            document.getElementById('overlay-done').classList.remove('hidden');
        }, 3000);
    }
}

function update() {
    const now = performance.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    // Update glow
    if (state === STATE_INHALING) {
        const elapsed = (now - inhaleStartTime) / 1000;
        cig.setGlow(Math.min(elapsed / 1.0, 1.0));
    } else {
        cig.setGlow(Math.max(0, cig.glowIntensity - deltaTime * 3));
    }

    // Inject smoke sources
    injectSmoke();

    // Step simulation
    fs.velocityStep();
    fs.densityStep();

    // Density decay
    for (let i = 0; i < fs.numOfCells; i++) {
        fs.d[i] *= DENSITY_DECAY;
        if (fs.d[i] < 0.001) fs.d[i] = 0;
    }

    // Render
    clearBuffer();

    const w = canvas.width;
    const h = canvas.height;
    const data = fdBuffer.data;

    for (let i = 1; i <= NUM_OF_CELLS; i++) {
        for (let j = 1; j <= NUM_OF_CELLS; j++) {
            const cellIndex = i + (NUM_OF_CELLS + 2) * j;
            const density = fs.d[cellIndex];
            if (density > 0) {
                const brightness = Math.min(255, density * 255);
                const cellW = Math.ceil(cellSizeX);
                const cellH = Math.ceil(cellSizeY);
                const baseX = Math.floor((i - 1) * cellSizeX);
                const baseY = Math.floor((j - 1) * cellSizeY);

                for (let l = 0; l < cellW; l++) {
                    for (let m = 0; m < cellH; m++) {
                        const pxX = baseX + l;
                        const pxY = baseY + m;
                        if (pxX >= w || pxY >= h) continue;
                        const pxIdx = (pxX + pxY * w) * 4;
                        data[pxIdx] = brightness;
                        data[pxIdx + 1] = brightness;
                        data[pxIdx + 2] = brightness;
                    }
                }
            }
        }
    }

    ctx.putImageData(fdBuffer, 0, 0);
    cig.draw(ctx);

    animFrameId = requestAnimationFrame(update);
}

// Input
canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startInhale();
});

canvas.addEventListener('pointerup', (e) => {
    e.preventDefault();
    startExhale();
});

canvas.addEventListener('pointercancel', (e) => {
    e.preventDefault();
    startExhale();
});

canvas.addEventListener('pointerleave', (e) => {
    e.preventDefault();
    if (state === STATE_INHALING) startExhale();
});

// Fullscreen (with webkit fallback for Safari)
document.getElementById('btn-fullscreen').addEventListener('click', () => {
    const el = document.documentElement;
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFullscreen) {
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
});

// Close
document.getElementById('btn-close').addEventListener('click', () => {
    cancelAnimationFrame(animFrameId);
    canvas.style.display = 'none';
    document.getElementById('overlay-done').classList.remove('hidden');
    document.getElementById('overlay-done').querySelector('p').textContent = 'See you next time.';
});

// Restart
document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('overlay-done').classList.add('hidden');
    canvas.style.display = 'block';

    cig = new Cigarette(canvas.width, canvas.height);
    fs.resetDensity();
    fs.resetVelocity();
    state = STATE_IDLE;
    _holdFactor = 0;
    exhaleFramesRemaining = 0;
    lastTime = performance.now();

    animFrameId = requestAnimationFrame(update);
});

// Init
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
fs.resetVelocity();
animFrameId = requestAnimationFrame(update);
