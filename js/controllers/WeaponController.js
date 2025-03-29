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
      x: -1 - moveState.x, 
      y: -1.5 - moveState.y,
    }, camera);
    
    const pos = new THREE.Vector3();
    pos.copy(raycaster.ray.direction);
    pos.multiplyScalar(1.6 + moveState.z);
    pos.add(raycaster.ray.origin);

    this.rifle.position.copy(pos);
    this.rifle.rotation.copy(camera.rotation);
  }

  shoot() {
    const x = 0;
    const y = 0;
    const force = 5;
    const pos = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();

    raycaster.setFromCamera({ x, y }, this.scene.third.camera);

    pos.copy(raycaster.ray.direction);
    pos.add(raycaster.ray.origin);

    const sphere = this.scene.third.physics.add.sphere(
      { radius: 0.05, x: pos.x, y: pos.y, z: pos.z, mass: 5, bufferGeometry: true },
      { phong: { color: 0x33ee22 } }
    );

    pos.copy(raycaster.ray.direction);
    pos.multiplyScalar(24);

    sphere.body.applyForce(pos.x * force, pos.y * force, pos.z * force);
    
    // Track the bullet
    this.bullets.push(sphere);
    
    // Add collision detection to the bullet
    sphere.body.on.collision((otherObject, event) => {
      if (otherObject.name !== 'ground' && otherObject.name !== 'rifle') {
        // Destroy the hit object
        if (otherObject.userData.destructible !== false) {
          // Check if it's a chicken
          if (otherObject.name.includes('chicken')) {
            // Mark as destroyed for counting purposes
            otherObject.body.isDestroyed = true;
            
            // Play death animation - fade out and sink into ground
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
          } else {
            // Non-chicken objects
            this.scene.third.scene.remove(otherObject);
            this.scene.third.physics.destroy(otherObject);
          }
        }
        
        // Destroy the bullet
        this.scene.third.scene.remove(sphere);
        this.scene.third.physics.destroy(sphere);
        
        // Remove bullet from the array
        const index = this.bullets.indexOf(sphere);
        if (index > -1) {
          this.bullets.splice(index, 1);
        }
      }
    });
    
    return sphere;
  }
  
  getRifle() {
    return this.rifle;
  }
  
  getBullets() {
    return this.bullets;
  }
} 