/**
 * PlayerController.js
 * Handles player movement, controls, and camera management
 */

import { THREE, ExtendedObject3D, FirstPersonControls } from '../lib/enable3d.js';

export class PlayerController {
  constructor(scene) {
    this.scene = scene;
    this.player = null;
    this.firstPersonControls = null;
    this.keys = null;
    this.move = { x: 0, y: 0, z: 0 };
    this.mobileController = null;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.playerPosition = document.getElementById('player-position');
    this.cameraDirection = document.getElementById('camera-direction');
    this.cameraRotation = document.getElementById('camera-rotation');
    // Touch control variables
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.touchSensitivity = 1.0; // Adjust this value to make camera more/less sensitive
    this.isTouchActive = false;
    // Add a touch area flag to distinguish between joystick and camera areas
    this.touchIsRightSide = false;
  }

  init() {
    // Add player
    this.player = new ExtendedObject3D();
    
    // Position player at the other end of the barn
    // The barn is 80 units long in Z direction with the entrance at the +Z side
    this.player.position.set(0, 2, -35); // At the opposite end of the barn from the entrance
    this.scene.third.add.existing(this.player);
    
    // Add first person controls with explicit update option
    this.firstPersonControls = new FirstPersonControls(this.scene.third.camera, this.player, {
      pointerLock: !this.isMobile,
      enableZoom: false
    });
    
    // Position camera at player position
    this.scene.third.camera.position.copy(this.player.position);
    
    // Set player's initial rotation to face toward the entrance
    this.player.rotation.y = 0; // Now facing +Z direction (toward entrance)
    
    // Force camera to look toward the entrance
    this.scene.third.camera.rotation.y = 0; // Look toward +Z direction
    
    // Force the camera update
    this.firstPersonControls.update(0, 0, true);
    
    // Double-check that camera is facing the right direction after everything is initialized
    if (this.scene.events) {
      this.scene.events.once('update', () => {
        this.scene.third.camera.rotation.y = 0;
        this.firstPersonControls.update(0, 0, true);
      });
    }
    
    // Setup control method based on device
    if (!this.isMobile) {
      this.setupDesktopControls();
    } else {
      this.setupMobileControls();
    }
    
    // Add keyboard keys for desktop
    this.keys = {
      w: this.scene.input.keyboard.addKey('w'),
      a: this.scene.input.keyboard.addKey('a'),
      s: this.scene.input.keyboard.addKey('s'),
      d: this.scene.input.keyboard.addKey('d'),
      q: this.scene.input.keyboard.addKey('q'),
      e: this.scene.input.keyboard.addKey('e')
    };
    
    return this.player;
  }

  setupDesktopControls() {
    // Desktop controls
    // lock the pointer and update the first person control
    this.scene.input.on('pointerdown', () => {
      this.scene.input.mouse.requestPointerLock();
    });
    
    this.scene.input.on('pointermove', pointer => {
      if (this.scene.input.mouse.locked) {
        this.firstPersonControls.update(pointer.movementX, pointer.movementY);
      }
    });
    
    this.scene.events.on('update', () => {
      this.firstPersonControls.update(0, 0);
    });
  }

  setupMobileControls() {
    // Use Phaser's touch events for camera control
    const gameCanvas = this.scene.sys.game.canvas;
    
    // Set up touch events for camera rotation
    gameCanvas.addEventListener('touchstart', (e) => {
      // Prevent default to stop scrolling
      e.preventDefault();
      
      // Store initial touch position for calculating swipe movement
      if (e.touches.length >= 1) {
        // Find the rightmost touch that isn't on the left third of the screen
        // This allows the joystick (usually on left side) to work simultaneously
        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          const touchX = touch.clientX;
          
          // Consider touch to be for camera control if it's on the right 2/3 of screen
          if (touchX > gameCanvas.clientWidth / 3) {
            this.lastTouchX = touchX;
            this.lastTouchY = touch.clientY;
            this.isTouchActive = true;
            this.touchIsRightSide = true;
            break;
          }
        }
      }
    }, { passive: false });

