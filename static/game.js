/* ============================================================
   Underhill Circle Challenge – Enhanced Game Logic v2
   ============================================================
   Canvas fills the entire game screen absolutely, so internal
   canvas pixels == CSS pixels == screen pixels. No scaling needed.
   ============================================================ */

'use strict';

// ── State ─────────────────────────────────────────────────────
let isDrawing        = false;
let points           = [];
let currentScore     = 0;
let currentBreakdown = null;
let currentScoreId   = null;
let topScore         = 0;
let canvas, ctx;

// ── Init ──────────────────────────────────────────────────────
window.addEventListener('load', () => {
    canvas = document.getElementById('drawingCanvas');
    ctx    = canvas.getContext('2d');
    loadTopScore();
    loadPreviewLeaderboard();
    setupEventListeners();
});

/** Call every time the game screen becomes visible so canvas
 *  resolution matches its actual rendered pixel size exactly. */
function initCanvas() {
    const rect    = canvas.getBoundingClientRect();
    canvas.width  = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
    clearCanvas();
}

// ── Canvas Helpers ────────────────────────────────────────────

function clearCanvas() {
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    points = [];
    const errEl   = document.getElementById('errorMessage');
    const scoreEl = document.getElementById('scoreDisplay');
    if (errEl)   errEl.textContent   = '';
    if (scoreEl) scoreEl.textContent = '';
}

function redrawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (points.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth   = 5;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();
        ctx.restore();
    }
}

function drawResultOverlay(bd) {
    const { fit } = bd;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth   = 5;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();
        ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(fit.cx, fit.cy, fit.r, 0, Math.PI * 2);
    ctx.strokeStyle = '#00c853';
    ctx.lineWidth   = 3;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#00c853';
    ctx.lineWidth   = 2;
    const cs = 12;
    ctx.beginPath();
    ctx.moveTo(fit.cx - cs, fit.cy); ctx.lineTo(fit.cx + cs, fit.cy);
    ctx.moveTo(fit.cx, fit.cy - cs); ctx.lineTo(fit.cx, fit.cy + cs);
    ctx.stroke();
    ctx.restore();

    if (points.length > 1) {
        const f = points[0], l = points[points.length - 1];
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(l.x, l.y);
        ctx.strokeStyle = '#ff6d00';
        ctx.lineWidth   = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
}

// ── Taubin Algebraic Circle Fit ───────────────────────────────
function fitCircle(pts) {
    const n = pts.length;
    if (n < 5) return null;

    let mx = 0, my = 0;
    pts.forEach(p => { mx += p.x; my += p.y; });
    mx /= n; my /= n;

    let Suu = 0, Suv = 0, Svv = 0,
        Suuu = 0, Suuv = 0, Suvv = 0, Svvv = 0;

    pts.forEach(p => {
        const u = p.x - mx, v = p.y - my;
        Suu  += u*u;   Suv  += u*v;   Svv  += v*v;
        Suuu += u*u*u; Suuv += u*u*v;
        Suvv += u*v*v; Svvv += v*v*v;
    });
    Suu /= n; Suv /= n; Svv /= n;
    Suuu /= n; Suuv /= n; Suvv /= n; Svvv /= n;

    const b1  = 0.5 * (Suuu + Suvv);
    const b2  = 0.5 * (Suuv + Svvv);
    const det = Suu * Svv - Suv * Suv;
    if (Math.abs(det) < 1e-10) return null;

    const uc = (b1 * Svv - b2 * Suv) / det;
    const vc = (b2 * Suu - b1 * Suv) / det;

    return {
        cx: uc + mx,
        cy: vc + my,
        r:  Math.sqrt(uc*uc + vc*vc + Suu + Svv)
    };
}

function angleCoverage(pts, cx, cy) {
    const angles = pts
        .map(p => Math.atan2(p.y - cy, p.x - cx))
        .sort((a, b) => a - b);
    if (angles.length < 2) return 0;
    let maxGap = (angles[0] + 2 * Math.PI) - angles[angles.length - 1];
    for (let i = 1; i < angles.length; i++) {
        maxGap = Math.max(maxGap, angles[i] - angles[i - 1]);
    }
    return Math.min(1, Math.max(0, (2 * Math.PI - maxGap) / (2 * Math.PI)));
}

function calculateBreakdown(pts) {
    const fit = fitCircle(pts);
    if (!fit) return null;
    const { cx, cy, r } = fit;

    let sumDev = 0;
    pts.forEach(p => {
        const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
        sumDev += Math.abs(d - r);
    });
    const roundness = Math.max(0, Math.min(100, 100 * (1 - (sumDev / pts.length / r) * 3.5)));
    const cov       = angleCoverage(pts, cx, cy);
    const coverage  = Math.min(100, Math.round(cov * 106));
    const f = pts[0], l = pts[pts.length - 1];
    const gap     = Math.sqrt((l.x - f.x) ** 2 + (l.y - f.y) ** 2);
    const closure = Math.max(0, Math.min(100, 100 * (1 - gap / (r * 0.5))));
    const total   = roundness * 0.65 + Math.min(100, coverage) * 0.20 + closure * 0.15;

    return {
        roundness: Math.round(roundness),
        coverage:  Math.round(Math.min(100, coverage)),
        closure:   Math.round(closure),
        total:     Math.min(100, Math.max(0, total)),
        fit
    };
}

// ── Drawing Events ────────────────────────────────────────────

/** Convert mouse or touch event → canvas coordinates (1:1, no scaling). */
function getPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = (e.clientX !== undefined) ? e : (e.touches ? e.touches[0] : e);
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
}

