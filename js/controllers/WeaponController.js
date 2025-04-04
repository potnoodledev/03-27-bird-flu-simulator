/**
 * WeaponController.js
 * Handles weapon behavior, shooting mechanics, and bullet physics
 */

import { THREE, ExtendedObject3D } from '../lib/enable3d.js';

export class WeaponController {
  constructor(scene) {
    this.scene = scene;
    this.rifle = null;
    this.bullets = [];
    this.infectedTexture = null;
    this.loadInfectedTexture();
    
    // Firing rate controls
    this.fireRate = 10; // Shots per second (fire at 1/3 the normal rate)
    this.lastFired = 0; // Timestamp of the last shot
    this.cooldownTime = 1000 / this.fireRate; // Milliseconds between shots
  }

  loadInfectedTexture() {
    // Load the infected texture
    this.infectedTexture = new THREE.TextureLoader().load('assets/infected.png');
  }

  loadWeapon() {
    return this.scene.third.load.gltf('assets/glb/chicken.glb').then(object => {
      const rifle = object.scene;

      this.rifle = new ExtendedObject3D();
      this.rifle.name = 'rifle';
      this.rifle.add(rifle);

      this.scene.third.add.existing(this.rifle);

      this.rifle.traverse(child => {
        if (child.isMesh) {
          child.layers.set(1); // mesh is in layer 1
          child.castShadow = child.receiveShadow = true;
          if (child.material) child.material.metalness = 0;
        }
      });
      
      return object; // Return the loaded object for potential reuse
    });
  }
  
  updateRiflePosition(camera, moveState) {
    if (!this.rifle) return;
    
    // Position the rifle in the camera view
    const raycaster = new THREE.Raycaster();
    // x and y are normalized device coordinates from -1 to +1
    raycaster.setFromCamera({ 
      x: -0 - moveState.x, 
      y: -1.5 - moveState.y,
      z: -1.5 - moveState.z
    }, camera);
    
    const pos = new THREE.Vector3();
    pos.copy(raycaster.ray.direction);
    pos.multiplyScalar(1.5 + moveState.z);
    pos.add(raycaster.ray.origin);

    this.rifle.position.copy(pos);

    // rotate the rifle to face the camera backwards
    this.rifle.rotation.copy(camera.rotation);
    this.rifle.rotation.y += Math.PI;

    // rotate a little bit towards the ground
    this.rifle.rotation.x -= 0.6;
  }

