/* global chrome */

/**
 * @fileoverview Screen recording functionality for Chrome extension.
 * Uses desktopCapture API to record browser tabs/windows.
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * @typedef {Object} RecordingState
 * @property {boolean} isRecording - Whether recording is in progress
 * @property {string | null} streamId - The desktop capture stream ID
 * @property {number | null} tabId - The tab ID where recording is happening
 * @property {number} badgeBlinkInterval - Interval ID for badge blinking
 */

/** @type {RecordingState} */
const recordingState = {
  isRecording: false,
  streamId: null,
  tabId: null,
  badgeBlinkInterval: 0,
};

// Store the offscreen document state
let offscreenDocumentExists = false;

// Timeout ID for scheduled video deletion
let videoDeletionTimeout = null;

// ============================================================================
// BADGE MANAGEMENT
// ============================================================================

/**
 * Start blinking the recording badge on the action button.
 * Also disables the popup so action click can stop recording.
 * @returns {void}
 */
function startBadgeBlink() {
  console.log('[screen-recorder] Starting badge blink animation');
  let visible = true;

  // Disable popup so action click can stop recording
  chrome.action.setPopup({ popup: '' });
  console.log('[screen-recorder] Popup disabled for recording');

  // Set initial badge
  chrome.action.setBadgeText({ text: '⏺️' });
  chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });

  // Blink every 500ms
  recordingState.badgeBlinkInterval = setInterval(() => {
    visible = !visible;
    chrome.action.setBadgeText({ text: visible ? '⏺️' : '' });
  }, 500);
}

/**
 * Stop the badge blinking and clear the badge.
 * Also restores the popup.
 * @returns {void}
 */
function stopBadgeBlink() {
  console.log('[screen-recorder] Stopping badge blink animation');
  if (recordingState.badgeBlinkInterval) {
    clearInterval(recordingState.badgeBlinkInterval);
    recordingState.badgeBlinkInterval = 0;
  }
  chrome.action.setBadgeText({ text: '' });

  // Restore the popup
  chrome.action.setPopup({ popup: 'src/popup/index.html' });
  console.log('[screen-recorder] Popup restored');
}

// ============================================================================
// OFFSCREEN DOCUMENT MANAGEMENT
// ============================================================================

/**
 * Create an offscreen document for media recording.
 * @returns {Promise<void>}
 */
