import { GUI } from 'https://cdn.jsdelivr.net/npm/lil-gui@0.17/+esm';
import { FluidSolver } from './fluidsolver.js';
import { Particle } from './particle.js';
import { Cigarette } from './cigarette.js';

const NUM_OF_CELLS = 96;

const smokeOptions = {
    densityDecay: 0.995,
    idleSmokeDensity: 5,
    exhaleBaseDensity: 50,
    exhaleMaxDensity: 120,
    exhaleVelocity: -3.5,
    smokeBlur: 0,
    drawDensityField: true,
    drawVelocityField: false,
    drawParticles: false,
};

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
let particles = [];

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
        fs.dOld[fs.I(g.i, g.j)] += smokeOptions.idleSmokeDensity;
        fs.vOld[fs.I(g.i, g.j)] += -0.5;
        fs.uOld[fs.I(g.i, g.j)] += (Math.random() - 0.5) * 0.2;
    }

    if (state === STATE_EXHALING && exhaleFramesRemaining > 0) {
        const totalFrames = 12 + (35 - 12) * getHoldFactor();
        const progress = 1 - (exhaleFramesRemaining / totalFrames);
        const falloff = Math.max(0, 1 - progress * 1.5);

        for (let di = -2; di <= 2; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                const ci = exhaleGridI + di;
                const cj = exhaleGridJ + dj;
                if (ci >= 1 && ci <= NUM_OF_CELLS && cj >= 1 && cj <= NUM_OF_CELLS) {
                    const idx = fs.I(ci, cj);
                    fs.dOld[idx] += currentExhaleDensity * falloff;
                    fs.vOld[idx] += smokeOptions.exhaleVelocity * falloff;
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
    _holdFactor = Math.min(holdTime / 2.0, 1.0);

    exhaleFramesRemaining = Math.floor(12 + _holdFactor * (35 - 12));
    currentExhaleDensity = smokeOptions.exhaleBaseDensity +
        _holdFactor * (smokeOptions.exhaleMaxDensity - smokeOptions.exhaleBaseDensity);

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
        fs.d[i] *= smokeOptions.densityDecay;
        if (fs.d[i] < 0.001) fs.d[i] = 0;
    }

    // Render
    clearBuffer();

    const w = canvas.width;
    const h = canvas.height;
    const data = fdBuffer.data;

    if (smokeOptions.drawVelocityField) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgb(192, 0, 0)';
        ctx.beginPath();
    }

    for (let i = 1; i <= NUM_OF_CELLS; i++) {
        const dx = (i - 0.5) * cellSizeX;
        for (let j = 1; j <= NUM_OF_CELLS; j++) {
            const dy = (j - 0.5) * cellSizeY;
            const cellIndex = i + (NUM_OF_CELLS + 2) * j;

            if (smokeOptions.drawDensityField) {
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

            if (smokeOptions.drawVelocityField && (i % 2) === 0 && (j % 2) === 0) {
                const u = fs.u[cellIndex] * 150;
                const v = fs.v[cellIndex] * 150;
                ctx.moveTo(dx, dy);
                ctx.lineTo(dx + u, dy + v);
            }
        }
    }

    ctx.putImageData(fdBuffer, 0, 0);

    if (smokeOptions.drawVelocityField) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
        ctx.beginPath();
        for (let i = 2; i <= NUM_OF_CELLS; i += 2) {
            const dx = (i - 0.5) * cellSizeX;
            for (let j = 2; j <= NUM_OF_CELLS; j += 2) {
                const dy = (j - 0.5) * cellSizeY;
                const cellIndex = i + (NUM_OF_CELLS + 2) * j;
                const u = fs.u[cellIndex] * 500;
                const v = fs.v[cellIndex] * 500;
                ctx.moveTo(dx, dy);
                ctx.lineTo(dx + u, dy + v);
            }
        }
        ctx.stroke();
    }

    // Particles
    if (smokeOptions.drawParticles) {
        // Spawn particles during exhale
        if (state === STATE_EXHALING && exhaleFramesRemaining > 0) {
            const tip = cig.getTipPosition();
            for (let k = 0; k < 3; k++) {
                const p = new Particle(
                    tip.x + (Math.random() - 0.5) * cellSizeX * 4,
                    tip.y + (Math.random() - 0.5) * cellSizeY * 2
                );
                p.vy = -2;
                particles.push(p);
            }
        }

        ctx.lineWidth = 2;
        ctx.beginPath();
        let lastAlpha = 0;
        let len = particles.length;
        for (let k = 0; k < len; k++) {
            const p = particles[k];
            p.age += deltaTime;
            const alpha = 1 - (p.age / Particle.TIME_TO_LIVE);
            if (alpha < 0.01 || p.age >= Particle.TIME_TO_LIVE ||
                p.x <= 0 || p.x >= w || p.y <= 0 || p.y >= h) {
                p.dead = true;
            } else {
                const gi = Math.floor((p.x / w) * NUM_OF_CELLS) + 2;
                const gj = Math.floor((p.y / h) * NUM_OF_CELLS) + 2;
                const ci = fs.I(gi, gj);
                p.vx = fs.u[ci] * 50;
                p.vy = fs.v[ci] * 50;
                p.x += p.vx;
                p.y += p.vy;

                if (Math.abs(alpha - lastAlpha) > 0.01) {
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                    lastAlpha = alpha;
                }
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + p.vx, p.y + p.vy);
            }
            if (p.dead) {
                particles.splice(k, 1);
                len--;
                k--;
            }
        }
        ctx.stroke();
    }

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