  createInfectedPopup(position) {
    // Create a sprite using the infected texture
    const material = new THREE.SpriteMaterial({ 
      map: this.infectedTexture,
      transparent: true,
      opacity: 1.0
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    // Position the sprite above the chicken
    sprite.position.y += 1.0;
    // Scale the sprite appropriately - 3x bigger than before
    sprite.scale.set(3, 3, 1);
    
    this.scene.third.scene.add(sprite);
    
    // Create animation to move the sprite upward and fade it out
    const startY = sprite.position.y;
    let progress = 0;
    const animationDuration = 2000; // 2 seconds
    
    const animateSprite = () => {
      // Update progress
      progress += 16.67; // Approximate for 60fps
      const t = Math.min(progress / animationDuration, 1.0);
      
      // Move upward
      sprite.position.y = startY + t * 0.5;
      
      // Fade out
      sprite.material.opacity = 1.0 - t;
      
      if (t < 1.0) {
        // Continue animation
        requestAnimationFrame(animateSprite);
      } else {
        // Remove sprite when animation is complete
        this.scene.third.scene.remove(sprite);
        sprite.material.dispose();
      }
    };
    
    // Start the animation
    animateSprite();
    
    return sprite;
  }

  shoot() {
    // Skip if no rifle is loaded
    if (!this.rifle) return;
    
    // Check if enough time has passed since the last shot
    const now = Date.now();
    if (now - this.lastFired < this.cooldownTime) {
      return null; // Can't fire yet, weapon on cooldown
    }
    
    // Update the last fired timestamp
    this.lastFired = now;

    const force = 5;
    
    // Calculate bullet spawn position at the end of the rifle
    // First get the rifle's forward direction (negative z-axis since it's rotated)
    const rifleDirection = new THREE.Vector3(0, 0, -1);
    rifleDirection.applyQuaternion(this.rifle.quaternion);
    
    // Get the rifle's position
    const riflePos = this.rifle.position.clone();
    
    // Offset from rifle position to the barrel end (about 2 units forward from center)
    const barrelOffset = rifleDirection.clone().multiplyScalar(1.5);
    
    // Calculate the final position where the bullet should spawn
    const bulletSpawnPos = riflePos.clone().add(barrelOffset);
    
    // Get shooting direction from camera for accuracy
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, this.scene.third.camera);
    const shootingDirection = raycaster.ray.direction.clone();
    
    // Create elongated bullet using cylinder shape
    // The cylinder will be created along the y-axis by default, so we need to orient it
    // We need to align the bullet with the shooting direction
    const bullet = this.scene.third.physics.add.cylinder(
      { 
        radiusTop: 0.025,
        radiusBottom: 0.025,
        height: 0.2,
        x: bulletSpawnPos.x, 
        y: bulletSpawnPos.y, 
        z: bulletSpawnPos.z,
        mass: 5,
        bufferGeometry: true
      },
      { phong: { color: 0x33ee22 } }
    );
    
    // Align the bullet with the shooting direction
    // We need to create a rotation that aligns the cylinder's y-axis with the direction vector
    const bulletDirection = shootingDirection.clone().normalize();
    const defaultDirection = new THREE.Vector3(0, 1, 0); // Cylinder's default direction (y-axis)
    
    // Create a quaternion that rotates from the default direction to our bullet direction
    const bulletQuaternion = new THREE.Quaternion();
    bulletQuaternion.setFromUnitVectors(defaultDirection, bulletDirection);
    
    // Apply the rotation to the bullet
    bullet.rotation.setFromQuaternion(bulletQuaternion);
    
    // Apply force in the shooting direction
    const forceVector = shootingDirection.multiplyScalar(24 * force);
    
    // Add an upward velocity component to account for bullet drop and make distant shots more accurate
    // The height compensation factor determines how much upward force to add (adjust as needed)
    const heightCompensationFactor = 10;
    forceVector.y += heightCompensationFactor * force;
    
    // Apply the force to the bullet
    bullet.body.applyForce(forceVector.x, forceVector.y, forceVector.z);
    
    // Increase gravity effect on the bullet so it doesn't go as far
    bullet.body.setGravity(0, -30, 0); // Apply stronger gravity than the default
    
    // Track the bullet
    this.bullets.push(bullet);
    
    // Add collision detection to the bullet
    bullet.body.on.collision((otherObject, event) => {
      if (otherObject.name !== 'rifle') {
        // If it hit a wall, ceiling or ground - just destroy bullet
        if (otherObject.name === 'ground' || otherObject.name === 'wall' || otherObject.name === 'ceiling') {
          // Destroy the bullet
          this.scene.third.scene.remove(bullet);
          this.scene.third.physics.destroy(bullet);
          
          // Remove bullet from the array
          const index = this.bullets.indexOf(bullet);
          if (index > -1) {
            this.bullets.splice(index, 1);
          }
          return;
        }
        
        // Destroy the hit object if destructible
        if (otherObject.userData.destructible !== false) {
          // Check if it's a chicken
          if (otherObject.name.includes('chicken')) {
            // Create the infected popup indicator
            this.createInfectedPopup(otherObject.position.clone());
            
            // Mark as destroyed for counting purposes
            otherObject.body.isDestroyed = true;
            
            // Change ONLY this specific chicken to a whiter shade before death animation
            // We need to make sure we're only affecting the hit chicken's meshes
            const hitChickenObject = otherObject;
            
            hitChickenObject.traverse(child => {
              if (child.isMesh) {
                // Handle case where a mesh has multiple materials (material array)
                if (Array.isArray(child.material)) {
                  // Need to clone the entire materials array and replace each item
                  const uniqueMaterials = child.material.map(material => {
                    const uniqueMaterial = material.clone();
                    this.applyWhiteEffectToMaterial(uniqueMaterial, child);
                    return uniqueMaterial;
                  });
                  // Replace the entire materials array
                  child.material = uniqueMaterials;
                } else if (child.material) {
                  // Single material case - clone to make sure it's unique to this chicken
                  const uniqueMaterial = child.material.clone();
                  child.material = uniqueMaterial;
                  this.applyWhiteEffectToMaterial(uniqueMaterial, child);
                }
              }
            });
            
            // Play death animation with a delay to show the white color
            setTimeout(() => {
              const deathAnimation = this.scene.tweens.add({
                targets: [otherObject.position],
                y: -1,
                duration: 1000,
                ease: 'Power2',
                onComplete: () => {
                  // Only remove when animation is complete
                  this.scene.third.scene.remove(otherObject);
                  this.scene.third.physics.destroy(otherObject);
                }
              });
            }, 500); // 500ms delay to show the white color change
          } else {
            // Non-chicken objects
            this.scene.third.scene.remove(otherObject);
            this.scene.third.physics.destroy(otherObject);
          }
        }
        
        // Destroy the bullet
        this.scene.third.scene.remove(bullet);
        this.scene.third.physics.destroy(bullet);
        
        // Remove bullet from the array
        const index = this.bullets.indexOf(bullet);
        if (index > -1) {
          this.bullets.splice(index, 1);
        }
      }
    });
    
    return bullet;
  }
  
  getRifle() {
    return this.rifle;
  }
  
  getBullets() {
    return this.bullets;
  }

  applyWhiteEffectToMaterial(material, child) {
    // Store original color if not already stored
    if (!material.userData) material.userData = {};
    
    if (!material.userData.originalColor && material.color) {
      material.userData.originalColor = material.color.clone();
    }
    
    // First, make it bright white for a flash effect
    if (material.color) {
      // Store the current emissive setting if it exists
      if (material.emissive) {
        material.userData.originalEmissive = material.emissive.clone();
        // Make it glow white
        material.emissive.set(0xffffff);
        material.emissiveIntensity = 2.0;
      }
      
      // Change to pure white for flash
      material.color.set(0xffffff);
      
      // Handle different material types
      if (material.isMeshStandardMaterial) {
        // For standard materials, adjust metalness and roughness for white appearance
        material.userData.originalMetalness = material.metalness;
        material.userData.originalRoughness = material.roughness;
        // Less metallic, less rough = more white appearance
        material.metalness = 0.1;
        material.roughness = 0.3;
      } else if (material.isMeshLambertMaterial || material.isMeshPhongMaterial) {
        // For Lambert or Phong materials
        material.userData.originalShininess = material.shininess;
        material.shininess = 100; // More shiny
      }
      
      material.needsUpdate = true;
      
      // After a short delay, reduce to a whiter shade but not pure white
      setTimeout(() => {
        if (material.emissive) {
          // Reduce glow
          material.emissiveIntensity = 0.5;
        }
        // Set to slightly off-white
        material.color.set(0xf5f5f5);
        material.needsUpdate = true;
      }, 150);
    }
  }
} 