async function createOffscreenDocument() {
  console.log('[screen-recorder] createOffscreenDocument called, exists:', offscreenDocumentExists);
  
  if (offscreenDocumentExists) {
    console.log('[screen-recorder] Offscreen document already exists (cached), skipping creation');
    return;
  }

  if (!chrome.offscreen) {
    throw new Error(
      'Screen recording requires the Offscreen API, which is only available in Chrome.'
    );
  }

  try {
    // Check if offscreen document already exists
    console.log('[screen-recorder] Checking for existing offscreen contexts...');
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
    console.log('[screen-recorder] Existing contexts:', existingContexts.length);

    if (existingContexts.length > 0) {
      console.log('[screen-recorder] Offscreen document already exists (from getContexts)');
      offscreenDocumentExists = true;
      return;
    }

    console.log('[screen-recorder] Creating new offscreen document...');
    await chrome.offscreen.createDocument({
      url: 'src/recording/offscreen.html',
      reasons: ['DISPLAY_MEDIA'],
      justification: 'Recording screen capture stream',
    });
    offscreenDocumentExists = true;
    console.log('[screen-recorder] Offscreen document created successfully');
  } catch (error) {
    console.error('[screen-recorder] Failed to create offscreen document:', error);
    console.error('[screen-recorder] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Close the offscreen document.
 * @returns {Promise<void>}
 */
async function closeOffscreenDocument() {
  console.log('[screen-recorder] closeOffscreenDocument called, exists:', offscreenDocumentExists);
  
  if (!offscreenDocumentExists) {
    console.log('[screen-recorder] No offscreen document to close');
    return;
  }

  try {
    console.log('[screen-recorder] Closing offscreen document...');
    await chrome.offscreen.closeDocument();
    offscreenDocumentExists = false;
    console.log('[screen-recorder] Offscreen document closed successfully');
  } catch (error) {
    console.warn('[screen-recorder] Failed to close offscreen document:', error);
    offscreenDocumentExists = false;
  }
}

// ============================================================================
// RECORDING CONTROL
// ============================================================================

/**
 * Start screen recording.
 * Prompts user to select a tab or window to record.
 * @param {number} [sourceTabId] - Optional tab ID to request capture from
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function startScreenRecording(sourceTabId) {
  console.log('[screen-recorder] startScreenRecording called, sourceTabId:', sourceTabId);
  console.log('[screen-recorder] Current state:', JSON.stringify(recordingState));
  
  if (recordingState.isRecording) {
    console.log('[screen-recorder] Recording already in progress, aborting');
    return { success: false, error: 'Recording already in progress' };
  }

  try {
    // Create offscreen document for recording
    console.log('[screen-recorder] Step 1: Creating offscreen document...');
    await createOffscreenDocument();
    console.log('[screen-recorder] Step 1 complete: Offscreen document ready');

    // Send message to offscreen document to start recording
    // The offscreen document will use getDisplayMedia to show the picker
    console.log('[screen-recorder] Step 2: Sending start message to offscreen document...');
    const response = await chrome.runtime.sendMessage({
      type: 'screen-recorder:start',
      streamId: null, // Let offscreen document use getDisplayMedia
    });
    console.log('[screen-recorder] Step 2 complete: Received response:', JSON.stringify(response));

    if (!response || !response.success) {
      console.error('[screen-recorder] Offscreen document failed to start recording:', response?.error);
      await closeOffscreenDocument();
      return { success: false, error: response?.error || 'Failed to start recording' };
    }

    // Update state
    console.log('[screen-recorder] Step 3: Updating recording state...');
    recordingState.isRecording = true;
    recordingState.streamId = null;
    recordingState.tabId = sourceTabId || null;
    console.log('[screen-recorder] New state:', JSON.stringify(recordingState));

    // Start badge blinking
    console.log('[screen-recorder] Step 4: Starting badge blink...');
    startBadgeBlink();

    console.log('[screen-recorder] ✅ Recording started successfully');
    return { success: true };
  } catch (error) {
    console.error('[screen-recorder] ❌ Failed to start recording:', error);
    console.error('[screen-recorder] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    await closeOffscreenDocument();
    return { success: false, error: error.message || 'Failed to start recording' };
  }
}

/**
 * Stop screen recording and return the recorded video.
 * @returns {Promise<{success: boolean, error?: string, blobUrl?: string}>}
 */
export async function stopScreenRecording() {
  console.log('[screen-recorder] stopScreenRecording called');
  console.log('[screen-recorder] Current state:', JSON.stringify(recordingState));
  
  if (!recordingState.isRecording) {
    console.log('[screen-recorder] No recording in progress, aborting');
    return { success: false, error: 'No recording in progress' };
  }

  try {
    // Stop badge blinking
    console.log('[screen-recorder] Step 1: Stopping badge blink...');
    stopBadgeBlink();

    // Send message to offscreen document to stop recording
    console.log('[screen-recorder] Step 2: Sending stop message to offscreen document...');
    const response = await chrome.runtime.sendMessage({
      type: 'screen-recorder:stop',
    });
    console.log('[screen-recorder] Step 2 complete: Received response:', JSON.stringify(response));

    if (!response || !response.success) {
      console.error('[screen-recorder] Offscreen document failed to stop recording:', response?.error);
      return { success: false, error: response?.error || 'Failed to stop recording' };
    }

    // Reset state
    console.log('[screen-recorder] Step 3: Resetting recording state...');
    recordingState.isRecording = false;
    recordingState.streamId = null;

    // Store the blob URL in session storage for the preview page
    if (response.blobUrl) {
      console.log('[screen-recorder] Step 4: Storing blob URL in session storage...');
      await chrome.storage.session.set({ recordedVideoUrl: response.blobUrl });
      console.log('[screen-recorder] Blob URL stored:', response.blobUrl.substring(0, 50) + '...');
    }

    // Don't close offscreen document yet - preview page will close it after loading the video
    // We'll close it after a timeout as a safety measure
    console.log('[screen-recorder] Step 5: Scheduling offscreen document cleanup (60s timeout)...');
    setTimeout(async () => {
      console.log('[screen-recorder] Timeout reached, closing offscreen document...');
      await closeOffscreenDocument();
    }, 60000); // Close after 60 seconds

    console.log('[screen-recorder] ✅ Recording stopped successfully');
    return { success: true, blobUrl: response.blobUrl };
  } catch (error) {
    console.error('[screen-recorder] ❌ Failed to stop recording:', error);
    console.error('[screen-recorder] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    recordingState.isRecording = false;
    recordingState.streamId = null;
    await closeOffscreenDocument();
    return { success: false, error: error.message || 'Failed to stop recording' };
  }
}

/**
 * Check if recording is currently in progress.
 * @returns {boolean}
 */
export function isRecording() {
  return recordingState.isRecording;
}

/**
 * Handle screen recording toggle.
 * If not recording, starts recording. If recording, stops and opens preview.
 * @param {number} [tabId] - Optional tab ID
 * @returns {Promise<void>}
 */
export async function handleScreenRecordingToggle(tabId) {
  console.log('[screen-recorder] handleScreenRecordingToggle called, tabId:', tabId);
  console.log('[screen-recorder] isRecording:', recordingState.isRecording);
  
  if (recordingState.isRecording) {
    console.log('[screen-recorder] Currently recording, will stop and open preview...');
    // Stop recording and open preview
    const result = await stopScreenRecording();
    console.log('[screen-recorder] Stop result:', JSON.stringify(result));
    
    if (result.success && result.blobUrl) {
      // Open preview page with the recorded video
      const previewUrl = chrome.runtime.getURL('src/recording/preview.html');
      const fullUrl = `${previewUrl}?video=${encodeURIComponent(result.blobUrl)}`;
      console.log('[screen-recorder] Opening preview page:', fullUrl.substring(0, 100) + '...');
      await chrome.tabs.create({ url: fullUrl });
    } else {
      console.error('[screen-recorder] Failed to stop recording:', result.error);
    }
  } else {
    console.log('[screen-recorder] Not recording, will start recording...');
    // Start recording
    const result = await startScreenRecording(tabId);
    console.log('[screen-recorder] Start result:', JSON.stringify(result));
    
    if (!result.success) {
      console.error('[screen-recorder] Failed to start recording:', result.error);
    }
  }
}

/**
 * Handle action button click during recording.
 * @returns {Promise<boolean>} - Returns true if handled (was recording), false otherwise
 */
export async function handleActionClickDuringRecording() {
  if (!recordingState.isRecording) {
    return false;
  }

  // Stop recording and open preview
  const result = await stopScreenRecording();
  if (result.success && result.blobUrl) {
    // Open preview page with the recorded video
    const previewUrl = chrome.runtime.getURL('src/recording/preview.html');
    await chrome.tabs.create({
      url: `${previewUrl}?video=${encodeURIComponent(result.blobUrl)}`,
    });
  } else {
    console.error('[screen-recorder] Failed to stop recording:', result.error);
  }

  return true;
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

/**
 * Handle messages related to screen recording.
 * @param {Object} message - The message object
 * @param {chrome.runtime.MessageSender} sender - The message sender
 * @param {Function} sendResponse - The response callback
 * @returns {boolean | undefined} - Return true to indicate async response
 */
export function handleScreenRecorderMessage(message, sender, sendResponse) {
  if (message.type === 'screen-recorder:get-status') {
    console.log('[screen-recorder] Handling get-status message');
    sendResponse({ isRecording: recordingState.isRecording });
    return false;
  }

  if (message.type === 'screen-recorder:recording-complete') {
    console.log('[screen-recorder] Handling recording-complete message');
    // Recording data received from offscreen document
    // Store it temporarily for the preview page
    if (message.blobUrl) {
      console.log('[screen-recorder] Storing blob URL in session storage');
      chrome.storage.session.set({ recordedVideoUrl: message.blobUrl });
    }
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'screen-recorder:stream-ended') {
    console.log('[screen-recorder] Handling stream-ended message (user clicked Stop sharing)');
    // User clicked "Stop sharing" button in browser UI
    
    // Stop badge blinking and restore popup
    stopBadgeBlink();
    
    // Update state
    recordingState.isRecording = false;
    recordingState.streamId = null;
    
    if (message.success && message.blobUrl) {
      // Store blob URL
      chrome.storage.session.set({ recordedVideoUrl: message.blobUrl });
      
      // Open preview page
      const previewUrl = chrome.runtime.getURL('src/recording/preview.html');
      chrome.tabs.create({
        url: `${previewUrl}?video=${encodeURIComponent(message.blobUrl)}`,
      });
      
      // Schedule offscreen document cleanup
      setTimeout(async () => {
        await closeOffscreenDocument();
      }, 60000);
    } else {
      console.error('[screen-recorder] Stream ended but recording failed:', message.error);
      closeOffscreenDocument();
    }
    
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'screen-recorder:close-offscreen') {
    console.log('[screen-recorder] Handling close-offscreen message');
    // Preview page has finished loading the video, close offscreen document
    closeOffscreenDocument().then(() => {
      console.log('[screen-recorder] Offscreen document closed by preview page request');
      sendResponse({ success: true });
    }).catch((error) => {
      console.warn('[screen-recorder] Failed to close offscreen document:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.type === 'screen-recorder:get-video-blob') {
    console.log('[screen-recorder] Handling get-video-blob message, forwarding to offscreen...');
    // Forward request to offscreen document to get video blob as base64
    chrome.runtime.sendMessage({ type: 'get-video-base64' })
      .then((response) => {
        console.log('[screen-recorder] Received base64 response from offscreen:', { success: response?.success });
        sendResponse(response);
      })
      .catch((error) => {
        console.error('[screen-recorder] Failed to get base64 from offscreen:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'screen-recorder:preview-opened') {
    console.log('[screen-recorder] Preview page opened, cancelling any pending deletion');
    // Cancel any pending deletion
    if (videoDeletionTimeout) {
      clearTimeout(videoDeletionTimeout);
      videoDeletionTimeout = null;
      console.log('[screen-recorder] Cancelled pending video deletion');
    }
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'screen-recorder:preview-closed') {
    console.log('[screen-recorder] Preview page closed, scheduling video deletion in 1 minute');
    // Cancel any existing timeout first
    if (videoDeletionTimeout) {
      clearTimeout(videoDeletionTimeout);
    }
    // Schedule deletion after 1 minute
    videoDeletionTimeout = setTimeout(async () => {
      console.log('[screen-recorder] Deleting video from IndexedDB (1 minute after preview closed)');
      try {
        await deleteVideoFromIndexedDB();
        console.log('[screen-recorder] Video deleted from IndexedDB');
      } catch (error) {
        console.error('[screen-recorder] Failed to delete video:', error);
      }
      videoDeletionTimeout = null;
    }, 60000); // 1 minute
    sendResponse({ success: true });
    return false;
  }

  return undefined;
}

/**
 * Delete video from IndexedDB.
 * @returns {Promise<void>}
 */
async function deleteVideoFromIndexedDB() {
  const DB_NAME = 'nenya-recordings';
  const STORE_NAME = 'videos';
  const CURRENT_RECORDING_KEY = 'current';

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const deleteRequest = store.delete(CURRENT_RECORDING_KEY);

      deleteRequest.onerror = () => {
        db.close();
        reject(deleteRequest.error);
      };

      deleteRequest.onsuccess = () => {
        db.close();
        resolve();
      };
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}
