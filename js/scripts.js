
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = {
  coins: 100,
  health: 20,
  wave: 1,
  enemiesLeft: 0,
  towers: [],
  enemies: [],
  bullets: [],
  waveActive: false,
  placingTower: false,
  enemiesSpawned: 0,
  enemiesPerWave: 5,
  mouseX: 0,
  mouseY: 0,
  selectedTower: null,
  enemiesKilled: 0,
  totalEnemiesKilled: 0,
  livesLostThisWave: 0,
  totalLivesLost: 0,
  coinsEarnedThisWave: 0,
  totalCoinsEarned: 0,
  gameStarted: false,
  gameOver: false
};

const config = {
  towerCost: 50,
  upgradeCost: 75,
  sellValue: 30,
  coinReward: 15,
  towerDamage: 25,
  towerRange: 80,
  bulletSpeed: 5,
  spawnDelay: 1000
};

const path = [
  { x: 0, y: 250 },
  { x: 200, y: 250 },
  { x: 200, y: 150 },
  { x: 400, y: 150 },
  { x: 400, y: 350 },
  { x: 600, y: 350 },
  { x: 600, y: 250 },
  { x: 800, y: 250 }
];

class Enemy {
  constructor() {
    this.x = path[0].x;
    this.y = path[0].y;
    this.pathIndex = 0;
    this.health = 50 + (gameState.wave - 1) * 25;
    this.maxHealth = this.health;
    this.speed = 1 + (gameState.wave - 1) * 0.3;
    this.radius = 15;
    this.color = '#ff4444';
  }

  update() {
    if (this.pathIndex < path.length - 1) {
      const target = path[this.pathIndex + 1];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) {
        this.pathIndex++;
      } else {
        this.x += (dx / distance) * this.speed;
        this.y += (dy / distance) * this.speed;
      }
    } else {
      gameState.health--;
      gameState.livesLostThisWave++;
      gameState.totalLivesLost++;
      this.remove();
    }
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    const barWidth = 30;
    const barHeight = 4;
    const healthPercent = this.health / this.maxHealth;

    ctx.fillStyle = '#ff0000';
    ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 10, barWidth, barHeight);

    ctx.fillStyle = '#00ff00';
    ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 10, barWidth * healthPercent, barHeight);
  }

  takeDamage(damage) {
    this.health -= damage;
    if (this.health <= 0) {
      gameState.coins += config.coinReward;
      gameState.enemiesKilled++;
      gameState.totalEnemiesKilled++;
      gameState.coinsEarnedThisWave += config.coinReward;
      gameState.totalCoinsEarned += config.coinReward;
      this.remove();
    }
  }

  remove() {
    const index = gameState.enemies.indexOf(this);
    if (index > -1) {
      gameState.enemies.splice(index, 1);
      gameState.enemiesLeft--;
    }
  }
}

