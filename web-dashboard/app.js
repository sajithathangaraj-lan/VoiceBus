/* ==========================================================================
   SMART BUS ACCESSIBILITY DASHBOARD JAVASCRIPT
   ========================================================================== */

// 1. Bus Data Object (No Backend as per Technical Requirements)
const busData = {
  busNumber: "TN57 AB 1234",
  route: {
    start: "Coimbatore",
    end: "Salem"
  },
  upcomingStops: [
    "Avinashi",
    "Tirupur",
    "Perundurai",
    "Bhavani",
    "Salem"
  ],
  destinationStatus: "Destination Covered",
  currentStatus: "Arriving"
};

// State Variables
let isVoiceActive = false;
let lastTapTime = 0;
let longPressTimer = null;
let touchStartPos = { x: 0, y: 0 };
const LONG_PRESS_DURATION = 1000; // 1 second in milliseconds
const DOUBLE_TAP_DELAY = 300; // 300ms window

// DOM Elements
const activationOverlay = document.getElementById('activation-overlay');
const gestureOverlay = document.getElementById('gesture-overlay');
const feedbackIconContainer = document.getElementById('feedback-icon-container');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackSubtitle = document.getElementById('feedback-subtitle');
const dismissOverlayBtn = document.getElementById('dismiss-overlay-btn');

// Audio elements (tactile backup)
const soundSuccess = document.getElementById('sound-success');
const soundSkip = document.getElementById('sound-skip');

// SVG Icons for feedback overlay
const checkmarkSVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
    <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
  </svg>
`;

const skipSVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
    <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-54-17-104.5t-48-92.5L257-227q42 31 92.5 48T480-160Zm-215-93 478-478q-42-31-92.5-48T480-800q-134 0-227 93t-93 227q0 54 17 104.5t48 92.5Z"/>
  </svg>
`;

// ==========================================================================
// A. Speech Synthesis Engine
// ==========================================================================

/**
 * Utility to speak a given text phrase using the Web Speech API.
 * @param {string} text - The phrase to read.
 * @param {boolean} cancelCurrent - Cancel any pending speech.
 * @param {function} onEndCallback - Optional callback when speech finishes.
 */
function speakText(text, cancelCurrent = true, onEndCallback = null) {
  if (!('speechSynthesis' in window)) {
    console.warn("Speech Synthesis is not supported in this browser.");
    return;
  }

  if (cancelCurrent) {
    window.speechSynthesis.cancel();
  }

  // Use a slight timeout to ensure Chrome clears the queue successfully
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Accessibility parameters: natural, extremely clear rate and pitch
    utterance.rate = 0.95; // Slightly slower for absolute comprehension
    utterance.pitch = 1.0; 
    
    // Choose an English voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => voice.lang.startsWith('en-'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    if (onEndCallback) {
      utterance.onend = onEndCallback;
    }

    utterance.onerror = (e) => {
      console.error("SpeechSynthesisUtterance error: ", e);
    };

    window.speechSynthesis.speak(utterance);
  }, 50);
}

/**
 * Performs the comprehensive voice announcement sequence when dashboard is active.
 */
function announceBusInformation() {
  // Format the stop names for elegant TTS flow
  // Coimbatore -> Salem, stops: Avinashi, Tirupur, Perundurai, Bhavani, Salem
  const stopsList = busData.upcomingStops.slice(0, -1).join(', ') + ' and ' + busData.upcomingStops[busData.upcomingStops.length - 1];
  
  const announcement = 
    `Bus Number ${formatBusNumberForTTS(busData.busNumber)}. ` +
    `Route ${busData.route.start} to ${busData.route.end}. ` +
    `Upcoming stops are ${stopsList}. ` +
    `Destination Status: ${busData.destinationStatus}. ` +
    `Current Status: ${busData.currentStatus}. ` +
    `Double tap anywhere to board this bus. ` +
    `Long press anywhere to skip this bus.`;

  speakText(announcement);
}

/**
 * Format raw bus number e.g. "TN57 AB 1234" to "T N 5 7 A B 1 2 3 4" 
 * to prevent the screen reader from reading it as a single word or thousands value.
 */
function formatBusNumberForTTS(busNumber) {
  return busNumber.split('').map(char => {
    if (char === ' ') return ' ';
    return char;
  }).join(' ');
}

// Ensure voices are loaded (Chrome loads voices asynchronously)
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    console.log("SpeechSynthesis voices refreshed.");
  };
}

// ==========================================================================
// B. Activation Handler (Initial Touch Gesture)
// ==========================================================================

function activateVoiceDashboard() {
  if (isVoiceActive) return;
  
  isVoiceActive = true;
  activationOverlay.classList.remove('active');
  
  // Play subtle haptic confirmation
  triggerHaptic(50);
  
  // Start speaking the bus credentials immediately
  announceBusInformation();
}

// Handle Tap Anywhere on Activation Screen
activationOverlay.addEventListener('click', activateVoiceDashboard);
activationOverlay.addEventListener('touchstart', (e) => {
  e.preventDefault();
  activateVoiceDashboard();
}, { passive: false });


// ==========================================================================
// C. Gesture Actions & Handlers
// ==========================================================================

/**
 * Triggers device vibration pattern if supported
 * @param {number|number[]} pattern 
 */
function triggerHaptic(pattern) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/**
 * Handles the "Boarding Bus" action sequence
 */
