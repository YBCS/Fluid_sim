export class Cigarette {
    constructor(canvasWidth, canvasHeight) {
        this.maxPuffs = 40;
        this.puffCount = 0;
        this.glowIntensity = 0;
        this.isDone = false;

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

        // Filter (bottom section)
        const filterTop = this.bottomY - this.filterLength;
        const filterGrad = ctx.createLinearGradient(x, this.bottomY, x + this.cigaretteWidth, this.bottomY);
        filterGrad.addColorStop(0, '#B8943F');
        filterGrad.addColorStop(0.3, '#D4B070');
        filterGrad.addColorStop(0.7, '#C9A855');
        filterGrad.addColorStop(1, '#A8842F');
        ctx.fillStyle = filterGrad;
        ctx.fillRect(x, filterTop, this.cigaretteWidth, this.filterLength);

        // Filter lines (horizontal bands)
        ctx.strokeStyle = 'rgba(160, 120, 40, 0.3)';
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
        paperGrad.addColorStop(0, '#E8E8E8');
        paperGrad.addColorStop(0.5, '#F5F5F5');
        paperGrad.addColorStop(1, '#E0E0E0');
        ctx.fillStyle = paperGrad;
        ctx.fillRect(x, paperTop, this.cigaretteWidth, paperLength);

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
