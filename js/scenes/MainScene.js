/**
 * MainScene.js
 * The main game scene that handles game initialization and the game loop
 */

import { PlayerController } from '../controllers/PlayerController.js';
import { WeaponController } from '../controllers/WeaponController.js';
import { MobileController } from '../controllers/MobileController.js';
import { DeviceController } from '../controllers/DeviceController.js';
import { ChickenManager } from '../entities/Chicken.js';
import { setupSafeAreaDetection } from '../utils/SafeArea.js';
import { Scene3D, THREE } from '../lib/enable3d.js';

export class MainScene extends Scene3D {
  constructor() {
    super({ key: 'MainScene' });
    
    // Game state
    this.debugMode = false;
    this.lastTime = 0;
    this.frameCount = 0;
    
    // Core controllers
    this.playerController = null;
    this.weaponController = null;
    this.deviceController = null;
    this.chickenManager = null;
    
    // Mobile-specific
    this.mobileController = null;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  create() {
    // Initialize 3D scene
    this.accessThirdDimension({ maxSubSteps: 10, fixedTimeStep: 1 / 180 });
    this.third.warpSpeed('-orbitControls');
    this.third.renderer.gammaFactor = 1.5;
    this.third.camera.layers.enable(1); // enable layer 1
    
    // Set renderer to match window size
    this.third.renderer.setSize(window.innerWidth, window.innerHeight);

    // Setup safe area detection for notched devices
    setupSafeAreaDetection();
    
    // Initialize device controller for platform-specific UI
    this.deviceController = new DeviceController(this);
    this.deviceController.setupDeviceSpecificUI();
    
    // Initialize controllers
    this.setupMinimap();
    this.setupUI();
    
    // Initialize player
    this.playerController = new PlayerController(this);
    this.playerController.init();
    
    // Initialize weapon controller
    this.weaponController = new WeaponController(this);
    
    // Setup mobile controller if on mobile
    if (this.isMobile) {
      this.mobileController = new MobileController(this);
      this.mobileController.init();
      this.playerController.setMobileController(this.mobileController);
    }
    
    // Load weapon model (which is also used for chickens)
    this.weaponController.loadWeapon().then(modelObject => {
      // Initialize chickens with the loaded model
      this.chickenManager = new ChickenManager(this);
      this.chickenManager.loadChickens(modelObject);
    });
    
    // Mark ground as non-destructible
    this.third.physics.add.ground({ 
      width: 50, 
      height: 50, 
      name: 'ground', 
      userData: { destructible: false } 
    });
    
    // Make game respond to window resizing
    window.addEventListener('resize', () => this.deviceController.handleResize());
    
    // Set up post-render event for the minimap
    this.scene.scene.game.events.on('postrender', (renderer, time, delta) => {
      this.postRender();
    });
  }
  
  setupMinimap() {
    // Create second camera for minimap
    this.secondCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    this.third.add.existing(this.secondCamera);
    this.third.camera.add(this.secondCamera);
    this.secondCamera.position.set(0, 15, 0); // Set position above player
    this.secondCamera.lookAt(0, 0, 0); // Look down at scene
  }
  
  setupUI() {
    // Add red dot crosshair
    this.redDot = this.add.circle(this.cameras.main.width / 2, this.cameras.main.height / 2, 4, 0xff0000);
    this.redDot.depth = 1;
    
    // Add UI for remaining chickens
    this.chickensRemainingText = this.add.text(10, 10, `Chickens: 50`, { 
      fontSize: this.isMobile ? '18px' : '24px', 
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      fontFamily: 'Orbitron'
    });
    this.chickensRemainingText.setScrollFactor(0);
    this.chickensRemainingText.depth = 1000;
  }

  postRender() {
    // Skip if no renderer
    if (!this.third || !this.third.renderer) return;
    
    // Update minimap viewport positioning based on current screen dimensions
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isSmallScreen = screenWidth < 375 || screenHeight < 600;
    
    // Calculate appropriate minimap size
    const minimapSize = isSmallScreen 
      ? Math.min(screenWidth, screenHeight) * 0.12  // Smaller on small screens
      : Math.min(screenWidth, screenHeight) * 0.15;
      
    // Position in top-left corner with proper margins
    const minimapX = isSmallScreen ? 5 : Math.max(10, screenWidth * 0.05);
    const minimapY = isSmallScreen ? 5 : Math.max(10, screenHeight * 0.05);
    
    // Get safe area top inset if available
    const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0');
    
    // Main viewport render
    this.third.renderer.setViewport(0, 0, screenWidth, screenHeight);
    this.third.renderer.render(this.third.scene, this.third.camera);

    this.third.renderer.clearDepth();

    // Minimap render
    this.third.renderer.setScissorTest(true);
    this.third.renderer.setScissor(
      minimapX, 
      minimapY + safeAreaTop, 
      minimapSize, 
      minimapSize * 0.75
    );
    this.third.renderer.setViewport(
      minimapX, 
      minimapY + safeAreaTop, 
      minimapSize, 
      minimapSize * 0.75
    );

    this.third.renderer.render(this.third.scene, this.secondCamera);
    this.third.renderer.setScissorTest(false);
  }

  update(time, delta) {
    // Player and weapon update
    if (this.playerController && this.weaponController) {
      // Update player movement and controls
      this.playerController.update(time, delta);
      
      // Update weapon position based on player movement
      const moveState = this.playerController.getMoveState();
      this.weaponController.updateRiflePosition(this.third.camera, moveState);
      
      // Update aiming state (controls red dot visibility)
      const isAiming = this.isMobile && this.mobileController ? 
        this.mobileController.getAimStatus() : 
        this.input.mousePointer.rightButtonDown();
      
      // Toggle red dot based on aiming
      if (this.redDot) {
        this.redDot.alpha = isAiming ? 0 : 1;
      }
      
      // Handle shooting for desktop
      if (!this.isMobile && this.input.mousePointer.leftButtonDown()) {
        this.shoot();
      }
    }
    
    // Update chickens
    if (this.chickenManager) {
      this.chickenManager.update();
      
      // Update chicken counter
      if (this.chickensRemainingText) {
        const remainingChickens = this.chickenManager.getRemainingCount();
        this.chickensRemainingText.setText(`Chickens: ${remainingChickens}`);
      }
    }
  }
  
  shoot() {
    if (this.weaponController) {
      this.weaponController.shoot();
    }
  }
} 