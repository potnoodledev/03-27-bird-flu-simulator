/**
 * Chicken.js
 * Defines the chicken entities that players hunt in the game
 */

import { ExtendedObject3D } from '../lib/enable3d.js';
 
export class ChickenManager {
  constructor(scene) {
    this.scene = scene;
    this.chickens = [];
    this.chickenModel = null;
    this.chickenCount = 50;
    this.frameCount = 0;
  }

  loadChickens(modelObject) {
    // Create chickens using the previously loaded model
    for (let i = 0; i < this.chickenCount; i++) {
      // Clone the chicken model
      const chickenScene = modelObject.scene.clone();
      
      // Create a new ExtendedObject3D for the chicken
      const chicken = new ExtendedObject3D();
      chicken.name = `chicken_${i}`;
      chicken.add(chickenScene);
      
      // Set random position within a reasonable area
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      chicken.position.set(x, 10, z);
      
      // Random rotation
      chicken.rotation.y = Math.random() * Math.PI * 2;
      
      // Scale down the chicken
      chicken.scale.set(0.5, 0.5, 0.5);
      
      // Set chicken properties
      chicken.userData.destructible = true;
      
      // Add to scene
      this.scene.third.add.existing(chicken);
      
      // Add physics body to chicken
      chicken.physics = this.scene.third.physics.add.existing(chicken, {
        shape: 'box',
        width: 0.5,
        height: 1.4,
        depth: 0.5,
        mass: 1
      });
      
      // Tweak physics body
      chicken.body.setFriction(0.8);
      chicken.body.setAngularFactor(0, 1, 0); // Only allow rotation around Y axis
      
      // Store in array for easy access
      this.chickens.push(chicken);
    }
  }

  update() {
    // Only run this occasionally to reduce CPU load
    if (this.chickens.length > 0 && Math.random() < 0.01) {
      // Randomly select a chicken that isn't destroyed
      const liveChickens = this.chickens.filter(chicken => chicken.body && !chicken.body.isDestroyed);
      
      if (liveChickens.length > 0) {
        const randomChicken = liveChickens[Math.floor(Math.random() * liveChickens.length)];
        
        // Apply smaller random movement force
        const forceX = (Math.random() - 0.5) * 0.5;
        const forceZ = (Math.random() - 0.5) * 0.5;
        
        randomChicken.body.applyForce(forceX, 0, forceZ);
        
        // Also rotate to face movement direction
        if (forceX !== 0 || forceZ !== 0) {
          const angle = Math.atan2(forceX, forceZ);
          randomChicken.rotation.y = angle;
        }
      }
    }
  }
  
  getRemainingCount() {
    return this.chickens.filter(chicken => chicken.body && !chicken.body.isDestroyed).length;
  }
  
  getChickens() {
    return this.chickens;
  }
} 