class Tower {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.level = 1;
    this.range = config.towerRange;
    this.damage = config.towerDamage;
    this.cooldown = 0;
    this.maxCooldown = 30;
    this.target = null;
    this.selected = false;
  }

  upgrade() {
    if (this.level < 3) {
      this.level++;
      this.range += 20;
      this.damage += 15;
      this.maxCooldown = Math.max(10, this.maxCooldown - 5);
    }
  }

  getUpgradeCost() {
    return config.upgradeCost * this.level;
  }

  getSellValue() {
    return config.sellValue + (this.level - 1) * 25;
  }

  update() {
    if (this.cooldown > 0) this.cooldown--;

    this.target = null;
    let closestDistance = this.range;

    for (let enemy of gameState.enemies) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < closestDistance) {
        this.target = enemy;
        closestDistance = distance;
      }
    }

    if (this.target && this.cooldown === 0) {
      this.shoot();
      this.cooldown = this.maxCooldown;
    }
  }

  shoot() {
    const bullet = new Bullet(this.x, this.y, this.target, this.damage);
    gameState.bullets.push(bullet);
  }

  draw() {
    const baseColors = ['#8B4513', '#CD853F', '#DAA520'];
    const towerColors = ['#A0522D', '#D2B48C', '#FFD700'];

    ctx.fillStyle = baseColors[this.level - 1];
    const baseSize = 15 + this.level * 2;
    ctx.fillRect(this.x - baseSize, this.y - baseSize, baseSize * 2, baseSize * 2);

    ctx.fillStyle = towerColors[this.level - 1];
    const towerSize = 10 + this.level * 2;
    ctx.fillRect(this.x - towerSize, this.y - 20 - this.level, towerSize * 2, 10 + this.level);

    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const angle = Math.atan2(dy, dx);

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);

      ctx.fillStyle = '#2F4F4F';
      ctx.fillRect(0, -3, 25 + this.level * 3, 6);

      ctx.restore();
    }

    if (this.selected) {
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
      ctx.stroke();

      this.drawActionButtons();
    }

    if (this.level > 1) {
      ctx.fillStyle = '#FFD700';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('★'.repeat(this.level - 1), this.x, this.y - baseSize - 5);
    }
  }

  drawActionButtons() {
    if (this.level < 3) {
      ctx.fillStyle = gameState.coins >= this.getUpgradeCost() ? '#4CAF50' : '#666';
      ctx.fillRect(this.x - 30, this.y + 30, 25, 15);
      ctx.fillStyle = 'white';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('UP', this.x - 17.5, this.y + 41);
    }

    ctx.fillStyle = '#f44336';
    ctx.fillRect(this.x + 5, this.y + 30, 25, 15);
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SELL', this.x + 17.5, this.y + 41);
  }

  isPointInside(x, y) {
    const size = 15 + this.level * 2;
    return x >= this.x - size && x <= this.x + size &&
      y >= this.y - size && y <= this.y + size;
  }

  isPointInUpgradeButton(x, y) {
    return this.level < 3 && x >= this.x - 30 && x <= this.x - 5 &&
      y >= this.y + 30 && y <= this.y + 45;
  }

  isPointInSellButton(x, y) {
    return x >= this.x + 5 && x <= this.x + 30 &&
      y >= this.y + 30 && y <= this.y + 45;
  }
}

class Bullet {
  constructor(x, y, target, damage) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.speed = config.bulletSpeed;
    this.radius = 3;
  }

  update() {
    if (!this.target || gameState.enemies.indexOf(this.target) === -1) {
      this.remove();
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 10) {
      this.target.takeDamage(this.damage);
      this.remove();
    } else {
      this.x += (dx / distance) * this.speed;
      this.y += (dy / distance) * this.speed;
    }
  }

  draw() {
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  remove() {
    const index = gameState.bullets.indexOf(this);
    if (index > -1) {
      gameState.bullets.splice(index, 1);
    }
  }
}

function isValidTowerPosition(x, y) {
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];

    const segmentLength = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    const t = Math.max(0, Math.min(1, ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / (segmentLength ** 2)));
    const projection = {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    };
    const distance = Math.sqrt((x - projection.x) ** 2 + (y - projection.y) ** 2);

    if (distance < 35) {
      return false;
    }
  }

  for (let tower of gameState.towers) {
    const dx = tower.x - x;
    const dy = tower.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 45) {
      return false;
    }
  }

  if (x < 20 || x > canvas.width - 20 || y < 20 || y > canvas.height - 20) {
    return false;
  }

  return true;
}