function startDrawing(e) {
    isDrawing = true;
    points    = [];
    document.getElementById('errorMessage').textContent   = '';
    document.getElementById('scoreDisplay').textContent   = '';
    points.push(getPoint(e));
    redrawFrame();
}

function draw(e) {
    if (!isDrawing) return;
    points.push(getPoint(e));
    redrawFrame();
    if (points.length % 15 === 0 && points.length >= 30) {
        const bd = calculateBreakdown(points);
        if (bd) document.getElementById('scoreDisplay').textContent = bd.total.toFixed(1) + '%';
    }
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    if (points.length < 15) {
        showError('Keep drawing – lift when the circle is closed!');
        return;
    }
    validateAndScore();
}

// ── Validation & Scoring ──────────────────────────────────────
function validateAndScore() {
    const f   = points[0], l = points[points.length - 1];
    const gap = Math.sqrt((l.x - f.x) ** 2 + (l.y - f.y) ** 2);
    if (gap > 80) {
        showError('Please close the circle – bring your line back to where you started!');
        return;
    }
    const bd = calculateBreakdown(points);
    if (!bd) {
        showError('Could not analyse that shape – try drawing a bigger circle.');
        return;
    }
    if (bd.coverage < 60) {
        showError('Draw a complete circle, not just an arc!');
        return;
    }
    if (bd.roundness < 15) {
        showError('That shape is too irregular – try again with a smooth, steady hand!');
        return;
    }
    if (bd.fit.r < 50) {
        showError('Your circle is too small – try drawing a bigger one!');
        return;
    }

    currentBreakdown = bd;
    currentScore     = bd.total;
    drawResultOverlay(bd);
    document.getElementById('scoreDisplay').textContent = currentScore.toFixed(2) + '%';

    setTimeout(() => {
        showBreakdown(bd);
        document.getElementById('finalScore').textContent = 'Your Score: ' + currentScore.toFixed(2) + '%';
        showScreen('formScreen');
        if (currentScore >= 95) launchConfetti();
    }, 1300);
}

// ── Score Breakdown Panel ─────────────────────────────────────
function showBreakdown(bd) {
    const el = document.getElementById('breakdownPanel');
    if (!el) return;
    const metrics = [
        { label: 'Roundness', value: bd.roundness, color: '#00c853', tip: 'How closely your path follows a perfect circle' },
        { label: 'Coverage',  value: bd.coverage,  color: '#2979ff', tip: 'How much of 360° was drawn' },
        { label: 'Closure',   value: bd.closure,   color: '#ff6d00', tip: 'How well the start and end points meet' }
    ];
    el.innerHTML = '<p class="breakdown-title">Score Breakdown</p>' +
        metrics.map(m => `
            <div class="metric-row" title="${m.tip}">
                <span class="metric-label">${m.label}</span>
                <div class="metric-bar-track">
                    <div class="metric-bar-fill" style="width:0%;background:${m.color}" data-target="${m.value}"></div>
                </div>
                <span class="metric-value">${m.value}%</span>
            </div>
        `).join('');
    requestAnimationFrame(() => {
        setTimeout(() => {
            el.querySelectorAll('.metric-bar-fill').forEach(bar => {
                bar.style.width = bar.dataset.target + '%';
            });
        }, 80);
    });
}

