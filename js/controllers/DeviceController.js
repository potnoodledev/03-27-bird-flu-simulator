/**
 * DeviceController.js
 * Handles device detection and UI setup based on device type
 */

export class DeviceController {
  constructor(scene) {
    this.scene = scene;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.debugMode = false;
    this.debugPanel = document.getElementById('debug-panel');
  }

  setupDeviceSpecificUI() {
    // Show/hide appropriate controls based on device
    const mobileControls = document.getElementById('mobile-controls');
    const desktopControlsInfo = document.querySelector('.desktop-controls');
    const mobileControlsInfo = document.querySelector('.mobile-controls');
    const isometricControlsInfo = document.querySelector('.isometric-controls');
    
    if (this.isMobile) {
      mobileControls.style.display = 'block';
      desktopControlsInfo.style.display = 'none';
      mobileControlsInfo.style.display = 'inline';
      // Hide detailed isometric controls on mobile, these are included in mobile controls text
      if (isometricControlsInfo) {
        isometricControlsInfo.style.display = 'none';
      }
    } else {
      mobileControls.style.display = 'none';
      desktopControlsInfo.style.display = 'inline';
      mobileControlsInfo.style.display = 'none';
      // Show isometric controls on desktop
      if (isometricControlsInfo) {
        isometricControlsInfo.style.display = 'inline';
      }
    }
    
    // Set debug panel visibility based on debug mode
    this.debugPanel.style.display = this.debugMode ? 'block' : 'none';
    
    // Add debug toggle key (D key)
    this.scene.input.keyboard.on('keydown-D', () => {
      this.toggleDebugMode();
    });
    
    // Add touch-based debug toggle (triple tap top-right corner)
    this.setupDebugTapDetection();
  }
  
  setupDebugTapDetection() {
    let tapCount = 0;
    let lastTapTime = 0;
    
    document.addEventListener('touchend', (event) => {
      const touch = event.changedTouches[0];
      const now = new Date().getTime();
      const corner = touch.clientX > window.innerWidth * 0.8 && touch.clientY < window.innerHeight * 0.2;
      
      if (corner) {
        if (now - lastTapTime < 500) { // Within 500ms
          tapCount++;
          if (tapCount >= 3) { // Triple tap
            this.toggleDebugMode();
            tapCount = 0;
          }
        } else {
          tapCount = 1;
        }
        lastTapTime = now;
      }
    });
  }
  
  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    this.debugPanel.style.display = this.debugMode ? 'block' : 'none';
    this.scene.debugMode = this.debugMode;
  }
  
  handleResize() {
    // Get actual window dimensions
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Update camera aspect ratio
    this.scene.third.camera.aspect = width / height;
    this.scene.third.camera.updateProjectionMatrix();
    
    // Update second camera if it exists
    if (this.scene.secondCamera) {
      this.scene.secondCamera.aspect = width / height;
      this.scene.secondCamera.updateProjectionMatrix();
    }
    
    // Update renderer and make sure it takes full screen
    this.scene.third.renderer.setSize(width, height);
    
    // Update scene size
    this.scene.scale.resize(width, height);
    
    // Update UI positions
    if (this.scene.chickensRemainingText) {
      // Position text based on screen size
      const isSmallScreen = width < 375 || height < 600;
      const topOffset = isSmallScreen ? 5 : 10;
      const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0');
      
      // Position text at the top, respecting safe area
      this.scene.chickensRemainingText.setPosition(10, topOffset + safeAreaTop);
      this.scene.chickensRemainingText.setFontSize(isSmallScreen ? '18px' : '24px');
    }
    
    // Redraw crosshair - always centered
    if (this.scene.crosshair) {
      this.scene.drawCrosshair();
    }
    
    // Force camera to update with player position if it exists
    if (this.scene.playerController && this.scene.playerController.getControls()) {
      this.scene.playerController.getControls().update(0, 0, true);
    }
  }
  
  isOnMobile() {
    return this.isMobile;
  }
  
  isDebugModeEnabled() {
    return this.debugMode;
  }
} 