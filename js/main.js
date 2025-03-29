/**
 * main.js
 * Main entry point for the Bird Flu Simulator game
 */

import { enable3d, Canvas } from './lib/enable3d.js';
import { MainScene } from './scenes/MainScene.js';
import { setupMobileViewport } from './utils/SafeArea.js';

// Configure the Phaser game settings
const config = {
  type: Phaser.WEBGL,
  transparent: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: document.body,
    // Add full screen mode options
    fullscreenTarget: document.body
  },
  backgroundColor: '#000000',
  scene: [MainScene],
  ...Canvas({ antialias: true })
};

// Initialize mobile viewport handling
setupMobileViewport();

// Wait for window to load before starting the game
window.addEventListener('load', () => {
  // Force a resize before game starts to ensure canvas is properly sized
  window.dispatchEvent(new Event('resize'));
  
  // Initialize the game with physics
  enable3d(() => new Phaser.Game(config)).withPhysics('lib/ammo/kripken');
}); 