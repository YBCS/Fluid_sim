const DESIGNS = [
    {
        name: 'Classic',
        filter: ['#B8943F', '#D4B070', '#C9A855', '#A8842F'],
        filterLine: 'rgba(160, 120, 40, 0.3)',
        paper: ['#E8E8E8', '#F5F5F5', '#E0E0E0'],
        band: null,
    },
    {
        name: 'Menthol',
        filter: ['#2E7D4F', '#3A9963', '#2E7D4F', '#1E5C38'],
        filterLine: 'rgba(30, 80, 50, 0.3)',
        paper: ['#E8F0E8', '#F2F8F2', '#E0ECE0'],
        band: { color: '#4CAF50', width: 0.04 },
    },
    {
        name: 'Gold',
        filter: ['#C4A238', '#E0C060', '#D4B44C', '#B0922C'],
        filterLine: 'rgba(180, 150, 40, 0.3)',
        paper: ['#F0EDE0', '#FAF7F0', '#E8E4D8'],
        band: { color: '#DAA520', width: 0.03 },
    },
    {
        name: 'Silver',
        filter: ['#A0A0A0', '#C0C0C0', '#B0B0B0', '#909090'],
        filterLine: 'rgba(120, 120, 120, 0.3)',
        paper: ['#ECECEC', '#F8F8F8', '#E4E4E4'],
        band: { color: '#C0C0C0', width: 0.03 },
    },
    {
        name: 'Red',
        filter: ['#8B2020', '#B03030', '#9C2828', '#7A1818'],
        filterLine: 'rgba(120, 30, 30, 0.3)',
        paper: ['#F0E8E8', '#FAF2F2', '#E8E0E0'],
        band: { color: '#CC3333', width: 0.04 },
    },
    {
        name: 'Black',
        filter: ['#1A1A1A', '#333333', '#282828', '#111111'],
        filterLine: 'rgba(60, 60, 60, 0.3)',
        paper: ['#2A2A2A', '#383838', '#222222'],
        band: { color: '#444444', width: 0.03 },
    },
    {
        name: 'White Filter',
        filter: ['#D8D8D8', '#F0F0F0', '#E4E4E4', '#CCCCCC'],
        filterLine: 'rgba(180, 180, 180, 0.25)',
        paper: ['#EAEAEA', '#F6F6F6', '#E2E2E2'],
        band: null,
    },
    {
        name: 'Vintage',
        filter: ['#A07030', '#C09050', '#B08040', '#906020'],
        filterLine: 'rgba(140, 100, 40, 0.35)',
        paper: ['#F0E8D0', '#FAF2E0', '#E8DFC8'],
        band: { color: '#8B6914', width: 0.05 },
    },
];

export class Cigarette {
    constructor(canvasWidth, canvasHeight) {
        this.maxPuffs = 40;
        this.puffCount = 0;
        this.glowIntensity = 0;
        this.isDone = false;
        this.design = DESIGNS[Math.floor(Math.random() * DESIGNS.length)];

        this.resize(canvasWidth, canvasHeight);
    }

    resize(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        this.cigaretteWidth = Math.max(14, canvasHeight * 0.035);
        this.totalLength = canvasHeight * 0.37;
        this.filterLength = this.totalLength * 0.27;
        this.shortenPerPuff = (this.totalLength - this.filterLength) / this.maxPuffs;
        this.currentLength = this.totalLength - this.puffCount * this.shortenPerPuff;
        this.tipSize = this.cigaretteWidth * 0.9;
        this.ashLength = Math.min(this.shortenPerPuff * 0.3, 6);

        this.centerX = canvasWidth / 2;
        this.bottomY = canvasHeight - canvasHeight * 0.12;
    }

    puff() {
        if (this.isDone) return;
        this.puffCount++;
        this.currentLength = this.totalLength - this.puffCount * this.shortenPerPuff;
        if (this.currentLength <= this.filterLength) {
            this.currentLength = this.filterLength;
            this.isDone = true;
        }
    }

    setGlow(intensity) {
        this.glowIntensity = Math.max(0, Math.min(1, intensity));
    }

    getTipPosition() {
        const paperLength = this.currentLength - this.filterLength;
        const tipY = this.bottomY - this.filterLength - paperLength - this.tipSize;
        return { x: this.centerX, y: tipY };
    }