function handleBoardBusAction() {
  if (!isVoiceActive) return;
  
  console.log("Gesture Detected: Double Tap -> BOARDING BUS");
  
  // 1. Visual updates on Feedback Overlay
  gestureOverlay.className = "overlay gesture-feedback-overlay active success-board";
  feedbackIconContainer.innerHTML = checkmarkSVG;
  feedbackTitle.textContent = "Boarding Bus";
  feedbackSubtitle.textContent = "Success Confirmation";
  
  // 2. Play tactile alerts
  triggerHaptic(200);
  playTone(220, 440, 0.15); // Custom browser synthesizer audio backup
  
  // 3. Audio Speech Announcement
  speakText("Boarding Bus");
}

/**
 * Handles the "Bus Skipped" action sequence
 */
function handleSkipBusAction() {
  if (!isVoiceActive) return;
  
  console.log("Gesture Detected: Long Press -> BUS SKIPPED");
  
  // 1. Visual updates on Feedback Overlay
  gestureOverlay.className = "overlay gesture-feedback-overlay active skip-warning";
  feedbackIconContainer.innerHTML = skipSVG;
  feedbackTitle.textContent = "Bus Skipped";
  feedbackSubtitle.textContent = "Waiting for next bus";
  
  // 2. Play tactile alerts
  triggerHaptic([100, 50, 100]);
  playTone(330, 220, 0.25); // Skip synthesizer tone
  
  // 3. Audio Speech Announcement
  speakText("Bus Skipped. Waiting for next bus.");
}

/**
 * Dismisses the gesture action overlay
 */
function dismissGestureOverlay() {
  gestureOverlay.classList.remove('active');
  window.speechSynthesis.cancel(); // Stop boarding/skipped messages immediately
  
  // Return to reading bus information or a ready prompt
  setTimeout(() => {
    speakText("Dashboard active. Bus details are available.");
  }, 100);
}

dismissOverlayBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  dismissGestureOverlay();
});
gestureOverlay.addEventListener('click', (e) => {
  e.stopPropagation();
  dismissGestureOverlay();
});

// ==========================================================================
// D. Customized Screen-wide Touch Gesture Detectors
// ==========================================================================

/**
 * Process single pointer touches to register both custom gestures.
 * Registered globally on the window to support low-vision navigation anywhere.
 */

function handleTouchStart(e) {
  if (!isVoiceActive) return;
  
  // Do not process gestures if they tap the dismiss button directly
  if (e.target.id === 'dismiss-overlay-btn') return;
  
  const touch = e.touches[0];
  touchStartPos = { x: touch.clientX, y: touch.clientY };
  
  // Start the 1-second long press timer
  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    handleSkipBusAction();
  }, LONG_PRESS_DURATION);
}

function handleTouchMove(e) {
  if (!isVoiceActive) return;
  
  const touch = e.touches[0];
  const deltaX = Math.abs(touch.clientX - touchStartPos.x);
  const deltaY = Math.abs(touch.clientY - touchStartPos.y);
  
  // If the user drags their finger more than 15px, cancel the long press
  if (deltaX > 15 || deltaY > 15) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function handleTouchEnd(e) {
  if (!isVoiceActive) return;
  
  // Cancel active long press timer since pointer was lifted
  clearTimeout(longPressTimer);
  longPressTimer = null;
  
  // Check for Double-Tap gesture
  const currentTime = new Date().getTime();
  const tapInterval = currentTime - lastTapTime;
  
  if (tapInterval < DOUBLE_TAP_DELAY && tapInterval > 0) {
    e.preventDefault(); // Stop default zooming behaviors
    handleBoardBusAction();
    lastTapTime = 0; // Reset
  } else {
    lastTapTime = currentTime;
  }
}

// Mouse support for desktop emulator verification
function handleMouseDown(e) {
  if (!isVoiceActive) return;
  if (e.target.id === 'dismiss-overlay-btn') return;
  
  touchStartPos = { x: e.clientX, y: e.clientY };
  
  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    handleSkipBusAction();
  }, LONG_PRESS_DURATION);
}

function handleMouseMove(e) {
  if (!isVoiceActive) return;
  if (!longPressTimer) return;
  
  const deltaX = Math.abs(e.clientX - touchStartPos.x);
  const deltaY = Math.abs(e.clientY - touchStartPos.y);
  
  if (deltaX > 15 || deltaY > 15) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function handleMouseUp(e) {
  if (!isVoiceActive) return;
  
  clearTimeout(longPressTimer);
  longPressTimer = null;
  
  const currentTime = new Date().getTime();
  const tapInterval = currentTime - lastTapTime;
  
  if (tapInterval < DOUBLE_TAP_DELAY && tapInterval > 0) {
    handleBoardBusAction();
    lastTapTime = 0;
  } else {
    lastTapTime = currentTime;
  }
}

// Register Global Listeners on Window
window.addEventListener('touchstart', handleTouchStart, { passive: false });
window.addEventListener('touchmove', handleTouchMove, { passive: true });
window.addEventListener('touchend', handleTouchEnd, { passive: false });

window.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp);


// ==========================================================================
// E. Synthesizer Tone Generator (Audio feedback fallback)
// ==========================================================================

/**
 * Creates dynamic web audio tones for clean accessibility UI sounds.
 */
function playTone(freq1, freq2, duration) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq1, audioCtx.currentTime);
    if (freq2) {
      osc.frequency.exponentialRampToValueAtTime(freq2, audioCtx.currentTime + duration);
    }
    
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (error) {
    console.warn("Audio Context sound generation failed or blocked.", error);
  }
}

// Informative Log to confirm JavaScript loaded
console.log("Smart Bus Information System script initialized.");
