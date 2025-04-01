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
    // this.setupMinimap();
    this.setupUI();
    
    // Initialize player
    this.playerController = new PlayerController(this);
    this.playerController.init();
    
    // Initialize weapon controller
    this.weaponController = new WeaponController(this);
    
    // Pass weapon controller reference to player controller
    this.playerController.setWeaponController(this.weaponController);
    
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
    
    // Create a barn structure instead of a simple ground
    this.createBarnStructure();
    
    // Make game respond to window resizing
    window.addEventListener('resize', () => this.deviceController.handleResize());
    
    // Set up post-render event for the minimap
    this.scene.scene.game.events.on('postrender', (renderer, time, delta) => {
      this.postRender();
    });
  }
  
  createBarnStructure() {
    // Define barn dimensions - longer instead of wide
    const barnLength = 80;  // Z direction
    const barnWidth = 40;   // X direction
    const barnHeight = 20;  // Y direction
    const wallThickness = 1;
    
    // Define barn colors from the image
    const barnWallColor = 0x8b20a0; // Purple/magenta color
    const barnFloorColor = 0x965c3c; // Brown wooden floor color
    const barnRoofColor = 0x6a1880; // Darker purple for roof
    const barnDoorColor = 0x7d2090; // Slightly different purple for doors
    
    // Create barn floor
    const floor = this.third.physics.add.ground({ 
      width: barnWidth, 
      height: barnLength,  // Using height parameter for length (z-direction)
      name: 'ground', 
      userData: { destructible: false }
    });
    
    // Apply barn floor texture
    if (floor.material) {
      floor.material.color.setHex(barnFloorColor);
    }
    
    // Create barn walls and ceiling - all non-destructible
    
    // Left wall (along z-axis)
    const leftWall = this.third.physics.add.box({
      width: wallThickness,
      height: barnHeight,
      depth: barnLength,
      x: -barnWidth/2,
      y: barnHeight/2,
      z: 0,
      name: 'wall',
      userData: { destructible: false }
    }, { lambert: { color: barnWallColor } });
    
    // Right wall (along z-axis)
    const rightWall = this.third.physics.add.box({
      width: wallThickness,
      height: barnHeight,
      depth: barnLength,
      x: barnWidth/2,
      y: barnHeight/2,
      z: 0,
      name: 'wall',
      userData: { destructible: false }
    }, { lambert: { color: barnWallColor } });
    
    // Back wall (along x-axis)
    const backWall = this.third.physics.add.box({
      width: barnWidth,
      height: barnHeight,
      depth: wallThickness,
      x: 0,
      y: barnHeight/2,
      z: -barnLength/2,
      name: 'wall',
      userData: { destructible: false }
    }, { lambert: { color: barnWallColor } });
    
    // Front wall (along x-axis) - with a door opening
    const frontWallLeft = this.third.physics.add.box({
      width: barnWidth/2 - 4, // Leave space for door
      height: barnHeight,
      depth: wallThickness,
      x: -barnWidth/4 - 2,
      y: barnHeight/2,
      z: barnLength/2,
      name: 'wall',
      userData: { destructible: false }
    }, { lambert: { color: barnWallColor } });
    
    const frontWallRight = this.third.physics.add.box({
      width: barnWidth/2 - 4, // Leave space for door
      height: barnHeight,
      depth: wallThickness,
      x: barnWidth/4 + 2,
      y: barnHeight/2,
      z: barnLength/2,
      name: 'wall',
      userData: { destructible: false }
    }, { lambert: { color: barnWallColor } });
    
    // Top door beam
    const doorTop = this.third.physics.add.box({
      width: 8,
      height: 2,
      depth: wallThickness,
      x: 0,
      y: barnHeight - 2,
      z: barnLength/2,
      name: 'wall',
      userData: { destructible: false }
    }, { lambert: { color: barnWallColor } });
    
    // Add closed barn doors
    const leftDoor = this.third.physics.add.box({
      width: 4,
      height: barnHeight - 2,
      depth: wallThickness/2,
      x: -2,
      y: (barnHeight - 2)/2,
      z: barnLength/2 + 0.2,
      name: 'door',
      userData: { destructible: false }
    }, { lambert: { color: barnDoorColor } });
    
    const rightDoor = this.third.physics.add.box({
      width: 4,
      height: barnHeight - 2,
      depth: wallThickness/2,
      x: 2,
      y: (barnHeight - 2)/2,
      z: barnLength/2 + 0.2,
      name: 'door',
      userData: { destructible: false }
    }, { lambert: { color: barnDoorColor } });
    
    // Create triangular roof structure
    // Middle peak
    const roofPeak = this.third.physics.add.box({
      width: wallThickness,
      height: 8, // Height of the peak
      depth: barnLength,
      x: 0,
      y: barnHeight + 4, // Position at the peak
      z: 0,
      name: 'roofPeak',
      userData: { destructible: false }
    }, { lambert: { color: barnRoofColor } });
    
    // Left slope
    const leftRoofSlope = this.third.physics.add.box({
      width: barnWidth/2,
      height: 1,
      depth: barnLength,
      x: -barnWidth/4,
      y: barnHeight,
      z: 0,
      name: 'roof',
      userData: { destructible: false }
    }, { lambert: { color: barnRoofColor } });
    
    // Apply rotation to left slope to create triangular shape
    leftRoofSlope.rotation.z = Math.PI * 0.12;
    
    // Right slope
    const rightRoofSlope = this.third.physics.add.box({
      width: barnWidth/2,
      height: 1,
      depth: barnLength,
      x: barnWidth/4,
      y: barnHeight,
      z: 0,
      name: 'roof',
      userData: { destructible: false }
    }, { lambert: { color: barnRoofColor } });
    
    // Apply rotation to right slope (opposite direction)
    rightRoofSlope.rotation.z = -Math.PI * 0.12;
    
    // Add hanging barn lights as seen in the image
    this.addBarnLights(barnHeight, barnWidth, barnLength);
    
    // Set all barn elements to be static
    [leftWall, rightWall, backWall, frontWallLeft, frontWallRight, doorTop, 
     leftDoor, rightDoor, roofPeak, leftRoofSlope, rightRoofSlope].forEach(wall => {
      if (wall.body) {
        wall.body.setCollisionFlags(2); // Set as kinematic object (static)
      }
    });
    
    // Add some ambient lighting to the barn
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.third.scene.add(ambientLight);
    
    // Add directional light to simulate light entering through windows/gaps
    const directionalLight = new THREE.DirectionalLight(0xffffcc, 1);
    directionalLight.position.set(0, 20, 0);
    this.third.scene.add(directionalLight);
  }
  
  // Add function to create the hanging barn lights
  addBarnLights(barnHeight, barnWidth, barnLength) {
    // Hanging light color
    const lightColor = 0x2a0060; // Dark purple for the lamp shade
    const lightIntensity = 0.7;
    
    // Create hanging lights across the barn ceiling
    const lightPositions = [
      { x: -barnWidth/3, y: barnHeight - 2, z: -barnLength/3 },
      { x: barnWidth/3, y: barnHeight - 2, z: -barnLength/3 },
      { x: -barnWidth/3, y: barnHeight - 2, z: 0 },
      { x: barnWidth/3, y: barnHeight - 2, z: 0 },
      { x: -barnWidth/3, y: barnHeight - 2, z: barnLength/3 },
      { x: barnWidth/3, y: barnHeight - 2, z: barnLength/3 },
      { x: 0, y: barnHeight - 2, z: -barnLength/4 },
      { x: 0, y: barnHeight - 2, z: barnLength/4 }
    ];
    
    // Create each hanging light
    lightPositions.forEach(pos => {
      // Create the hanging wire
      const wire = this.third.physics.add.box({
        width: 0.2,
        height: 9,
        depth: 0.2,
        x: pos.x,
        y: pos.y + 1.5,
        z: pos.z,
        name: 'lightWire',
        userData: { destructible: false }
      }, { lambert: { color: 0x000000 } });
      
      // Create dome-shaped lamp shade
      const lampShape = new THREE.SphereGeometry(2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const lampMaterial = new THREE.MeshLambertMaterial({ color: lightColor });
      const lampShade = new THREE.Mesh(lampShape, lampMaterial);
      
      lampShade.position.set(pos.x, pos.y - 4, pos.z);
      lampShade.rotation.y = Math.PI; // Flip it to create a hanging dome
      this.third.scene.add(lampShade);
      
      // Add a point light inside each lamp
      const light = new THREE.PointLight(0xaa60dd, lightIntensity, 15);
      light.position.set(pos.x, pos.y - 0.5, pos.z);
      this.third.scene.add(light);
      
      // Add subtle light flickering animation
      this.tweens.add({
        targets: { intensity: lightIntensity },
        intensity: lightIntensity - 0.2,
        duration: 1500 + Math.random() * 1000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        onUpdate: (tween, target) => {
          light.intensity = target.intensity;
        }
      });
      
      // Set wire as static
      if (wire.body) {
        wire.body.setCollisionFlags(2);
      }
    });
    
    // Add atmospheric light beams and dust particles
    this.addAtmosphericEffects(barnHeight, barnWidth, barnLength);
  }
  
  // Add atmospheric light beams and dust particles
  addAtmosphericEffects(barnHeight, barnWidth, barnLength) {
    // Add fog to the scene for a more atmospheric feel
    this.third.scene.fog = new THREE.FogExp2(0x8b20a0, 0.015);
    
    // Add a volumetric light effect (simulated with planes)
    const lightRayGeometry = new THREE.PlaneGeometry(5, 20);
    const lightRayMaterial = new THREE.MeshBasicMaterial({
      color: 0xaa60dd,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    // Create light rays at different positions
    const rayPositions = [
      { x: -barnWidth/4, y: barnHeight/2, z: -barnLength/4, rotation: 0.2 },
      { x: barnWidth/4, y: barnHeight/2, z: barnLength/4, rotation: -0.3 },
      { x: 0, y: barnHeight/2, z: 0, rotation: 0.1 }
    ];
    
    rayPositions.forEach(pos => {
      const lightRay = new THREE.Mesh(lightRayGeometry, lightRayMaterial);
      lightRay.position.set(pos.x, pos.y, pos.z);
      lightRay.rotation.y = pos.rotation;
      lightRay.rotation.x = Math.PI / 2;
      this.third.scene.add(lightRay);
      
      // Add slight movement animation
      this.tweens.add({
        targets: { opacity: 0.2 },
        opacity: 0.3,
        duration: 3000 + Math.random() * 2000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        onUpdate: (tween, target) => {
          lightRayMaterial.opacity = target.opacity;
        }
      });
    });
  }
  
  setupMinimap() {
    // Create second camera for minimap
    this.secondCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    this.third.add.existing(this.secondCamera);
    this.third.camera.add(this.secondCamera);
    
    // Position the minimap camera higher to capture the entire barn length
    this.secondCamera.position.set(0, 50, 0); // Higher position
    this.secondCamera.lookAt(0, 0, 0); // Look down at scene
    
    // Add a directional light for the minimap view to ensure visibility
    const minimapLight = new THREE.DirectionalLight(0xffffff, 1);
    minimapLight.position.set(0, 50, 0);
    minimapLight.target.position.set(0, 0, 0);
    this.third.scene.add(minimapLight);
    this.third.scene.add(minimapLight.target);
  }
  
  setupUI() {
    // Create a crosshair container
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    // Create the crosshair graphics object
    this.crosshair = this.add.graphics();
    this.crosshair.depth = 1;
    
    // Draw the crosshair (white circle with cross)
    this.drawCrosshair();
    
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
  
  drawCrosshair() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    const size = 30; // Size of the crosshair
    
    // Clear previous drawing
    this.crosshair.clear();
    
    // Set line style (white)
    this.crosshair.lineStyle(8, 0xFFFFFF, 1);
    
    // Draw circle
    this.crosshair.strokeCircle(centerX, centerY, size);
    
    // Draw horizontal line
    this.crosshair.beginPath();
    this.crosshair.moveTo(centerX - size, centerY);
    this.crosshair.lineTo(centerX - size/3, centerY);
    this.crosshair.closePath();
    this.crosshair.strokePath();

    this.crosshair.beginPath();
    this.crosshair.moveTo(centerX + size, centerY);
    this.crosshair.lineTo(centerX + size/3, centerY);
    this.crosshair.closePath();
    this.crosshair.strokePath();


    // Draw vertical line
    this.crosshair.beginPath();
    this.crosshair.moveTo(centerX, centerY - size);
    this.crosshair.lineTo(centerX, centerY - size/3);
    this.crosshair.closePath();
    this.crosshair.strokePath();

    this.crosshair.beginPath();
    this.crosshair.moveTo(centerX, centerY + size);
    this.crosshair.lineTo(centerX, centerY + size/3);
    this.crosshair.closePath();
    this.crosshair.strokePath();

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
    // this.third.renderer.setScissorTest(true);
    // this.third.renderer.setScissor(
    //   minimapX, 
    //   minimapY + safeAreaTop, 
    //   minimapSize, 
    //   minimapSize * 0.75
    // );
    // this.third.renderer.setViewport(
    //   minimapX, 
    //   minimapY + safeAreaTop, 
    //   minimapSize, 
    //   minimapSize * 0.75
    // );

    // this.third.renderer.render(this.third.scene, this.secondCamera);
    // this.third.renderer.setScissorTest(false);
  }

  update(time, delta) {
    // Player and weapon update
    if (this.playerController && this.weaponController) {
      // Update player movement and controls
      this.playerController.update(time, delta);
      
      // Update weapon position based on player movement
      const moveState = this.playerController.getMoveState();
      this.weaponController.updateRiflePosition(this.third.camera, moveState);
      
      // Update aiming state (controls crosshair visibility)
      const isAiming = this.isMobile && this.mobileController ? 
        this.mobileController.getAimStatus() : 
        this.input.mousePointer.rightButtonDown();
      
      // Toggle crosshair based on aiming
      if (this.crosshair) {
        this.crosshair.alpha = isAiming ? 0 : 1;
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
      
      // Check for nearby chickens to show focus message
      this.checkNearbyChickens();
    }
  }
  
  // Add method to check for nearby chickens and show focus message
  checkNearbyChickens() {
    // Only run every 60 frames to avoid constant checking
    if (this.frameCount % 60 !== 0) return;
    
    // Get player position from camera
    const playerPos = this.third.camera.position.clone();
    
    // Get all live chickens
    const chickens = this.chickenManager.getChickens().filter(chicken => 
      chicken.body && !chicken.body.isDestroyed);
    
    // Find closest chicken
    let closestChicken = null;
    let closestDistance = Infinity;
    
    chickens.forEach(chicken => {
      const distance = playerPos.distanceTo(chicken.position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestChicken = chicken;
      }
    });
    
    // If a chicken is nearby (within 10 units), show the focus message
    if (closestChicken && closestDistance < 10) {
      // Only show message occasionally to avoid spam
      if (Math.random() < 0.3 && window.showFocusMessage) {
        const focusTextElement = document.getElementById('focus-text');
        if (focusTextElement) {
          focusTextElement.textContent = closestDistance < 5 ? 
            "Focus on target!" : "Chicken detected nearby";
        }
        window.showFocusMessage();
      }
    }
  }
  
  shoot() {
    if (this.weaponController) {
      this.weaponController.shoot();
    }
  }
} 