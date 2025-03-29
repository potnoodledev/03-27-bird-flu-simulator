/**
 * MobileController.js
 * Handles all mobile-specific touch controls for the game
 */

export class MobileController {
  constructor(scene) {
    this.scene = scene;
    this.joystickMovement = { x: 0, y: 0 };
    this.isAiming = false;
    this.touchLook = { x: 0, y: 0 };
    this.joystickStatus = document.getElementById('joystick-status');
    this.movementInfo = document.getElementById('movement-info');
    this.debugMode = false;
  }

  init() {
    // Get DOM elements
    this.joystickArea = document.getElementById('joystick-area');
    this.joystick = document.getElementById('joystick');
    this.shootBtn = document.getElementById('shoot-btn');
    this.aimBtn = document.getElementById('aim-btn');
    
    // Setup event handlers
    this.setupJoystick();
    this.setupActionButtons();
    this.setupLookControls();
  }

  setupJoystick() {
    // Initialize joystick in center position
    this.centerJoystick();
    
    // Joystick controls
    let joystickActive = false;
    
    // Touch start for joystick
    this.joystickArea.addEventListener('touchstart', (event) => {
      event.preventDefault();
      joystickActive = true;
      this.updateJoystickPosition(event.touches[0]);
    });
    
    // Touch move for joystick
    this.joystickArea.addEventListener('touchmove', (event) => {
      if (joystickActive) {
        event.preventDefault();
        this.updateJoystickPosition(event.touches[0]);
      }
    });
    
    // Touch end for joystick
    this.joystickArea.addEventListener('touchend', (event) => {
      event.preventDefault();
      joystickActive = false;
      this.centerJoystick();
      this.joystickMovement.x = 0;
      this.joystickMovement.y = 0;
      
      if (this.joystickStatus) {
        this.joystickStatus.textContent = "Joystick: x=0.00, y=0.00";
      }
      if (this.movementInfo) {
        this.movementInfo.textContent = "Movement: NONE";
      }
    });
    
    this.joystickArea.addEventListener('touchcancel', (event) => {
      event.preventDefault();
      joystickActive = false;
      this.centerJoystick();
      this.joystickMovement.x = 0;
      this.joystickMovement.y = 0;
      
      if (this.joystickStatus) {
        this.joystickStatus.textContent = "Joystick: x=0.00, y=0.00";
      }
      if (this.movementInfo) {
        this.movementInfo.textContent = "Movement: NONE";
      }
    });
  }

  centerJoystick() {
    this.joystick.style.left = (this.joystickArea.offsetWidth / 2 - this.joystick.offsetWidth / 2) + 'px';
    this.joystick.style.top = (this.joystickArea.offsetHeight / 2 - this.joystick.offsetHeight / 2) + 'px';
  }

  updateJoystickPosition(touch) {
    const rect = this.joystickArea.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate distance from center
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    
    // Limit to joystick area radius
    const maxRadius = rect.width / 2 - this.joystick.offsetWidth / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    
    // Update joystick visual position
    this.joystick.style.left = (rect.width / 2 - this.joystick.offsetWidth / 2 + dx) + 'px';
    this.joystick.style.top = (rect.height / 2 - this.joystick.offsetHeight / 2 + dy) + 'px';
    
    // Update movement values (-1 to 1)
    this.joystickMovement.x = dx / maxRadius;
    this.joystickMovement.y = dy / maxRadius;
    
    // Update debug display if debug mode is enabled
    if (this.joystickStatus && this.scene.debugMode) {
      this.joystickStatus.textContent = `Joystick: x=${this.joystickMovement.x.toFixed(2)}, y=${this.joystickMovement.y.toFixed(2)}`;
    }
    
    // Determine movement direction based on joystick position
    if (this.movementInfo && this.scene.debugMode) {
      let directionText = "Movement: ";
      if (Math.abs(this.joystickMovement.y) > 0.2) {
        directionText += this.joystickMovement.y < 0 ? "FORWARD" : "BACKWARD";
      }
      if (Math.abs(this.joystickMovement.x) > 0.2) {
        directionText += this.joystickMovement.x < 0 ? " LEFT" : " RIGHT";
      }
      if (Math.abs(this.joystickMovement.y) <= 0.2 && Math.abs(this.joystickMovement.x) <= 0.2) {
        directionText += "NONE";
      }
      this.movementInfo.textContent = directionText;
    }
  }

  setupActionButtons() {
    // Shooting button
    this.shootBtn.addEventListener('touchstart', (event) => {
      event.preventDefault();
      this.scene.shoot();
    });
    
    // Aiming button
    this.aimBtn.addEventListener('touchstart', (event) => {
      event.preventDefault();
      this.isAiming = true;
    });
    
    this.aimBtn.addEventListener('touchend', (event) => {
      event.preventDefault();
      this.isAiming = false;
    });
  }

  setupLookControls() {
    // Touch look controls (for camera rotation)
    let lastX = 0;
    let lastY = 0;
    let lookActive = false;
    
    // Make the entire right side of screen rotate camera
    document.addEventListener('touchstart', (event) => {
      const touch = event.touches[0];
      if (touch.clientX > window.innerWidth / 2) {
        lookActive = true;
        lastX = touch.clientX;
        lastY = touch.clientY;
        event.preventDefault();
      }
    }, { passive: false });
    
    document.addEventListener('touchmove', (event) => {
      if (lookActive) {
        const touch = event.touches[0];
        
        // Calculate movement deltas
        const dx = touch.clientX - lastX;
        const dy = touch.clientY - lastY;
        
        // Update camera based on touch movement
        this.scene.firstPersonControls.update(dx * 1.5, dy * 1.5);
        
        // Store last position
        lastX = touch.clientX;
        lastY = touch.clientY;
        
        event.preventDefault();
      }
    }, { passive: false });
    
    document.addEventListener('touchend', (event) => {
      if (lookActive) {
        lookActive = false;
        event.preventDefault();
      }
    }, { passive: false });
  }

  getMovement() {
    return this.joystickMovement;
  }

  getAimStatus() {
    return this.isAiming;
  }
} 