    gameCanvas.addEventListener('touchmove', (e) => {
      // Prevent default to stop scrolling
      e.preventDefault();
      
      // Look for the right-side touch that controls the camera
      if (this.isTouchActive && this.touchIsRightSide) {
        let foundActiveTouch = false;
        
        // Find the correct touch point (the one on the right side)
        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          const touchX = touch.clientX;
          
          // Only process touches on the right 2/3 of screen
          if (touchX > gameCanvas.clientWidth / 3) {
            // Calculate movement deltas
            const movementX = (touchX - this.lastTouchX) * this.touchSensitivity * 2.5; // Increased sensitivity
            const movementY = (touch.clientY - this.lastTouchY) * this.touchSensitivity * 2.5; // Increased sensitivity
            
            // Update camera based on touch movement
            this.firstPersonControls.update(movementX, movementY, true);
            
            // Store current touch position for next move event
            this.lastTouchX = touchX;
            this.lastTouchY = touch.clientY;
            foundActiveTouch = true;
            break;
          }
        }
        
        // If we didn't find the active touch, it may have moved to the left side or been removed
        if (!foundActiveTouch) {
          this.isTouchActive = false;
          this.touchIsRightSide = false;
        }
      }
    }, { passive: false });

    gameCanvas.addEventListener('touchend', (e) => {
      // Check if there are any remaining touches on the right side
      let rightSideTouchFound = false;
      
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].clientX > gameCanvas.clientWidth / 3) {
          rightSideTouchFound = true;
          break;
        }
      }
      
      // If no more touches on right side, deactivate camera control
      if (!rightSideTouchFound) {
        this.isTouchActive = false;
        this.touchIsRightSide = false;
      }
    });
    
    // Make sure controls stay updated
    this.scene.events.on('update', () => {
      this.firstPersonControls.update(0, 0);
    });
  }

  setMobileController(mobileController) {
    this.mobileController = mobileController;
  }

  update(time, delta) {
    if (!this.player) return;
    
    // Get direction from camera for debug info
    const direction = new THREE.Vector3();
    const rotation = this.scene.third.camera.getWorldDirection(direction);
    const theta = Math.atan2(rotation.x, rotation.z);
    
    // Update debug info
    if (this.scene.debugMode) {
      // Player position debug info
      if (this.playerPosition) {
        this.playerPosition.textContent = `Position: x=${this.player.position.x.toFixed(2)}, y=${this.player.position.y.toFixed(2)}, z=${this.player.position.z.toFixed(2)}`;
      }
      
      // Camera direction debug info
      if (this.cameraDirection) {
        this.cameraDirection.textContent = `Camera Direction: x=${direction.x.toFixed(2)}, y=${direction.y.toFixed(2)}, z=${direction.z.toFixed(2)}, θ=${theta.toFixed(2)}`;
      }
      
      // Camera rotation debug info
      if (this.cameraRotation) {
        const euler = new THREE.Euler().setFromQuaternion(this.scene.third.camera.quaternion);
        this.cameraRotation.textContent = `Camera Rotation: x=${(euler.x * 180 / Math.PI).toFixed(2)}°, y=${(euler.y * 180 / Math.PI).toFixed(2)}°, z=${(euler.z * 180 / Math.PI).toFixed(2)}°`;
      }
    }
    
    // Calculate actual delta for smoother movement
    const dt = delta / 1000; // Convert to seconds
    const speed = 6 * dt; // Base speed (units per second)
    
    // Flag to track if player moved this frame
    let playerMoved = false;
    let moveVector = new THREE.Vector3(0, 0, 0);

    // Handle movement based on device type
    if (this.isMobile && this.mobileController) {
      // Get joystick values from mobile controller
      const joystickMovement = this.mobileController.getMovement();
      
      // Apply a deadzone to prevent drift
      const deadzone = 0.15;
      const joystickX = Math.abs(joystickMovement.x) > deadzone ? joystickMovement.x : 0;
      const joystickY = Math.abs(joystickMovement.y) > deadzone ? joystickMovement.y : 0;
      
      // Forward/backward movement (inverted Y axis from joystick)
      if (joystickY !== 0) {
        // Invert Y axis (up is negative in the joystick, but should move forward)
        const moveSpeed = speed * 2.0 * -joystickY; // Increased speed
        moveVector.x += Math.sin(theta) * moveSpeed;
        moveVector.z += Math.cos(theta) * moveSpeed;
        playerMoved = true;
      }
      
      // Strafe left/right movement
      if (joystickX !== 0) {
        const strafeSpeed = speed * 2.0 * -joystickX; // Invert joystickX to fix direction
        moveVector.x += Math.sin(theta + Math.PI * 0.5) * strafeSpeed;
        moveVector.z += Math.cos(theta + Math.PI * 0.5) * strafeSpeed;
        playerMoved = true;
      }
    } else {
      // Desktop keyboard movement
      // Move forwards and backwards
      if (this.keys.w.isDown) {
        moveVector.x += Math.sin(theta) * speed;
        moveVector.z += Math.cos(theta) * speed;
        playerMoved = true;
      } else if (this.keys.s.isDown) {
        moveVector.x -= Math.sin(theta) * speed;
        moveVector.z -= Math.cos(theta) * speed;
        playerMoved = true;
      }

      // Move sideways
      if (this.keys.a.isDown) {
        moveVector.x += Math.sin(theta + Math.PI * 0.5) * speed;
        moveVector.z += Math.cos(theta + Math.PI * 0.5) * speed;
        playerMoved = true;
      } else if (this.keys.d.isDown) {
        moveVector.x += Math.sin(theta - Math.PI * 0.5) * speed;
        moveVector.z += Math.cos(theta - Math.PI * 0.5) * speed;
        playerMoved = true;
      }
      
      // Handle tilt with Q/E keys
      if (this.keys.q.isDown) {
        this.scene.third.camera.rotateZ(0.02);
        this.firstPersonControls.offset = new THREE.Vector3(
          Math.sin(theta + Math.PI * 0.5) * 0.4,
          0,
          Math.cos(theta + Math.PI * 0.5) * 0.4
        );
      } else if (this.keys.e.isDown) {
        this.scene.third.camera.rotateZ(-0.02);
        this.firstPersonControls.offset = new THREE.Vector3(
          Math.sin(theta - Math.PI * 0.5) * 0.4,
          0,
          Math.cos(theta - Math.PI * 0.5) * 0.4
        );
      } else {
        this.scene.third.camera.rotateZ(0);
        this.firstPersonControls.offset = new THREE.Vector3(0, 0, 0);
      }
    }
    
    // Apply movement vector to player position if there was movement
    if (playerMoved) {
      this.player.position.x += moveVector.x;
      this.player.position.z += moveVector.z;
      
      // Force camera to update with player position
      this.firstPersonControls.update(0, 0, true);
    }
    
    // Update weapon sway based on movement
    if (playerMoved || (this.isMobile && this.mobileController && this.mobileController.getAimStatus())) {
      this.updateWeaponSway(time, this.mobileController?.getAimStatus() || this.scene.input.mousePointer.rightButtonDown());
    } else {
      this.updateIdleWeaponSway(time);
    }
  }
  
  updateWeaponSway(time, isAiming) {
    if (isAiming) {
      // Aiming position - more stable, raised position
      this.move.x = THREE.MathUtils.lerp(this.move.x, 0.6, 0.2);
      this.move.y = THREE.MathUtils.lerp(this.move.y, -0.8 + 1.8, 0.2);
      this.move.z = THREE.MathUtils.lerp(this.move.z, -0.45, 0.2);
    } else {
      // Walking sway
      this.move.x = Math.sin(time * -0.015) * 0.075;
      this.move.y = Math.sin(time * 0.015) * 0.075;
      this.move.z = Math.sin(time * 0.015) * 0.075;
    }
  }
  
  updateIdleWeaponSway(time) {
    // Subtle idle sway
    this.move.x = Math.sin(time * -0.003) * 0.01;
    this.move.y = Math.sin(time * 0.003) * 0.01;
    this.move.z = Math.sin(time * 0.003) * 0.01;
  }
  
  getMoveState() {
    return this.move;
  }
  
  getPlayer() {
    return this.player;
  }
  
  getControls() {
    return this.firstPersonControls;
  }
} 