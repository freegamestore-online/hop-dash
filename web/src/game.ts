import kaplay from "kaplay";

// ─── Virtual canvas ───────────────────────────────────────────────────────────
const VW = 480;
const VH = 320;

// ─── Game constants ───────────────────────────────────────────────────────────
const GROUND_Y = VH - 48;        // top of the ground strip
const PLAYER_SIZE = 28;
const PLAYER_X = 80;

const GRAVITY = 1800;
const JUMP_FORCE = -640;

const OBSTACLE_W_MIN = 18;
const OBSTACLE_W_MAX = 30;
const OBSTACLE_H_MIN = 28;
const OBSTACLE_H_MAX = 58;

const BASE_SPEED = 220;           // px / s at score 0
const SPEED_RAMP = 6;             // px / s added per obstacle cleared
const MAX_SPEED = 620;

const GAP_MIN = 0.55;             // seconds between obstacles (floor)
const GAP_START = 1.35;           // seconds between obstacles at start
const GAP_RAMP = 0.012;           // seconds removed per obstacle cleared

// ─── Colours ──────────────────────────────────────────────────────────────────
const COL_BG: [number, number, number]       = [15,  15,  20];
const COL_GROUND: [number, number, number]   = [40,  40,  52];
const COL_PLAYER: [number, number, number]   = [99,  102, 241]; // indigo
const COL_OBSTACLE: [number, number, number] = [239, 68,  68];  // red
const COL_STAR: [number, number, number]     = [200, 200, 220];
const COL_WHITE: [number, number, number]    = [255, 255, 255];
const COL_DIM: [number, number, number]      = [140, 140, 160];
const COL_GOLD: [number, number, number]     = [250, 204, 21];
const COL_GREEN: [number, number, number]    = [16,  185, 129];

// ─── Shared state passed from React ──────────────────────────────────────────
export interface GameCallbacks {
  onScore: (n: number) => void;
  onHighScore: (n: number) => void;
  getHighScore: () => number;
}