// ── Confetti ──────────────────────────────────────────────────
function launchConfetti() {
    const colors    = ['#FEED01','#d32f2f','#00c853','#2979ff','#ff6d00','#fff','#111'];
    const container = document.getElementById('confettiContainer');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 130; i++) {
        const el     = document.createElement('div');
        el.className = 'confetti-piece';
        const isCircle = Math.random() > 0.45;
        const size     = 5 + Math.random() * 9;
        el.style.cssText = [
            `left:${Math.random() * 100}%`,
            `animation-delay:${Math.random() * 1.8}s`,
            `animation-duration:${2.2 + Math.random() * 2}s`,
            `background:${colors[Math.floor(Math.random() * colors.length)]}`,
            `width:${size}px`,
            `height:${isCircle ? size : size * 0.4}px`,
            `border-radius:${isCircle ? '50%' : '2px'}`,
            `transform:rotate(${Math.random() * 360}deg)`
        ].join(';');
        container.appendChild(el);
    }
    setTimeout(() => { container.innerHTML = ''; }, 5500);
}

// ── Utilities ─────────────────────────────────────────────────
function showError(msg) {
    document.getElementById('errorMessage').textContent = msg;
    setTimeout(clearCanvas, 2600);
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ── API / Leaderboard ─────────────────────────────────────────
async function loadTopScore() {
    try {
        const data = await (await fetch('/leaderboard')).json();
        const el   = document.getElementById('topScoreDisplay');
        if (data.scores && data.scores.length > 0) {
            topScore = data.scores[0].score;
            el.textContent = 'Top Score: ' + topScore.toFixed(2) + '%';
        } else {
            el.textContent = 'Top Score: --';
        }
    } catch { document.getElementById('topScoreDisplay').textContent = 'Top Score: --'; }
}

async function loadPreviewLeaderboard() {
    const tbody = document.getElementById('previewLeaderboardBody');
    try {
        const data = await (await fetch('/leaderboard')).json();
        tbody.innerHTML = '';
        if (data.scores && data.scores.length > 0) {
            data.scores.forEach((s, i) => {
                const row = tbody.insertRow();
                if (i === 0) row.classList.add('rank-first');
                row.insertCell(0).textContent = i + 1;
                row.insertCell(1).textContent = s.name;
                row.insertCell(2).textContent = s.class;
                row.insertCell(3).textContent = s.score.toFixed(2) + '%';
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">No scores yet – be the first!</td></tr>';
        }
    } catch {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">Could not load scores.</td></tr>';
    }
}

async function submitScore(e) {
    e.preventDefault();
    const name   = document.getElementById('nameInput').value.trim();
    const sClass = document.getElementById('classInput').value.trim();
    if (!name || !sClass) { alert('Please fill in all fields'); return; }
    try {
        const data = await (await fetch('/submit_score', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, class: sClass, score: currentScore })
        })).json();
        if (data.success) { currentScoreId = data.id; loadLeaderboard(); }
    } catch { alert('Error submitting score. Please try again.'); }
}

async function loadLeaderboard() {
    try {
        const data = await (await fetch('/leaderboard')).json();
        document.getElementById('totalParticipants').textContent = 'Total Participants: ' + data.total;
        const tbody = document.getElementById('leaderboardBody');
        tbody.innerHTML = '';
        data.scores.forEach((s, i) => {
            const row = tbody.insertRow();
            if (s.id === currentScoreId) row.classList.add('current-player');
            if (i === 0) row.classList.add('rank-first');
            row.insertCell(0).textContent = i + 1;
            row.insertCell(1).textContent = s.name;
            row.insertCell(2).textContent = s.class;
            row.insertCell(3).textContent = s.score.toFixed(2) + '%';
        });
        showScreen('leaderboardScreen');
        loadTopScore();
    } catch { console.error('Error loading leaderboard'); }
}

// ── Event Listeners ───────────────────────────────────────────
function setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', () => {
        showScreen('gameScreen');
        // Canvas is now visible — set its resolution to match rendered size
        initCanvas();
    });

    document.getElementById('backToStartBtn').addEventListener('click', () => {
        showScreen('instructionScreen');
        loadPreviewLeaderboard();
    });

    canvas.addEventListener('mousedown',  startDrawing);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        startDrawing(e.touches[0]);
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        draw(e.touches[0]);
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        e.preventDefault();
        stopDrawing();
    }, { passive: false });

    document.getElementById('scoreForm').addEventListener('submit', submitScore);

    document.getElementById('tryAgainBtn').addEventListener('click', () => {
        showScreen('gameScreen');
        initCanvas();
        document.getElementById('nameInput').value  = '';
        document.getElementById('classInput').value = '';
        currentScoreId = null;
    });
}
