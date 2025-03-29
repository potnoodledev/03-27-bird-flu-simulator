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
      
      // Set random position within the barn area
      // Barn is longer in Z direction (80 units) and narrower in X direction (40 units)
      const x = (Math.random() - 0.5) * 35; // Leave some margin from walls
      const z = (Math.random() - 0.5) * 75; // Leave some margin from walls
      chicken.position.set(x, 1, z); // Position on the floor (y=1) instead of in the air
      
      // Random rotation
      chicken.rotation.y = Math.random() * Math.PI * 2;
      
      // Scale down the chicken
      chicken.scale.set(0.5, 0.5, 0.5);
      
      // Set chicken properties
      chicken.userData.destructible = true;
      chicken.userData.state = this.getRandomState();
      chicken.userData.stateTimer = Math.random() * 3 + 1; // Random timer between 1-4 seconds
      chicken.userData.targetPosition = null;
      
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
      chicken.body.setFriction(0.5); // Reduced friction to make movement easier
      chicken.body.setAngularFactor(0, 1, 0); // Only allow rotation around Y axis
      chicken.body.setLinearFactor(1, 1, 1); // Make sure movement is allowed in all directions
      
      // Start with a random state that includes movement
      if (Math.random() < 0.7) {
        chicken.userData.state = Math.random() < 0.5 ? 'walking' : 'running';
      }
      
      // Store in array for easy access
      this.chickens.push(chicken);
    }
  }

  update() {
    const deltaTime = 1/60; // Assuming 60fps
    this.frameCount++;
    
    // Update each chicken behavior
    const liveChickens = this.chickens.filter(chicken => chicken.body && !chicken.body.isDestroyed);
    
    liveChickens.forEach(chicken => {
      // Update state timer
      chicken.userData.stateTimer -= deltaTime;
      
      // State transition when timer expires
      if (chicken.userData.stateTimer <= 0) {
        this.changeChickenState(chicken);
      }
      
      // Act based on current state
      switch (chicken.userData.state) {
        case 'idle':
          // Do nothing, chicken is idle
          // But let's zero out velocity to ensure it stays still
          chicken.body.setVelocity(0, chicken.body.velocity.y, 0);
          break;
          
        case 'pecking':
          // Pecking animation would go here
          // Slightly bob up and down
          if (this.frameCount % 20 < 10) {
            chicken.position.y = 0.9;
          } else {
            chicken.position.y = 1.0;
          }
          // Also ensure it stays in place
          chicken.body.setVelocity(0, chicken.body.velocity.y, 0);
          break;
          
        case 'walking':
          this.moveChicken(chicken, 0.05);
          break;
          
        case 'running':
          this.moveChicken(chicken, 0.1); // More speed difference
          break;
      }
      
      // Debug check - make sure chicken stays within reasonable height bounds
      if (chicken.position.y > 3 || chicken.position.y < 0) {
        chicken.position.y = 1;
      }
    });
    
    // Occasionally make chickens interact with each other
    if (this.frameCount % 60 === 0 && liveChickens.length > 1) {
      this.chickenInteraction(liveChickens);
    }
  }
  
  moveChicken(chicken, speed) {
    // If no target position exists, create one
    if (!chicken.userData.targetPosition) {
      // Set a new target within reasonable walking distance
      const currentPos = chicken.position.clone();
      const moveDistance = chicken.userData.state === 'running' ? 10 : 5;
      
      // Calculate new position
      const targetX = currentPos.x + (Math.random() - 0.5) * moveDistance;
      const targetZ = currentPos.z + (Math.random() - 0.5) * moveDistance;
      
      // Keep within barn boundaries
      const boundedX = Math.max(-17, Math.min(17, targetX));
      const boundedZ = Math.max(-37, Math.min(37, targetZ));
      
      chicken.userData.targetPosition = { x: boundedX, z: boundedZ };
      
      // Calculate angle to target position
      const angleToTarget = Math.atan2(
        boundedX - currentPos.x,
        boundedZ - currentPos.z
      );
      
      // Apply 180-degree rotation to make the chickens face the right way
      chicken.rotation.y = angleToTarget + Math.PI;
    }
    
    // Move toward target position
    const target = chicken.userData.targetPosition;
    const direction = {
      x: target.x - chicken.position.x,
      z: target.z - chicken.position.z
    };
    
    // Calculate distance to target
    const distance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    
    // If close enough to target, clear it so a new one will be set
    if (distance < 0.5) {
      chicken.userData.targetPosition = null;
      return;
    }
    
    // Normalize and apply movement
    const normalizedDir = {
      x: direction.x / distance,
      z: direction.z / distance
    };
    
    // Apply chicken-like movement - slight up/down bobbing
    if (this.frameCount % 15 < 7) {
      chicken.position.y = 1.05;
    } else {
      chicken.position.y = 0.95;
    }
    
    // Apply force instead of velocity for better physics interaction
    // Increased force magnitude significantly
    const moveForceBase = 5;
    const finalForce = moveForceBase * speed;
    chicken.body.applyForce(
      normalizedDir.x * finalForce,
      0,
      normalizedDir.z * finalForce
    );
  }
  
  chickenInteraction(chickens) {
    // Randomly select two nearby chickens to interact
    const firstChicken = chickens[Math.floor(Math.random() * chickens.length)];
    
    // Find nearby chickens
    const nearbyChickens = chickens.filter(c => {
      if (c === firstChicken) return false;
      const distance = firstChicken.position.distanceTo(c.position);
      return distance < 5; // Within 5 units
    });
    
    if (nearbyChickens.length > 0) {
      // Get a random nearby chicken
      const secondChicken = nearbyChickens[Math.floor(Math.random() * nearbyChickens.length)];
      
      // 50% chance of causing one chicken to run from the other
      if (Math.random() > 0.5) {
        secondChicken.userData.state = 'running';
        secondChicken.userData.stateTimer = 1.5;
        
        // Run away from first chicken
        const awayVector = {
          x: secondChicken.position.x - firstChicken.position.x,
          z: secondChicken.position.z - firstChicken.position.z
        };
        
        // Normalize and set target position
        const dist = Math.sqrt(awayVector.x * awayVector.x + awayVector.z * awayVector.z);
        if (dist > 0) {
          secondChicken.userData.targetPosition = {
            x: secondChicken.position.x + (awayVector.x / dist) * 8,
            z: secondChicken.position.z + (awayVector.z / dist) * 8
          };
        }
      }
    }
  }
  
  changeChickenState(chicken) {
    // Change to a new random state
    chicken.userData.state = this.getRandomState();
    
    // Set timer based on state
    switch (chicken.userData.state) {
      case 'idle':
        chicken.userData.stateTimer = Math.random() * 2 + 1; // 1-3 seconds
        chicken.body.setVelocity(0, chicken.body.velocity.y, 0); // Stop moving
        break;
      case 'pecking':
        chicken.userData.stateTimer = Math.random() * 1.5 + 0.5; // 0.5-2 seconds
        chicken.body.setVelocity(0, chicken.body.velocity.y, 0); // Stop moving
        break;
      case 'walking':
        chicken.userData.stateTimer = Math.random() * 4 + 2; // 2-6 seconds
        chicken.userData.targetPosition = null; // Force new target position
        break;
      case 'running':
        chicken.userData.stateTimer = Math.random() * 1 + 0.5; // 0.5-1.5 seconds
        chicken.userData.targetPosition = null; // Force new target position
        break;
    }
  }
  
  getRandomState() {
    // Weight probabilities for more natural behavior
    const rand = Math.random();
    if (rand < 0.3) return 'idle';
    if (rand < 0.6) return 'pecking';
    if (rand < 0.9) return 'walking';
    return 'running';
  }
  
  getShortestAngle(from, to) {
    // Find the shortest rotation between two angles
    let diff = to - from;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }
  
  getRemainingCount() {
    return this.chickens.filter(chicken => chicken.body && !chicken.body.isDestroyed).length;
  }
  
  getChickens() {
    return this.chickens;
  }
} 