function drawPlacementPreview() {
  if (gameState.placingTower) {
    const isValid = isValidTowerPosition(gameState.mouseX, gameState.mouseY);

    ctx.fillStyle = isValid ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(gameState.mouseX, gameState.mouseY, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isValid ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(gameState.mouseX, gameState.mouseY, config.towerRange, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = isValid ? '#8B4513' : '#8B4513';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(gameState.mouseX - 15, gameState.mouseY - 15, 30, 30);
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(gameState.mouseX - 10, gameState.mouseY - 20, 20, 10);
    ctx.globalAlpha = 1.0;
  }
}

function drawPath() {
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();

  ctx.fillStyle = '#00ff00';
  ctx.fillRect(0, 235, 20, 30);
  ctx.fillText('INÍCIO', 5, 280);

  ctx.fillStyle = '#ff0000';
  ctx.fillRect(780, 235, 20, 30);
  ctx.fillText('BASE', 785, 280);
}

function spawnEnemy() {
  if (gameState.enemiesSpawned < gameState.enemiesPerWave) {
    const enemy = new Enemy();
    gameState.enemies.push(enemy);
    gameState.enemiesSpawned++;
    gameState.enemiesLeft++;

    setTimeout(() => {
      if (gameState.waveActive && gameState.enemiesSpawned < gameState.enemiesPerWave) {
        spawnEnemy();
      }
    }, config.spawnDelay - (gameState.wave - 1) * 100);
  }
}

function updateGame() {
  if (gameState.gameOver) return;

  gameState.enemies.forEach(enemy => enemy.update());
  gameState.towers.forEach(tower => tower.update());
  gameState.bullets.forEach(bullet => bullet.update());

  if (gameState.waveActive && gameState.enemies.length === 0 && gameState.enemiesSpawned >= gameState.enemiesPerWave) {
    gameState.waveActive = false;
    gameState.wave++;
    gameState.enemiesPerWave += 2;
    gameState.enemiesSpawned = 0;

    gameState.enemiesKilled = 0;
    gameState.livesLostThisWave = 0;
    gameState.coinsEarnedThisWave = 0;

    updateUI();
    document.getElementById('waveStatus').textContent = `Wave ${gameState.wave - 1} completed! Get ready for the next one.`;
  }

  if (gameState.health <= 0 && !gameState.gameOver) {
    showGameOver();
  }
}

function showGameOver() {
  gameState.gameOver = true;
  gameState.waveActive = false;

  document.getElementById('gameOverStats').textContent = `You survived until the Wave ${gameState.wave}!`;
  document.getElementById('finalStats').innerHTML = `
                <strong>Final Statistics:</strong><br>
                👾 Enemies eliminated: ${gameState.totalEnemiesKilled}<br>
                💰 Total coins earned: ${gameState.totalCoinsEarned}<br>
                🏗️ Towers built: ${gameState.towers.length}
            `;
  document.getElementById('gameOverModal').classList.remove('hidden');
}

function render() {
  if (!gameState.gameStarted) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawPath();
  drawPlacementPreview();

  gameState.towers.forEach(tower => tower.draw());
  gameState.enemies.forEach(enemy => enemy.draw());
  gameState.bullets.forEach(bullet => bullet.draw());

  if (gameState.selectedTower) {
    const tower = gameState.selectedTower;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(10, 10, 200, 80);

    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Tower level ${tower.level}`, 20, 30);
    ctx.fillText(`Damage: ${tower.damage}`, 20, 45);
    ctx.fillText(`Range: ${tower.range}`, 20, 60);

    if (tower.level < 3) {
      ctx.fillText(`Upgrade: 💰${tower.getUpgradeCost()}`, 20, 75);
    }
    ctx.fillText(`Sell: 💰${tower.getSellValue()}`, 110, 75);
  }

  if (gameState.waveActive) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(canvas.width - 220, 10, 200, 100);

    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Wave ${gameState.wave} - In progress`, canvas.width - 210, 30);
    ctx.fillText(`👾 Eliminated: ${gameState.enemiesKilled}/${gameState.enemiesPerWave}`, canvas.width - 210, 50);
    ctx.fillText(`❤️ Lives lost: ${gameState.livesLostThisWave}`, canvas.width - 210, 70);
    ctx.fillText(`💰 Coins earned: ${gameState.coinsEarnedThisWave}`, canvas.width - 210, 90);
  } else if (gameState.wave > 1) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(canvas.width - 220, 10, 200, 120);

    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Total Statistics`, canvas.width - 210, 30);
    ctx.fillText(`Waves completed: ${gameState.wave - 1}`, canvas.width - 210, 50);
    ctx.fillText(`👾 Total eliminated: ${gameState.totalEnemiesKilled}`, canvas.width - 210, 70);
    ctx.fillText(`❤️ Total lives lost: ${gameState.totalLivesLost}`, canvas.width - 210, 90);
    ctx.fillText(`💰 Total coins earned: ${gameState.totalCoinsEarned}`, canvas.width - 210, 110);
  }

  updateGame();
  requestAnimationFrame(render);
}

function updateUI() {
  document.getElementById('coins').textContent = gameState.coins;
  document.getElementById('health').textContent = gameState.health;
  document.getElementById('wave').textContent = gameState.wave;
  document.getElementById('enemiesLeft').textContent = gameState.enemiesLeft;

  const buyBtn = document.getElementById('buyTower');
  if (gameState.placingTower) {
    buyBtn.textContent = 'Cancel Purchase';
    buyBtn.disabled = false;
    buyBtn.className = 'btn btn-danger';
  } else {
    buyBtn.textContent = 'Buy Tower (💰50)';
    buyBtn.disabled = gameState.coins < config.towerCost;
    buyBtn.className = 'btn btn-primary';
  }

  const startBtn = document.getElementById('startWave');
  startBtn.disabled = gameState.waveActive;
  startBtn.textContent = gameState.waveActive ? 'Wave in Progress' : 'Start Wave';
}

function resetGame() {
  gameState = {
    coins: 100,
    health: 20,
    wave: 1,
    enemiesLeft: 0,
    towers: [],
    enemies: [],
    bullets: [],
    waveActive: false,
    placingTower: false,
    enemiesSpawned: 0,
    enemiesPerWave: 5,
    mouseX: 0,
    mouseY: 0,
    selectedTower: null,
    enemiesKilled: 0,
    totalEnemiesKilled: 0,
    livesLostThisWave: 0,
    totalLivesLost: 0,
    coinsEarnedThisWave: 0,
    totalCoinsEarned: 0,
    gameStarted: true,
    gameOver: false
  };
  updateUI();
  document.getElementById('waveStatus').textContent = 'Click "Start Wave"!';
}

function startGame() {
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('gameScreen').classList.add('active');
  gameState.gameStarted = true;
  updateUI();
  render();
}

document.getElementById('startGameBtn').addEventListener('click', startGame);

document.getElementById('buyTower').addEventListener('click', () => {
  if (gameState.placingTower) {
    gameState.placingTower = false;
    gameState.selectedTower = null;
    updateUI();
    document.getElementById('waveStatus').textContent = 'Purchase canceled. Ready for battle!';
  } else if (gameState.coins >= config.towerCost) {
    gameState.placingTower = true;
    gameState.selectedTower = null;
    gameState.towers.forEach(t => t.selected = false);
    updateUI();
    document.getElementById('waveStatus').textContent = 'Click on the field to place the tower! (Green = valid, Red = invalid)';
  }
});

document.getElementById('startWave').addEventListener('click', () => {
  if (!gameState.waveActive) {
    gameState.waveActive = true;
    gameState.enemiesSpawned = 0;
    gameState.enemiesLeft = gameState.enemiesPerWave;

    gameState.enemiesKilled = 0;
    gameState.livesLostThisWave = 0;
    gameState.coinsEarnedThisWave = 0;

    document.getElementById('waveStatus').textContent = `Wave ${gameState.wave} Started! Defend your base!`;
    spawnEnemy();
    updateUI();
  }
});

document.getElementById('resetGame').addEventListener('click', () => {
  if (confirm('Are you sure you want to restart the game??')) {
    resetGame();
  }
});

document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('gameOverModal').classList.add('hidden');
  resetGame();
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  gameState.mouseX = e.clientX - rect.left;
  gameState.mouseY = e.clientY - rect.top;
});

canvas.addEventListener('click', (e) => {
  if (gameState.gameOver) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (gameState.placingTower) {
    if (isValidTowerPosition(x, y)) {
      gameState.coins -= config.towerCost;
      gameState.towers.push(new Tower(x, y));
      gameState.placingTower = false;
      gameState.selectedTower = null;
      updateUI();
      document.getElementById('waveStatus').textContent = 'Tower built! Prepare for battle.';
    } else {
      document.getElementById('waveStatus').textContent = 'Invalid position! Please choose another location..';
    }
  } else {
    let towerClicked = false;

    for (let tower of gameState.towers) {
      if (tower.selected) {
        if (tower.isPointInUpgradeButton(x, y) && tower.level < 3) {
          const upgradeCost = tower.getUpgradeCost();
          if (gameState.coins >= upgradeCost) {
            gameState.coins -= upgradeCost;
            tower.upgrade();
            updateUI();
            document.getElementById('waveStatus').textContent = `Improved tower to level ${tower.level}!`;
          } else {
            document.getElementById('waveStatus').textContent = 'Insufficient coins for upgrade!';
          }
          towerClicked = true;
          break;
        } else if (tower.isPointInSellButton(x, y)) {
          const sellValue = tower.getSellValue();
          gameState.coins += sellValue;
          const index = gameState.towers.indexOf(tower);
          gameState.towers.splice(index, 1);
          gameState.selectedTower = null;
          updateUI();
          document.getElementById('waveStatus').textContent = `Tower sold for 💰${sellValue}!`;
          towerClicked = true;
          break;
        }
      }

      if (tower.isPointInside(x, y)) {
        gameState.towers.forEach(t => t.selected = false);
        tower.selected = true;
        gameState.selectedTower = tower;
        towerClicked = true;
        break;
      }
    }

    if (!towerClicked) {
      gameState.towers.forEach(t => t.selected = false);
      gameState.selectedTower = null;
    }
  }
});

updateUI();