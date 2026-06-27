# Smoking Simulator

Part of a collection of fun projects exploring various software ideas using coding agents. The goal is to have fun and learn interesting things along the way.

A real-time smoking simulator built with HTML5 Canvas and JavaScript. Uses a grid-based Navier-Stokes fluid solver to produce realistic smoke dynamics — buoyancy, vorticity, diffusion, and dissipation — all running in the browser with no dependencies or build step.

**[Play it here](https://ybcs.github.io/Fluid_sim/)**

## How It Works

### Fluid Simulation

The smoke is driven by a 2D incompressible Navier-Stokes solver running on a 96x96 grid. Each frame, the solver performs:

1. **Velocity step** — diffuses and advects the velocity field, then projects it to enforce mass conservation (divergence-free). This projection step is what produces the characteristic swirling vortices in the smoke.
2. **Density step** — diffuses and advects the density (smoke) through the velocity field using a semi-Lagrangian advection scheme (tracing particles backward in time).
3. **Vorticity confinement** — counteracts numerical diffusion by amplifying existing vortices, keeping the smoke wisps sharp and detailed.
4. **Buoyancy** — applies an upward force proportional to density, causing smoke to rise naturally.

The solver uses the Gauss-Seidel iterative method to solve the resulting linear systems (Poisson equations for pressure and diffusion).

### Interaction

- **Tap and hold** anywhere on screen to inhale — the cigarette tip glows brighter
- **Release** to exhale — a burst of smoke density and upward velocity is injected into the fluid grid near the cigarette tip
- Longer holds produce more smoke on exhale (hold duration scales density and injection frames)
- A subtle idle smoke wisp rises from the tip when not puffing
- Each puff shortens the cigarette; after 40 puffs it's done

### Cigarette

The cigarette is drawn with canvas primitives (rectangles and gradients). Eight randomly selected designs vary the filter color, paper tint, and brand band — each new cigarette gets a fresh look.

### Rendering

Smoke density is rendered as white/grayscale pixels to an `ImageData` buffer and blitted to the canvas once per frame. The cigarette is drawn on top. Optional overlays include a velocity field visualization (red lines) and a particle trail effect.

### Controls

A collapsible GUI panel (top-left) exposes real-time tweaking of:

- **Physics** — time step, diffusion, viscosity, solver iterations, vorticity confinement, buoyancy
- **Smoke** — persistence (decay rate), density range, rise speed, idle wisp intensity, blur
- **View** — toggle density field, velocity field, and particle effects
- **Reset** — clear smoke, reset velocity

## Tech Stack

- Vanilla JavaScript (ES modules, no bundler)
- HTML5 Canvas 2D API
- [lil-gui](https://github.com/georgealways/lil-gui) for the control panel (loaded via CDN)

## Running

Open `index.html` in a browser. No install or build step required.

For mobile testing over local network:
```
python3 -m http.server 8080
```
Then open `http://<your-local-ip>:8080` on your phone.

## Credits

### Original Fluid Solver

The fluid solver is adapted from [canvas-fluid-solver](https://github.com/topaz1008/canvas-fluid-solver) by Topaz Bar, a JavaScript implementation of Jos Stam's stable fluids method.

### Research Papers

- **Jos Stam, "Real-Time Fluid Dynamics for Games"** (GDC 2003) — The foundational paper this solver is based on. Describes a stable, unconditionally convergent method for simulating incompressible fluids in real time.
  - [Paper (PDF)](https://www.dgp.toronto.edu/people/stam/reality/Research/pdf/GDC03.pdf)

- **Jos Stam, "Stable Fluids"** (SIGGRAPH 1999) — The original academic paper introducing the semi-Lagrangian advection scheme and implicit diffusion that make the solver unconditionally stable regardless of time step.

- **Navier-Stokes equations** — The governing equations for fluid motion that the solver discretizes and solves.
  - [Wikipedia](https://en.wikipedia.org/wiki/Navier-Stokes_equations)

## License

MIT
