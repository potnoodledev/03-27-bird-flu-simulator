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

    // Isometric view state
    this.isIsometricView = false;
    this.originalCameraPosition = new THREE.Vector3();
    this.originalCameraQuaternion = new THREE.Quaternion();
    this.isometricPosition = new THREE.Vector3(50, 80, 80); // Position for isometric view
    this.isometricLookAt = new THREE.Vector3(0, 0, -20);   // Point camera looks at (center of barn area)
    this.playerMarker = null; // Will hold the mesh representing the player in isometric view
    this.weaponController = null; // Initialize as null, will be set later
    
    // Isometric view camera controls
    this.isoDragging = false;
    this.isoStartPoint = new THREE.Vector2();
    this.isoStartRotation = new THREE.Euler();
    this.isoRotationSpeed = 0.01;
    this.isoPanSpeed = 0.5;
    this.isoZoomSpeed = 1.0;
    this.isoMinZoom = 30;
    this.isoMaxZoom = 150;
    
    // Store isometric camera orientation
    this.isoOrbitRadius = 120; // Distance from target
    this.isoOrbitTheta = Math.PI/4; // Horizontal angle
    this.isoOrbitPhi = Math.PI/6;   // Vertical angle
    
    // Create chicken count element reference for displaying under it
    this.chickenCountElement = null;
    this.cameraInfoElement = null;
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
      e: this.scene.input.keyboard.addKey('e'),
      z: this.scene.input.keyboard.addKey('z'), // Add Z key
      arrowUp: this.scene.input.keyboard.addKey('UP'),
      arrowDown: this.scene.input.keyboard.addKey('DOWN'),
      arrowLeft: this.scene.input.keyboard.addKey('LEFT'),
      arrowRight: this.scene.input.keyboard.addKey('RIGHT')
    };
    
    // Store original camera state for toggling
    this.originalCameraPosition.copy(this.scene.third.camera.position);
    this.originalCameraQuaternion.copy(this.scene.third.camera.quaternion);
    
    // Create the camera info HUD element
    this.createCameraInfoElement();

    return this.player;
  }

  createCameraInfoElement() {
    // Find the chicken count element or create one if needed
    this.chickenCountElement = document.querySelector('.chicken-goal');
    
    // Create camera info element
    this.cameraInfoElement = document.createElement('div');
    this.cameraInfoElement.id = 'camera-info';
    this.cameraInfoElement.textContent = 'Camera: x=0, y=0, z=0, θ=0°, φ=0°';
    
    // Insert after chicken count
    const infoText = document.getElementById('info-text');
    if (infoText) {
      infoText.appendChild(this.cameraInfoElement);
    }
  }

  setupDesktopControls() {
    // Desktop controls
    // lock the pointer and update the first person control
    this.scene.input.on('pointerdown', (pointer) => {
      if (this.isIsometricView) {
        // Start isometric camera rotation/panning
        this.isoDragging = true;
        this.isoStartPoint.set(pointer.x, pointer.y);
        
        // Store camera rotation at the start of drag
        this.isoStartRotation.copy(this.scene.third.camera.rotation);
      } else {
        this.scene.input.mouse.requestPointerLock();
      }
    });
    
    this.scene.input.on('pointerup', () => {
      // Stop isometric dragging
      this.isoDragging = false;
    });
    
    this.scene.input.on('pointermove', pointer => {
      if (this.scene.input.mouse.locked && !this.isIsometricView) {
        this.firstPersonControls.update(pointer.movementX, pointer.movementY);
      } else if (this.isIsometricView && this.isoDragging) {
        // Handle isometric view camera rotation with mouse
        const deltaX = pointer.x - this.isoStartPoint.x;
        const deltaY = pointer.y - this.isoStartPoint.y;
        
        if (pointer.rightButtonDown()) {
          // Pan camera when right mouse button is held down
          this.panIsometricCamera(deltaX, deltaY);
        } else {
          // Rotate camera when left mouse button is held down
          this.rotateIsometricCamera(deltaX, deltaY);
        }
        
        // Update start point for next movement
        this.isoStartPoint.set(pointer.x, pointer.y);
      }
    });
    
    // Add mouse wheel zoom for isometric view
    window.addEventListener('wheel', (event) => {
      if (this.isIsometricView) {
        const delta = -Math.sign(event.deltaY) * this.isoZoomSpeed * 5;
        this.zoomIsometricCamera(delta);
        event.preventDefault();
      }
    }, { passive: false });
    
    this.scene.events.on('update', () => {
        if (!this.isIsometricView) {
           this.firstPersonControls.update(0, 0);
        }
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
        if (this.isIsometricView) {
          // For isometric view, use primary touch for camera control
          this.isoDragging = true;
          this.isoStartPoint.set(e.touches[0].clientX, e.touches[0].clientY);
          this.isoStartRotation.copy(this.scene.third.camera.rotation);
        } else {
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
      }
    }, { passive: false });

    gameCanvas.addEventListener('touchmove', (e) => {
      // Prevent default to stop scrolling
      e.preventDefault();
      
      if (this.isIsometricView && this.isoDragging && e.touches.length >= 1) {
        // Handle isometric camera control with touch
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.isoStartPoint.x;
        const deltaY = touch.clientY - this.isoStartPoint.y;
        
        // Use single-finger touches for rotation
        this.rotateIsometricCamera(deltaX, deltaY);
        
        // Update start position for next move
        this.isoStartPoint.set(touch.clientX, touch.clientY);
      } else if (!this.isIsometricView && this.isTouchActive && this.touchIsRightSide) {
        // Look for the right-side touch that controls the camera
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
      if (this.isIsometricView) {
        // End dragging when all touches end
        if (e.touches.length === 0) {
          this.isoDragging = false;
        }
      } else {
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
      }
    });
    
    // Handle pinch to zoom in isometric view
    let initialPinchDistance = 0;
    
    gameCanvas.addEventListener('touchstart', (e) => {
      if (this.isIsometricView && e.touches.length === 2) {
        // Get initial distance between two fingers
        initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });
    
    gameCanvas.addEventListener('touchmove', (e) => {
      if (this.isIsometricView && e.touches.length === 2) {
        // Calculate new distance between fingers
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        
        // Calculate zoom amount based on pinch gesture
        if (initialPinchDistance > 0) {
          const delta = (currentDistance - initialPinchDistance) * 0.1;
          this.zoomIsometricCamera(delta);
          
          // Update initial distance for next move
          initialPinchDistance = currentDistance;
        }
      }
    });
    
    // Make sure controls stay updated
    this.scene.events.on('update', () => {
      if (!this.isIsometricView) {
           this.firstPersonControls.update(0, 0);
       }
    });
  }

  // Rotate the isometric camera based on mouse/touch input
  rotateIsometricCamera(deltaX, deltaY) {
    // Update orbital angles
    this.isoOrbitTheta -= deltaX * this.isoRotationSpeed * 0.01;
    this.isoOrbitPhi = Math.max(0.1, Math.min(Math.PI/2 - 0.1, this.isoOrbitPhi - deltaY * this.isoRotationSpeed * 0.01));
    
    // Update camera position based on new angles
    this.updateIsometricCameraPosition();
  }
  
  // Pan the isometric camera based on mouse/touch input
  panIsometricCamera(deltaX, deltaY) {
    // Create vectors for camera's right and up directions
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    
    // Apply camera rotation to these vectors
    right.applyQuaternion(this.scene.third.camera.quaternion);
    up.applyQuaternion(this.scene.third.camera.quaternion);
    
    // Remove any y component from right vector to keep panning level
    right.y = 0;
    right.normalize();
    
    // Scale vectors by delta movement and pan speed
    right.multiplyScalar(-deltaX * this.isoPanSpeed * 0.1);
    up.multiplyScalar(deltaY * this.isoPanSpeed * 0.1);
    
    // Move both the camera and lookAt target
    this.isometricLookAt.add(right);
    this.isometricLookAt.add(up);
    
    // Update camera position
    this.updateIsometricCameraPosition();
  }
  
  // Zoom the isometric camera in or out
  zoomIsometricCamera(delta) {
    // Adjust orbit radius based on delta, with min/max boundaries
    this.isoOrbitRadius = Math.max(this.isoMinZoom, 
                           Math.min(this.isoMaxZoom, 
                           this.isoOrbitRadius - delta));
    
    // Update camera position
    this.updateIsometricCameraPosition();
  }
  
  // Update camera position based on current orbit params
  updateIsometricCameraPosition() {
    const camera = this.scene.third.camera;
    
    // Calculate camera position in spherical coordinates
    const x = this.isoOrbitRadius * Math.sin(this.isoOrbitPhi) * Math.cos(this.isoOrbitTheta);
    const y = this.isoOrbitRadius * Math.cos(this.isoOrbitPhi);
    const z = this.isoOrbitRadius * Math.sin(this.isoOrbitPhi) * Math.sin(this.isoOrbitTheta);
    
    // Set camera position relative to look target
    camera.position.set(
      this.isometricLookAt.x + x,
      this.isometricLookAt.y + y,
      this.isometricLookAt.z + z
    );
    
    // Look at the target
    camera.lookAt(this.isometricLookAt);
    camera.updateProjectionMatrix();
    
    // Update HUD with camera info
    this.updateCameraInfoDisplay();
  }
  
  // Update the camera information in the HUD
  updateCameraInfoDisplay() {
    const camera = this.scene.third.camera;
    
    // Format rotation angles in degrees
    const rotX = (camera.rotation.x * 180 / Math.PI).toFixed(0);
    const rotY = (camera.rotation.y * 180 / Math.PI).toFixed(0);
    const rotZ = (camera.rotation.z * 180 / Math.PI).toFixed(0);
    
    // Format orbital angles in degrees
    const orbitTheta = ((this.isoOrbitTheta * 180 / Math.PI) % 360).toFixed(0);
    const orbitPhi = (this.isoOrbitPhi * 180 / Math.PI).toFixed(0);
    
    // Update HUD text
    if (this.cameraInfoElement) {
      this.cameraInfoElement.textContent = 
        `Camera: x=${camera.position.x.toFixed(0)}, y=${camera.position.y.toFixed(0)}, z=${camera.position.z.toFixed(0)}, θ=${orbitTheta}°, φ=${orbitPhi}°`;
    }
    
    // Also update debug panel if in debug mode
    if (this.scene.debugMode) {
      if (this.cameraDirection) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        this.cameraDirection.textContent = `Camera Direction: x=${direction.x.toFixed(2)}, y=${direction.y.toFixed(2)}, z=${direction.z.toFixed(2)}, θ=${orbitTheta}°`;
      }
      
      if (this.cameraRotation) {
        this.cameraRotation.textContent = `Camera Rotation: x=${rotX}°, y=${rotY}°, z=${rotZ}°`;
      }
    }
  }

  setMobileController(mobileController) {
    this.mobileController = mobileController;
  }

  setWeaponController(weaponController) {
    this.weaponController = weaponController;
  }

  update(time, delta) {
    if (!this.player) return;
    
    // Check for 'Z' key press to toggle view BEFORE movement updates
    // Use justDown to trigger only once per press
    if (this.keys.z.isDown && !this.zKeyPressedLastFrame) {
        this.toggleIsometricView();
    }
    this.zKeyPressedLastFrame = this.keys.z.isDown; // Track key state

    // Handle keyboard controls for isometric camera
    if (this.isIsometricView) {
      // Rotation with arrow keys
      const rotateAmount = 0.03;
      if (this.keys.arrowLeft.isDown) {
        this.isoOrbitTheta += rotateAmount;
        this.updateIsometricCameraPosition();
      }
      if (this.keys.arrowRight.isDown) {
        this.isoOrbitTheta -= rotateAmount;
        this.updateIsometricCameraPosition();
      }
      if (this.keys.arrowUp.isDown) {
        this.isoOrbitPhi = Math.max(0.1, this.isoOrbitPhi - rotateAmount);
        this.updateIsometricCameraPosition();
      }
      if (this.keys.arrowDown.isDown) {
        this.isoOrbitPhi = Math.min(Math.PI/2 - 0.1, this.isoOrbitPhi + rotateAmount);
        this.updateIsometricCameraPosition();
      }
      
      // Panning with WASD
      const panAmount = 1.0;
      if (this.keys.w.isDown) {
        this.isometricLookAt.z -= panAmount;
        this.updateIsometricCameraPosition();
      }
      if (this.keys.s.isDown) {
        this.isometricLookAt.z += panAmount;
        this.updateIsometricCameraPosition();
      }
      if (this.keys.a.isDown) {
        this.isometricLookAt.x -= panAmount;
        this.updateIsometricCameraPosition();
      }
      if (this.keys.d.isDown) {
        this.isometricLookAt.x += panAmount;
        this.updateIsometricCameraPosition();
      }
      
      // Zoom with Q/E
      const zoomAmount = 3.0;
      if (this.keys.q.isDown) {
        this.zoomIsometricCamera(zoomAmount); // Zoom in
      }
      if (this.keys.e.isDown) {
        this.zoomIsometricCamera(-zoomAmount); // Zoom out
      }
      
      // Update player marker position
      if (this.playerMarker) {
        this.playerMarker.position.copy(this.player.position);
      }
      
      // Make sure camera info is updated
      this.updateCameraInfoDisplay();
      
      return; // Exit update early
    }
    
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
      
      // Force camera to update with player position only if not isometric
      if (!this.isIsometricView && this.firstPersonControls && this.firstPersonControls.enabled) {
          this.firstPersonControls.update(0, 0, true);
      }
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

  toggleIsometricView() {
    const camera = this.scene.third.camera;

    if (!this.isIsometricView) {
        // Switching TO isometric view
        
        // Create player marker if it doesn't exist
        if (!this.playerMarker) {
            const geometry = new THREE.SphereGeometry(1, 16, 16); // Simple sphere marker
            const material = new THREE.MeshLambertMaterial({ color: 0xff0000 }); // Red color
            this.playerMarker = new THREE.Mesh(geometry, material);
            this.playerMarker.castShadow = true;
            this.playerMarker.receiveShadow = true;
            this.playerMarker.layers.set(1); // Set marker to layer 1
            this.scene.third.add.existing(this.playerMarker);
        }

        // Store current first-person state BEFORE changing
        this.originalCameraPosition.copy(this.player.position); // Store player position as reference
        this.originalCameraQuaternion.copy(camera.quaternion);

        // Set initial isometric target to look at the player
        this.isometricLookAt.copy(this.player.position);
        
        // Initialize orbit parameters
        this.isoOrbitRadius = 120;
        this.isoOrbitTheta = Math.PI/4;  // 45 degrees
        this.isoOrbitPhi = Math.PI/6;    // 30 degrees
        
        // Set camera position based on orbital parameters
        this.updateIsometricCameraPosition();

        // Disable first person controls and hide weapon, show marker
        if (this.firstPersonControls) {
            this.firstPersonControls.enabled = false;
        }
        if (this.weaponController && this.weaponController.getRifle()) {
            this.weaponController.getRifle().visible = false;
        }
        if (this.playerMarker) {
             this.playerMarker.position.copy(this.player.position); // Set initial position
             this.playerMarker.visible = true;
        }

        this.isIsometricView = true;
        console.log("Switched to Isometric View");
    } else {
        // Switching BACK to first-person view
        // Restore camera position relative to the player
        camera.position.copy(this.player.position); // Reset camera to player position
        camera.quaternion.copy(this.originalCameraQuaternion); // Restore original rotation
        camera.updateProjectionMatrix();

        // Re-enable first person controls, show weapon, hide marker
        if (this.firstPersonControls) {
            this.firstPersonControls.enabled = true;
             // Force update controls to sync camera with player immediately
            this.firstPersonControls.update(0, 0, true);
        }
        if (this.weaponController && this.weaponController.getRifle()) {
            this.weaponController.getRifle().visible = true;
        }
        if (this.playerMarker) {
            this.playerMarker.visible = false;
        }

        this.isIsometricView = false;
        console.log("Switched back to First-Person View");
    }
    
    // Update HUD with camera info
    this.updateCameraInfoDisplay();
  }
} 