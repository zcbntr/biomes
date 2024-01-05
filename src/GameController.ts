import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Island from "./Island";
import { IslandParams } from "./Island";
import { BiomeType } from "./Biomes";
import { Character } from "./Character";
import * as CANNON from "cannon-es";
import CannonDebugger from "cannon-es-debugger";

const GAME_LENGTH = 10;

export default class GameController {
  private menu: HTMLElement;
  private hud: HTMLElement;
  private scoreScreen: HTMLElement;
  private menuVisible: boolean = false;
  private scoreScreenVisible: boolean = false;
  private renderer: THREE.WebGLRenderer;
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;
  public scene: THREE.Scene;
  public physicsWorld: CANNON.World;
  public island: Island;
  private character: Character;
  public physicsFrameRate: number = 60;
  public physicsFrameTime: number = 1 / this.physicsFrameRate;
  private timeScaleTarget: number = 1;
  private timeScale: number = 1;
  private clock: THREE.Clock = new THREE.Clock();
  private delta: number = 0;
  private animalsFound: number = 0;
  public goalReached: boolean = false;
  private gameStarted: boolean = false;
  private timeRemaining: number = GAME_LENGTH;
  private timeAtPause: number = 0;

  private cannonDebugger: typeof CannonDebugger;
  private physicsDebug: boolean = false;

  constructor() {
    this.Init();
  }

  private Init(): void {
    this.createMenu();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this.renderer.domElement);

    window.addEventListener(
      "resize",
      () => {
        this.onWindowResize();
      },
      false
    );

    window.addEventListener("keydown", (e) => {
      if (e.key === "p") {
        this.enablePhsyicsDebug();
      } else if (e.key === "l") {
        this.island.toggleLightDebug();
      } else if (e.key === "h") {
        this.toggleShadows();
      } else if (e.key === "Escape") {
        if (!this.scoreScreenVisible) this.toggleMenu();
      } else {
        this.character.handleKeyboardEvent(e, e.code, true);
      }
    });

    window.addEventListener("keyup", (e) => {
      this.character.handleKeyboardEvent(e, e.code, false);
    });

    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(20, 20, 20);

    this.scene = new THREE.Scene();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 10, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.update();

