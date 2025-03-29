/**
 * SafeArea.js
 * Utility for detecting and handling safe areas on mobile devices
 */

export function setupSafeAreaDetection() {
  // For handling iOS safe areas dynamically
  const detectSafeArea = () => {
    // Get safe area insets if available
    const safeAreaTop = window.innerHeight - document.documentElement.clientHeight;
    document.documentElement.style.setProperty('--sat', `${safeAreaTop}px`);
  };
  
  // Run detection
  detectSafeArea();
  window.addEventListener('resize', detectSafeArea);
  window.addEventListener('orientationchange', () => setTimeout(detectSafeArea, 100));
}

export function setupMobileViewport() {
  // Fix for mobile iOS Safari screen height calculation
  const fixViewport = () => {
    document.documentElement.style.height = `${window.innerHeight}px`;
    document.body.style.height = `${window.innerHeight}px`;
  };
  
  fixViewport();
  window.addEventListener('resize', fixViewport);
  
  window.addEventListener('orientationchange', () => {
    // Small delay to allow orientation to complete
    setTimeout(() => {
      fixViewport();
      window.dispatchEvent(new Event('resize'));
    }, 200);
  });
} 