    draw(ctx) {
        const x = this.centerX - this.cigaretteWidth / 2;
        const paperLength = this.currentLength - this.filterLength;
        const d = this.design;

        // Filter (bottom section)
        const filterTop = this.bottomY - this.filterLength;
        const filterGrad = ctx.createLinearGradient(x, this.bottomY, x + this.cigaretteWidth, this.bottomY);
        filterGrad.addColorStop(0, d.filter[0]);
        filterGrad.addColorStop(0.3, d.filter[1]);
        filterGrad.addColorStop(0.7, d.filter[2]);
        filterGrad.addColorStop(1, d.filter[3]);
        ctx.fillStyle = filterGrad;
        ctx.fillRect(x, filterTop, this.cigaretteWidth, this.filterLength);

        // Filter lines (horizontal bands)
        ctx.strokeStyle = d.filterLine;
        ctx.lineWidth = 0.5;
        const lineSpacing = this.filterLength / 6;
        for (let i = 1; i < 6; i++) {
            const ly = filterTop + i * lineSpacing;
            ctx.beginPath();
            ctx.moveTo(x, ly);
            ctx.lineTo(x + this.cigaretteWidth, ly);
            ctx.stroke();
        }

        // Paper section (above filter)
        const paperTop = filterTop - paperLength;
        const paperGrad = ctx.createLinearGradient(x, paperTop, x + this.cigaretteWidth, paperTop);
        paperGrad.addColorStop(0, d.paper[0]);
        paperGrad.addColorStop(0.5, d.paper[1]);
        paperGrad.addColorStop(1, d.paper[2]);
        ctx.fillStyle = paperGrad;
        ctx.fillRect(x, paperTop, this.cigaretteWidth, paperLength);

        // Brand band (thin colored ring near filter)
        if (d.band) {
            const bandHeight = this.totalLength * d.band.width;
            const bandY = filterTop - bandHeight;
            ctx.fillStyle = d.band.color;
            ctx.fillRect(x, bandY, this.cigaretteWidth, bandHeight);
        }

        // Burning tip (above paper)
        const tipTop = paperTop - this.tipSize;
        const baseR = 140 + this.glowIntensity * 115;
        const baseG = 40 + this.glowIntensity * 80;
        const baseB = 0;
        const tipGrad = ctx.createLinearGradient(0, tipTop, 0, paperTop);
        tipGrad.addColorStop(0, `rgb(${60}, ${60}, ${60})`);
        tipGrad.addColorStop(0.4, `rgb(${baseR | 0}, ${baseG | 0}, ${baseB})`);
        tipGrad.addColorStop(1, `rgb(${80}, ${30}, ${0})`);
        ctx.fillStyle = tipGrad;
        ctx.fillRect(x - 0.5, tipTop, this.cigaretteWidth + 1, this.tipSize);

        // Ash (above tip)
        if (!this.isDone) {
            const ashTop = tipTop - this.ashLength;
            const ashGrad = ctx.createLinearGradient(0, ashTop, 0, tipTop);
            ashGrad.addColorStop(0, '#A0A0A0');
            ashGrad.addColorStop(1, '#686868');
            ctx.fillStyle = ashGrad;
            ctx.fillRect(x - 0.5, ashTop, this.cigaretteWidth + 1, this.ashLength);
        }

        // Glow effect during inhale
        if (this.glowIntensity > 0.15) {
            const glowX = this.centerX;
            const glowY = tipTop + this.tipSize * 0.4;
            const glowRadius = this.cigaretteWidth * (1.5 + this.glowIntensity * 2);
            const saved = ctx.globalCompositeOperation;
            ctx.globalCompositeOperation = 'lighter';
            const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
            glow.addColorStop(0, `rgba(255, 140, 0, ${this.glowIntensity * 0.5})`);
            glow.addColorStop(0.5, `rgba(255, 80, 0, ${this.glowIntensity * 0.25})`);
            glow.addColorStop(1, 'rgba(255, 60, 0, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(glowX - glowRadius, glowY - glowRadius, glowRadius * 2, glowRadius * 2);
            ctx.globalCompositeOperation = saved;
        }
    }
}