    this.generateIsland();
    this.render(this);
    this.toggleMenu();
    this.createHUD();
  }

  private resetCamera(): void {
    this.camera.position.set(20, 20, 20);
    this.camera.lookAt(0, 10, 0);
    this.camera.updateMatrixWorld();
    this.controls.target.set(0, 10, 0);
  }

  private togglePause(): void {
    if (this.timeScaleTarget === 0) {
      this.timeScaleTarget = 1;
    } else {
      this.timeScaleTarget = 0;
    }

    this.timeAtPause = this.clock.getElapsedTime();
  }

  private toggleMenu(): void {
    this.togglePause();

    if (this.gameStarted) {
      this.menu.getElementsByClassName("startButton")[0].innerHTML = "Resume";
      const restartButton =
        this.menu.getElementsByClassName("restartButton")[0];
      restartButton.style.display = "block";
    }

    this.menuVisible = !this.menuVisible;
    if (this.menuVisible) {
      this.menu.style.display = "block";
    } else {
      this.menu.style.display = "none";
    }

    if (this.menuVisible) {
      this.controls.enabled = false;
      this.clock.stop();
    } else {
      this.controls.enabled = true;
      this.clock.start();
    }

    if (!this.gameStarted) {
      this.gameStarted = true;
    }
  }

  private createMenu(): void {
    const menu = document.createElement("div");
    menu.id = "menu";
    menu.style.display = "none";
    menu.style.position = "absolute";
    menu.style.width = (window.innerWidth * 0.4).toString() + "px";
    menu.style.height = (window.innerHeight * 0.6).toString() + "px";
    menu.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    menu.style.color = "#fff";
    menu.style.padding = "10px";
    menu.style.zIndex = "100";
    menu.style.top =
      (window.innerHeight / 2 - window.innerHeight * 0.3).toString() + "px";
    menu.style.left =
      (window.innerWidth / 2 - window.innerWidth * 0.2).toString() + "px";
    menu.style.textAlign = "center";

    const title = document.createElement("h1");
    title.innerHTML = "Biomes";
    menu.appendChild(title);

    const description = document.createElement("p");
    description.innerHTML =
      "A game about exploring biomes and finding animals.";
    menu.appendChild(description);

    const controls = document.createElement("p");
    controls.innerHTML =
      "Controls: <br />" +
      "WASD - Move <br /> Space - Jump <br /> P - Enable Physics Debug <br /> L - Toggle Light Debug <br /> H - Toggle Shadows <br /> Esc - Toggle Menu";
    menu.appendChild(controls);

    const startButton = document.createElement("button");
    startButton.className = "startButton";
    startButton.innerHTML = "Start";
    startButton.style.margin = "10px";
    startButton.style.padding = "10px";
    startButton.style.backgroundColor = "#fff";
    startButton.style.color = "#000";
    startButton.style.border = "none";
    startButton.style.borderRadius = "5px";
    startButton.style.cursor = "pointer";
    startButton.style.fontSize = "1.2em";
    startButton.addEventListener("click", () => {
      if (!this.gameStarted) {
        this.gameStarted = true;
      }
      this.toggleMenu();
    });
    menu.appendChild(startButton);

    const restartButton = document.createElement("button");
    restartButton.className = "restartButton";
    restartButton.innerHTML = "Restart";
    restartButton.style.margin = "10px";
    restartButton.style.padding = "10px";
    restartButton.style.backgroundColor = "#fff";
    restartButton.style.color = "#000";
    restartButton.style.border = "none";
    restartButton.style.borderRadius = "5px";
    restartButton.style.cursor = "pointer";
    restartButton.style.fontSize = "1.2em";
    restartButton.addEventListener("click", () => {
      this.timeRemaining = GAME_LENGTH;
      this.animalsFound = 0;
      this.gameStarted = false;
      if (this.scoreScreenVisible) this.toggleScoreScreen();
      this.toggleMenu();
      this.generateNextIsland();
    });
    restartButton.style.display = "none";
    menu.appendChild(restartButton);

    document.body.appendChild(menu);
    this.menu = menu;
  }

  private createHUD(): void {
    const hud = document.createElement("div");
    hud.id = "hud";
    hud.style.position = "absolute";
    hud.style.backgroundColor = "rgba(0, 0, 0, 0.0)";
    hud.style.color = "#fff";
    hud.style.padding = "10px";
    hud.style.zIndex = "100";
    hud.style.top = "0";
    hud.style.left = "0";

    const time = document.createElement("h2");
    time.className = "time";
    time.innerHTML = "Time: " + this.timeRemaining + "s";
    time.style.margin = "1";
    time.style.padding = "1";
    hud.appendChild(time);

    const animalsFound = document.createElement("h2");
    animalsFound.className = "animalsFound";
    animalsFound.innerHTML = "Animals Found: " + this.animalsFound;
    animalsFound.style.margin = "1";
    animalsFound.style.padding = "1";
    hud.appendChild(animalsFound);

    const biomeName = document.createElement("h2");
    biomeName.className = "biomeName";
    biomeName.innerHTML = "Biome: " + BiomeType[this.island.params.biome];
    biomeName.style.margin = "1";
    biomeName.style.padding = "1";
    hud.appendChild(biomeName);

    document.body.appendChild(hud);
    this.hud = hud;
  }

  private updateHUD(): void {
    this.hud.getElementsByClassName("time")[0].innerHTML =
      "Time: " + this.timeRemaining.toFixed(3) + "s";
    this.hud.getElementsByClassName("animalsFound")[0].innerHTML =
      "Animals Found: " + this.animalsFound;
    this.hud.getElementsByClassName("biomeName")[0].innerHTML =
      "Biome: " + BiomeType[this.island.params.biome];
  }

  private createScoreScreen(): void {
    this.controls.enabled = false;
    const scoreScreen = document.createElement("div");
    scoreScreen.id = "scoreScreen";
    scoreScreen.style.position = "absolute";
    scoreScreen.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    scoreScreen.style.color = "#fff";
    scoreScreen.style.padding = "10px";
    scoreScreen.style.zIndex = "100";
    scoreScreen.style.width = (window.innerWidth * 0.4).toString() + "px";
    scoreScreen.style.height = (window.innerHeight * 0.6).toString() + "px";
    scoreScreen.style.top =
      (window.innerHeight / 2 - window.innerHeight * 0.3).toString() + "px";
    scoreScreen.style.left =
      (window.innerWidth / 2 - window.innerWidth * 0.2).toString() + "px";
    scoreScreen.style.textAlign = "center";

    const title = document.createElement("h1");
    title.innerHTML = "Game Over";
    scoreScreen.appendChild(title);

    const description = document.createElement("p");
    description.innerHTML =
      "You found " +
      this.animalsFound +
      " animals! <br />" +
      "Thanks for playing!";
    scoreScreen.appendChild(description);

    const restartButton = document.createElement("button");
    restartButton.className = "scoreScreenRestartButton";
    restartButton.innerHTML = "Restart";
    restartButton.style.margin = "10px";
    restartButton.style.padding = "10px";
    restartButton.style.backgroundColor = "#fff";
    restartButton.style.color = "#000";
    restartButton.style.border = "none";
    restartButton.style.borderRadius = "5px";
    restartButton.style.cursor = "pointer";
    restartButton.style.fontSize = "1.2em";
    restartButton.addEventListener("click", () => {
      this.timeRemaining = GAME_LENGTH;
      this.animalsFound = 0;
      this.gameStarted = false;
      this.toggleScoreScreen();
      this.toggleMenu();
      this.generateNextIsland();
    });
    scoreScreen.appendChild(restartButton);

    document.body.appendChild(scoreScreen);
    this.scoreScreenVisible = true;
    this.scoreScreen = scoreScreen;
  }

  private toggleScoreScreen(): void {
    this.scoreScreen.style.display = "none";
    this.scoreScreenVisible = false;
  }

  private generateIsland(): void {
    const seed = Math.random();
    const biomeOptions = Object.keys(BiomeType).length / 2;
    const biomeType: BiomeType = Math.floor(seed * biomeOptions);

    // If we're generating the same biome, just regenerate the island
    if (this.island && this.island.params.biome === biomeType) {
      this.generateIsland();
      return;
    }

    this.createPhysicsWorld();

    this.createIsland(biomeType, seed);

    this.character = new Character(this);
    this.island.createGoal(
      this.island.getTileFromXZ(
        this.character.getFeetPosition().x,
        this.character.getFeetPosition().z
      )
    );
  }

  public onGoalReached(): void {
    if (!this.goalReached) {
      this.timeAtPause += this.clock.getElapsedTime();
      this.goalReached = true;
      this.animalsFound++;

      setTimeout(() => {
        this.generateNextIsland();
      }, 5000);

      let targetPosition = this.island.goalTile.getTileTopPosition();
      this.camera.position.set(targetPosition.x, 20, targetPosition.z);
      this.camera.lookAt(targetPosition);
      this.camera.updateMatrixWorld();
    }
  }

  private generateNextIsland(): void {
    // Reset character position, velocity, rotation
    this.character.reset();

    // Delete previous island
    this.scene.clear();

    // Delete previous physics world
    while (this.physicsWorld.bodies.length > 0) {
      this.physicsWorld.removeBody(this.physicsWorld.bodies[0]);
    }

    // Generate new island
    this.generateIsland();

    this.resetCamera();
    this.updateHUD();
    this.physicsDebug = false;
    this.goalReached = false;
    this.timeAtPause += this.clock.getElapsedTime();
    this.clock.start();
  }

  public toggleShadows(): void {
    this.renderer.shadowMap.enabled = !this.renderer.shadowMap.enabled;
  }

  public enablePhsyicsDebug(): void {
    if (!this.physicsDebug) {
      this.physicsDebug = true;
      if (this.physicsDebug) {
        this.cannonDebugger = new CannonDebugger(this.scene, this.physicsWorld);
      }
    }
  }

  private createPhysicsWorld(): void {
    this.physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.81, 0),
      broadphase: new CANNON.SAPBroadphase(this.physicsWorld),
      allowSleep: true,
    });
  }

  private createIsland(biomeType: BiomeType, seed: number): void {
    const params = new IslandParams(this, biomeType, seed, 15);
    this.island = new Island(params);
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private render(world: GameController): void {
    this.delta = this.clock.getDelta();

    requestAnimationFrame(() => {
      world.render(world);
    });

    let timeStep = this.delta * this.timeScale;
    timeStep = Math.min(timeStep, 1 / 30);

    world.update(timeStep);

    this.renderer.render(this.scene, this.camera);
  }

  private update(timeStep: number): void {
    if (this.timeRemaining <= 0) {
      if (this.goalReached) this.clock.stop();
      if (!this.scoreScreenVisible) this.createScoreScreen();
      // this.toggleMenu();
    }

    if (this.gameStarted) {
      if (!this.goalReached && this.timeRemaining > 0 && !this.menuVisible) {
        const newTime = this.timeRemaining - this.clock.getElapsedTime() * 0.001;
        if (newTime < 0) {
          this.timeRemaining = 0;
        }
        else {
          this.timeRemaining = newTime;
        }
      }
    }

    if (this.hud) this.updateHUD();

    this.physicsWorld.step(this.physicsFrameTime, timeStep);

    this.character.update(timeStep);

    this.island.update(timeStep);

    if (this.physicsDebug) {
      this.cannonDebugger.update();
    }

    this.timeScale = THREE.MathUtils.lerp(
      this.timeScale,
      this.timeScaleTarget,
      0.2
    );
  }
}