export function startGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): () => void {
  const { onScore, onHighScore, getHighScore } = callbacks;

  const k = kaplay({
    canvas,
    width: VW,
    height: VH,
    letterbox: true,
    background: COL_BG,
    global: false,
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
    gravity: GRAVITY,
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function addStars() {
    for (let i = 0; i < 55; i++) {
      const sz = k.rand(1, 2.5);
      k.add([
        k.rect(sz, sz),
        k.pos(k.rand(0, VW), k.rand(0, GROUND_Y - 10)),
        k.color(...COL_STAR),
        k.opacity(k.rand(0.2, 0.7)),
        k.fixed(),
      ]);
    }
  }

  function addGround() {
    k.add([
      k.rect(VW, 48),
      k.pos(0, GROUND_Y),
      k.color(...COL_GROUND),
      k.fixed(),
    ]);
    // thin highlight line on top of ground
    k.add([
      k.rect(VW, 2),
      k.pos(0, GROUND_Y),
      k.color(70, 70, 90),
      k.fixed(),
    ]);
  }

  function scoreText(val: number, x: number, y: number) {
    return k.add([
      k.text(`${val}`, { size: 22, font: "monospace" }),
      k.anchor("center"),
      k.pos(x, y),
      k.color(...COL_WHITE),
      k.fixed(),
    ]);
  }

  // ─── START SCENE ──────────────────────────────────────────────────────────
  k.scene("start", () => {
    addStars();
    addGround();

    // Idle player bouncing on ground
    const idle = k.add([
      k.rect(PLAYER_SIZE, PLAYER_SIZE, { radius: 5 }),
      k.color(...COL_PLAYER),
      k.anchor("botleft"),
      k.pos(PLAYER_X, GROUND_Y),
      k.area(),
      k.body(),
      "idle",
    ]);

    // Little idle hop
    let idleTimer = 0;
    k.onUpdate(() => {
      idleTimer += k.dt();
      if (idleTimer > 1.1) {
        idleTimer = 0;
        idle.jump(-JUMP_FORCE * 0.55);
      }
    });

    // Title
    k.add([
      k.text("HOP DASH", { size: 44, font: "monospace" }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 - 80),
      k.color(...COL_WHITE),
      k.fixed(),
    ]);

    // Sub-label
    k.add([
      k.text("PRESS SPACE / TAP TO JUMP", { size: 13, font: "monospace" }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 - 36),
      k.color(...COL_DIM),
      k.fixed(),
    ]);

    // High score
    const hs = getHighScore();
    if (hs > 0) {
      k.add([
        k.text(`BEST: ${hs}`, { size: 16, font: "monospace" }),
        k.anchor("center"),
        k.pos(VW / 2, VH / 2 - 8),
        k.color(...COL_GOLD),
        k.fixed(),
      ]);
    }

    // Prompt pulse
    const prompt = k.add([
      k.text("— TAP OR PRESS SPACE TO START —", { size: 12, font: "monospace" }),
      k.anchor("center"),
      k.pos(VW / 2, VH - 20),
      k.color(...COL_GREEN),
      k.fixed(),
    ]);
    let t = 0;
    k.onUpdate(() => {
      t += k.dt();
      prompt.opacity = 0.5 + 0.5 * Math.sin(t * 3);
    });

    const goPlay = () => k.go("play");
    k.onKeyPress("space", goPlay);
    k.onMousePress(goPlay);
    k.onTouchStart(goPlay);
  });

  // ─── PLAY SCENE ───────────────────────────────────────────────────────────
  k.scene("play", () => {
    let score = 0;
    let speed = BASE_SPEED;
    let nextGap = GAP_START;
    let onGround = true;
    onScore(0);

    addStars();
    addGround();

    // ── Player ──────────────────────────────────────────────────────────────
    const player = k.add([
      k.rect(PLAYER_SIZE, PLAYER_SIZE, { radius: 5 }),
      k.color(...COL_PLAYER),
      k.anchor("botleft"),
      k.pos(PLAYER_X, GROUND_Y),
      k.area({ shape: new k.Rect(k.vec2(2, 2), PLAYER_SIZE - 4, PLAYER_SIZE - 4) }),
      k.body(),
      "player",
    ]);

    // Track when player is on ground
    player.onGround(() => { onGround = true; });
    player.onFall(() => { onGround = false; });

    function tryJump() {
      if (onGround) {
        player.jump(-JUMP_FORCE);
        onGround = false;
      }
    }

    k.onKeyPress("space", tryJump);
    k.onMousePress(tryJump);
    k.onTouchStart(tryJump);

    // ── Scrolling ground tiles (visual only) ────────────────────────────────
    const TILE_W = 40;
    const tiles: ReturnType<typeof k.add>[] = [];
    for (let i = 0; i <= Math.ceil(VW / TILE_W) + 1; i++) {
      tiles.push(k.add([
        k.rect(TILE_W - 2, 4),
        k.pos(i * TILE_W, GROUND_Y + 6),
        k.color(55, 55, 70),
        k.fixed(),
      ]));
    }
    k.onUpdate(() => {
      for (const tile of tiles) {
        tile.pos.x -= speed * k.dt();
        if (tile.pos.x < -TILE_W) tile.pos.x += (Math.ceil(VW / TILE_W) + 2) * TILE_W;
      }
    });

    // ── HUD ─────────────────────────────────────────────────────────────────
    const scoreLbl = scoreText(0, VW / 2, 22);

    // ── Obstacle spawner ─────────────────────────────────────────────────────
    function spawnObstacle() {
      const h = k.rand(OBSTACLE_H_MIN, OBSTACLE_H_MAX);
      const w = k.rand(OBSTACLE_W_MIN, OBSTACLE_W_MAX);
      const obs = k.add([
        k.rect(w, h, { radius: 3 }),
        k.color(...COL_OBSTACLE),
        k.anchor("botleft"),
        k.pos(VW + w, GROUND_Y),
        k.area({ shape: new k.Rect(k.vec2(2, 2), w - 4, h - 4) }),
        "obstacle",
      ]);

      let passed = false;
      k.onUpdate(() => {
        obs.pos.x -= speed * k.dt();
        // Score when obstacle passes player
        if (!passed && obs.pos.x + w < PLAYER_X) {
          passed = true;
          score += 1;
          onScore(score);
          onHighScore(score);
          scoreLbl.text = `${score}`;
          // Ramp difficulty
          speed = Math.min(BASE_SPEED + score * SPEED_RAMP, MAX_SPEED);
          nextGap = Math.max(GAP_MIN, GAP_START - score * GAP_RAMP);
        }
        if (obs.pos.x < -w - 10) k.destroy(obs);
      });

      // Schedule next
      k.wait(nextGap, spawnObstacle);
    }

    k.wait(1.2, spawnObstacle);

    // ── Collision → game over ────────────────────────────────────────────────
    player.onCollide("obstacle", () => {
      k.go("over", score);
    });

    // ── Player squash/stretch visual ─────────────────────────────────────────
    k.onUpdate(() => {
      if (!onGround) {
        // stretch upward when rising, squash when falling
        const vy = player.vel.y;
        const scaleX = vy < 0 ? 0.82 : 1.08;
        const scaleY = vy < 0 ? 1.18 : 0.92;
        player.width  = PLAYER_SIZE * scaleX;
        player.height = PLAYER_SIZE * scaleY;
      } else {
        player.width  = PLAYER_SIZE;
        player.height = PLAYER_SIZE;
      }
    });
  });

  // ─── GAME-OVER SCENE ──────────────────────────────────────────────────────
  k.scene("over", (finalScore: number) => {
    addStars();
    addGround();

    const hs = getHighScore();

    // Panel background
    k.add([
      k.rect(300, 190, { radius: 12 }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 - 10),
      k.color(30, 30, 40),
      k.opacity(0.92),
      k.fixed(),
    ]);

    k.add([
      k.text("GAME OVER", { size: 32, font: "monospace" }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 - 68),
      k.color(...COL_WHITE),
      k.fixed(),
    ]);

    k.add([
      k.text(`SCORE: ${finalScore}`, { size: 22, font: "monospace" }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 - 26),
      k.color(...COL_GREEN),
      k.fixed(),
    ]);

    const isNew = finalScore > 0 && finalScore >= hs;
    k.add([
      k.text(isNew ? `★ NEW BEST: ${hs} ★` : `BEST: ${hs}`, { size: 16, font: "monospace" }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 + 8),
      k.color(...(isNew ? COL_GOLD : COL_DIM)),
      k.fixed(),
    ]);

    // Restart button
    const btn = k.add([
      k.rect(180, 40, { radius: 8 }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 + 60),
      k.color(...COL_PLAYER),
      k.area(),
      k.fixed(),
    ]);
    k.add([
      k.text("PLAY AGAIN", { size: 15, font: "monospace" }),
      k.anchor("center"),
      k.pos(VW / 2, VH / 2 + 60),
      k.color(...COL_WHITE),
      k.fixed(),
    ]);

    const restart = () => k.go("play");
    btn.onClick(restart);
    k.onKeyPress("space", restart);
    k.onTouchStart(restart);
  });

  k.go("start");

  return () => k.quit();
}
