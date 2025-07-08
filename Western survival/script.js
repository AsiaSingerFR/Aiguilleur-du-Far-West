document.addEventListener('DOMContentLoaded', () => {
    // Elements du DOM
    const mainMenu = document.getElementById('main-menu');
    const rulesMenu = document.getElementById('rules-menu');
    const gameOverScreen = document.getElementById('game-over-screen');
    const startGameBtn = document.getElementById('start-game-btn');
    const rulesBtn = document.getElementById('rules-btn');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    const restartBtn = document.getElementById('restart-btn');
    const gameCanvas = document.getElementById('game-canvas');
    const finalScoreEl = document.getElementById('final-score');
    const highScoreEl = document.getElementById('high-score');
    const finalHighScoreEl = document.getElementById('final-high-score');
    const ctx = gameCanvas.getContext('2d');

    // Variables de jeu
    let tracks = [], trains = [], switches = [], destinations = [];
    let score = 0;
    let gameLoopId, trainSpawnerId;
    let isGameOver = false;
    let trainSpawnInterval = 7000;
    const minSpawnInterval = 2000;
    let scoreMilestone = 500;
    let trainSpeed = 1.2;
    let trainSpeedMilestone = 1000;
    let highScore = localStorage.getItem('westernSurvivalHighScore') || 0;
    highScoreEl.textContent = highScore;

    const DESTINATIONS_CONFIG = {
        MINE: { name: 'Mine', color: '#FFD700' },
        VILLE: { name: 'Ville', color: '#4682B4' },
        SCIERIE: { name: 'Scierie', color: '#A0522D' },
        RANCH: { name: 'Ranch', color: '#228B22' },
        DANGER: { name: 'Pont Écroulé', color: '#DC143C' }
    };

    // --- CLASSES ---
    class Train {
        constructor(track, speed, destination) {
            this.track = track;
            this.speed = speed;
            this.destination = destination;
            this.color = destination.color;
            this.distance = 0;
            this.width = 30;
            this.height = 14;
        }
        get x() { const p = this.distance / this.track.length; return this.track.x1 + (this.track.x2 - this.track.x1) * p; }
        get y() { const p = this.distance / this.track.length; return this.track.y1 + (this.track.y2 - this.track.y1) * p; }
        move() { this.distance += this.speed; }
        draw() {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
            ctx.fillStyle = 'white'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
            ctx.fillText(this.destination.name.charAt(0), this.x, this.y + 4);
        }
    }

    class Switch {
        constructor(x, y, outputTracks) {
            this.x = x;
            this.y = y;
            this.outputTracks = outputTracks;
            this.activeIndex = 0;
        }
        get activeTrack() { return this.outputTracks[this.activeIndex]; }
        toggle() { this.activeIndex = (this.activeIndex + 1) % this.outputTracks.length; }
        draw() {
            ctx.fillStyle = this.outputTracks.length > 2 ? '#FF8C00' : 'green';
            ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, 2 * Math.PI); ctx.fill();
            const t = this.activeTrack, dx = t.x2 - t.x1, dy = t.y2 - t.y1, len = Math.sqrt(dx*dx+dy*dy);
            const ix = this.x + (dx / len) * 15, iy = this.y + (dy / len) * 15;
            ctx.strokeStyle = '#003300'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ix, iy); ctx.stroke();
        }
    }

    class Destination {
        constructor(x, y, config) { this.x = x; this.y = y; this.name = config.name; this.color = config.color; }
        draw() {
            ctx.fillStyle = this.color; ctx.fillRect(this.x - 25, this.y - 15, 50, 30);
            ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x, this.y + 5);
        }
    }

    // --- GESTION DES MENUS ---
    // Au démarrage, masquer le canvas et afficher le menu principal
    gameCanvas.style.display = 'none';
    mainMenu.classList.remove('hidden');
    rulesMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    startGameBtn.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        gameCanvas.style.display = 'block'; // Rendre le canvas visible
        initGame();
    });

    rulesBtn.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        rulesMenu.classList.remove('hidden');
    });

    backToMenuBtn.addEventListener('click', () => {
        rulesMenu.classList.add('hidden');
        mainMenu.classList.remove('hidden');
    });

    restartBtn.addEventListener('click', () => {
        gameOverScreen.classList.add('hidden');
        mainMenu.classList.remove('hidden');
        highScoreEl.textContent = highScore;
    });

    gameCanvas.addEventListener('click', (e) => { if(isGameOver)return; const r=gameCanvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top; switches.forEach(s=>{if(Math.sqrt(Math.pow(s.x-x,2)+Math.pow(s.y-y,2))<10)s.toggle()}); });

    // --- LOGIQUE DU JEU ---
    function initGame() {
        isGameOver = false;
        score = 0;
        trainSpawnInterval = 7000;
        scoreMilestone = 500;
        trainSpeed = 1.2;
        trainSpeedMilestone = 1000;
        tracks = []; trains = []; switches = []; destinations = [];
        gameCanvas.width = 800; gameCanvas.height = 600;
        // Test de dessin: un grand rectangle rouge
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 800, 600);
        
        createWorld();
        spawnTrain();
        function spawner() {
            if(isGameOver) return;
            spawnTrain();
            trainSpawnerId = setTimeout(spawner, trainSpawnInterval);
        }
        trainSpawnerId = setTimeout(spawner, trainSpawnInterval);
        gameLoop();
    }

    function createWorld() {
        const trackDefs=[
            {id:1,x1:50,y1:150,x2:200,y2:150},{id:2,x1:50,y1:450,x2:200,y2:450},{id:3,x1:200,y1:150,x2:300,y2:300},{id:4,x1:200,y1:450,x2:300,y2:300},{id:5,x1:300,y1:300,x2:500,y2:300},{id:6,x1:500,y1:300,x2:650,y2:150},{id:7,x1:500,y1:300,x2:650,y2:450},{id:8,x1:650,y1:150,x2:750,y2:150},{id:9,x1:650,y1:150,x2:650,y2:50},{id:10,x1:650,y1:150,x2:750,y2:50},{id:11,x1:650,y1:450,x2:750,y2:450},{id:12,x1:650,y1:450,x2:750,y2:550}
        ];
        trackDefs.forEach(t=>{t.length=Math.sqrt(Math.pow(t.x2-t.x1,2)+Math.pow(t.y2-t.y1,2));tracks.push(t)});
        switches.push(new Switch(500,300,[tracks[5],tracks[6]]));
        switches.push(new Switch(650,150,[tracks[7],tracks[8],tracks[9]]));
        switches.push(new Switch(650,450,[tracks[10],tracks[11]]));
        destinations.push(new Destination(750,150,DESTINATIONS_CONFIG.MINE));
        destinations.push(new Destination(650,50,DESTINATIONS_CONFIG.DANGER));
        destinations.push(new Destination(750,50,DESTINATIONS_CONFIG.RANCH));
        destinations.push(new Destination(750,450,DESTINATIONS_CONFIG.VILLE));
        destinations.push(new Destination(750,550,DESTINATIONS_CONFIG.SCIERIE));
    }

    function spawnTrain() {
        const startTrack = trains.length % 2 === 0 ? tracks[0] : tracks[1];
        const availableDests = [DESTINATIONS_CONFIG.MINE, DESTINATIONS_CONFIG.VILLE, DESTINATIONS_CONFIG.SCIERIE, DESTINATIONS_CONFIG.RANCH];
        const randomDest = availableDests[Math.floor(Math.random() * availableDests.length)];
        trains.push(new Train(startTrack, trainSpeed, randomDest));
    }

    function updateScore(points) {
        score += points;
        if (score >= scoreMilestone) {
            if (trainSpawnInterval > minSpawnInterval) {
                trainSpawnInterval -= 200;
            }
            scoreMilestone += 500;
        }
        if (score >= trainSpeedMilestone) {
            trainSpeed += 0.1;
            trains.forEach(train => train.speed = trainSpeed);
            trainSpeedMilestone += 1000;
        }
    }

    function update() {
        for (let i = trains.length - 1; i >= 0; i--) {
            const train = trains[i];
            train.move();
            if (train.distance >= train.track.length) {
                const endX = train.track.x2, endY = train.track.y2;
                let trainAtDestination = false;
                for (const dest of destinations) {
                    if (dest.x === endX && dest.y === endY) {
                        if (dest.name === train.destination.name) {
                            updateScore(100);
                        } else {
                            gameOver();
                            return;
                        }
                        trains.splice(i, 1);
                        trainAtDestination = true;
                        break;
                    }
                }
                if (!trainAtDestination) {
                    let nextTrack=null;const s=switches.find(sw=>sw.x===endX&&sw.y===endY);if(s){nextTrack=s.activeTrack}else{nextTrack=tracks.find(t=>t.x1===endX&&t.y1===endY)}if(nextTrack){train.track=nextTrack;train.distance=0}else{trains.splice(i,1)}
                }
            }
        }
    }

    function draw() {
        ctx.clearRect(0,0,gameCanvas.width,gameCanvas.height);
        destinations.forEach(d=>d.draw());
        drawTracks();
        switches.forEach(s=>s.draw());
        trains.forEach(t=>t.draw());
        ctx.fillStyle='black';ctx.font="20px 'Courier New', Courier, monospace";ctx.textAlign='left';ctx.fillText(`Score: ${score}`,10,25);
    }

    function drawTracks() {
        ctx.strokeStyle='#8B4513';ctx.lineWidth=5;tracks.forEach(t=>{ctx.globalAlpha=1;const s=switches.find(sw=>sw.outputTracks.includes(t));if(s&&s.activeTrack!==t){ctx.globalAlpha=0.3}ctx.beginPath();ctx.moveTo(t.x1,t.y1);ctx.lineTo(t.x2,t.y2);ctx.stroke()});ctx.globalAlpha=1;
    }

    function gameOver() {
        isGameOver = true;
        cancelAnimationFrame(gameLoopId);
        clearTimeout(trainSpawnerId);
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('westernSurvivalHighScore', highScore);
        }
        finalScoreEl.textContent = score;
        finalHighScoreEl.textContent = highScore;
        gameCanvas.classList.add('hidden');
        gameOverScreen.classList.remove('hidden');
    }

    function gameLoop() {
        if (isGameOver) return;
        update();
        draw();
        gameLoopId = requestAnimationFrame(gameLoop);
    }
});