// GUI
const gui = new GUI({ width: 260, autoPlace: false });

const physicsFolder = gui.addFolder('Physics');
physicsFolder.add(fs, 'dt', 0.05, 0.5, 0.01).name('Time Step');
physicsFolder.add(fs, 'diffusion', 0, 0.001, 0.0001).name('Diffusion');
physicsFolder.add(fs, 'viscosity', { None: 0, 'Very Low': 1/100000, Low: 1/5000, High: 1/1000 }).name('Viscosity');
physicsFolder.add(fs, 'iterations', 5, 40, 1).name('Solver Iterations');
physicsFolder.add(fs, 'doVorticityConfinement').name('Vorticity');
physicsFolder.add(fs, 'doBuoyancy').name('Buoyancy');
physicsFolder.close();

const smokeFolder = gui.addFolder('Smoke');
smokeFolder.add(smokeOptions, 'densityDecay', 0.98, 1.0, 0.001).name('Persistence');
smokeFolder.add(smokeOptions, 'exhaleBaseDensity', 10, 150, 5).name('Min Density');
smokeFolder.add(smokeOptions, 'exhaleMaxDensity', 50, 255, 5).name('Max Density');
smokeFolder.add(smokeOptions, 'exhaleVelocity', -8, -0.5, 0.1).name('Rise Speed');
smokeFolder.add(smokeOptions, 'idleSmokeDensity', 0, 20, 1).name('Idle Wisp');
smokeFolder.add(smokeOptions, 'smokeBlur', 0, 3, 0.5).name('Blur').onChange((v) => {
    canvas.style.filter = v > 0 ? `blur(${v}px)` : 'none';
});
smokeFolder.close();

const viewFolder = gui.addFolder('View');
viewFolder.add(smokeOptions, 'drawDensityField').name('Density Field');
viewFolder.add(smokeOptions, 'drawVelocityField').name('Velocity Field');
viewFolder.add(smokeOptions, 'drawParticles').name('Particle Effect').onChange(() => {
    particles.length = 0;
});
viewFolder.close();

const resetFolder = gui.addFolder('Reset');
resetFolder.add(fs, 'resetDensity').name('Clear Smoke');
resetFolder.add(fs, 'resetVelocity').name('Reset Velocity');
resetFolder.close();

document.getElementById('gui-container').appendChild(gui.domElement);

// Init
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
fs.resetVelocity();
animFrameId = requestAnimationFrame(update);
