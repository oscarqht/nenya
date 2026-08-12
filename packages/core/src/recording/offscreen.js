/* global chrome */

/**
 * @fileoverview Offscreen document for screen recording.
 * Handles MediaRecorder API which is not available in service workers.
 */

import { saveVideoBlob } from './storage.js';

/** @type {MediaRecorder | null} */
let mediaRecorder = null;

/** @type {Blob[]} */
let recordedChunks = [];

/** @type {MediaStream | null} */
let mediaStream = null;

/** @type {Blob | null} */
let lastRecordedBlob = null;

/**
 * Start recording with the given stream ID.
 * @param {string} streamId - The desktop capture stream ID (optional, can use getDisplayMedia if not provided)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function startRecording(streamId) {
  console.log('[offscreen] startRecording called, streamId:', streamId ? streamId.substring(0, 20) + '...' : 'null');
  
  try {
    // Get the media stream
    if (streamId) {
      console.log('[offscreen] Using streamId from desktopCapture...');
      // Try using the streamId from desktopCapture
      try {
        console.log('[offscreen] Attempting getUserMedia with audio+video...');
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: streamId,
            },
          },
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: streamId,
            },
          },
        });
        console.log('[offscreen] getUserMedia with audio+video succeeded');
      } catch (audioError) {
        console.warn('[offscreen] Audio capture failed:', audioError.message);
        console.log('[offscreen] Attempting getUserMedia with video-only...');
        // Try video-only with streamId
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: streamId,
              },
            },
          });
          console.log('[offscreen] getUserMedia video-only succeeded');
        } catch (videoError) {
          console.warn('[offscreen] getUserMedia video-only failed:', videoError.message);
          console.log('[offscreen] Falling back to getDisplayMedia...');
          // Fall back to getDisplayMedia
          try {
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: true,
            });
            console.log('[offscreen] getDisplayMedia with audio succeeded');
          } catch (displayError) {
            console.warn('[offscreen] getDisplayMedia with audio failed:', displayError.message);
            console.log('[offscreen] Attempting getDisplayMedia video-only...');
            // Try video-only as last resort
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false,
            });
            console.log('[offscreen] getDisplayMedia video-only succeeded');
          }
        }
      }
    } else {
      // No streamId provided, use getDisplayMedia directly
      // This will show Chrome's native screen picker
      console.log('[offscreen] No streamId, using getDisplayMedia directly...');
      try {
        console.log('[offscreen] Attempting getDisplayMedia with audio...');
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        console.log('[offscreen] getDisplayMedia with audio succeeded');
      } catch (audioError) {
        // Some systems don't support audio capture, try video-only
        console.warn('[offscreen] getDisplayMedia with audio failed:', audioError.message);
        console.log('[offscreen] Attempting getDisplayMedia video-only...');
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        console.log('[offscreen] getDisplayMedia video-only succeeded');
      }
    }

    console.log('[offscreen] Media stream obtained successfully');
    console.log('[offscreen] Video tracks:', mediaStream.getVideoTracks().length);
    console.log('[offscreen] Audio tracks:', mediaStream.getAudioTracks().length);

    // Reset recorded chunks
    recordedChunks = [];
    console.log('[offscreen] Recorded chunks reset');

    // Create MediaRecorder with optimal settings
    const mimeType = getSupportedMimeType();
    console.log('[offscreen] Using MIME type:', mimeType);
    
    const options = {
      mimeType: mimeType,
      videoBitsPerSecond: 2500000, // 2.5 Mbps
    };

    console.log('[offscreen] Creating MediaRecorder...');
    mediaRecorder = new MediaRecorder(mediaStream, options);
    console.log('[offscreen] MediaRecorder created, state:', mediaRecorder.state);

    // Handle data available
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
        console.log('[offscreen] Data chunk received, size:', event.data.size, 'total chunks:', recordedChunks.length);
      }
    };

    // Handle errors
    mediaRecorder.onerror = (event) => {
      console.error('[offscreen] MediaRecorder error:', event);
      console.error('[offscreen] Error details:', event.error);
    };

    // Handle stream ending (user stops sharing)
    mediaStream.getVideoTracks()[0].onended = async () => {
      console.log('[offscreen] Stream ended by user (stop sharing clicked)');
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        console.log('[offscreen] Stopping recording due to stream end...');
        
        // Stop recording and get the result
        const result = await stopRecording();
        
        // Notify background script that recording was stopped by user
        console.log('[offscreen] Notifying background script of stream end...');
        chrome.runtime.sendMessage({
          type: 'screen-recorder:stream-ended',
          success: result.success,
          blobUrl: result.blobUrl,
          error: result.error,
        });
      }
    };

    // Start recording with 1 second chunks
    console.log('[offscreen] Starting MediaRecorder...');
    mediaRecorder.start(1000);
    console.log('[offscreen] MediaRecorder started, state:', mediaRecorder.state);

    console.log('[offscreen] ✅ Recording started successfully');
    return { success: true };
  } catch (error) {
    console.error('[offscreen] ❌ Failed to start recording:', error);
    console.error('[offscreen] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message || 'Failed to start recording' };
  }
}

/**
 * Stop the current recording.
 * @returns {Promise<{success: boolean, error?: string, blobUrl?: string}>}
 */
async function stopRecording() {
  console.log('[offscreen] stopRecording called');
  console.log('[offscreen] MediaRecorder state:', mediaRecorder?.state || 'null');
  console.log('[offscreen] Recorded chunks:', recordedChunks.length);
  
  try {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      console.warn('[offscreen] No active recording to stop');
      return { success: false, error: 'No active recording' };
    }

    // Create a promise that resolves when recording stops
    console.log('[offscreen] Setting up onstop handler...');
    const blobPromise = new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        console.log('[offscreen] MediaRecorder onstop fired');
        const mimeType = mediaRecorder.mimeType || 'video/webm';
        console.log('[offscreen] Creating blob with MIME type:', mimeType);
        console.log('[offscreen] Total chunks:', recordedChunks.length);
        
        const totalSize = recordedChunks.reduce((acc, chunk) => acc + chunk.size, 0);
        console.log('[offscreen] Total data size:', totalSize, 'bytes');
        
        const blob = new Blob(recordedChunks, { type: mimeType });
        console.log('[offscreen] Blob created, size:', blob.size);
        
        const blobUrl = URL.createObjectURL(blob);
        console.log('[offscreen] Blob URL created:', blobUrl.substring(0, 50) + '...');
        
        resolve(blobUrl);
      };
    });

    // Stop the recorder
    console.log('[offscreen] Stopping MediaRecorder...');
    mediaRecorder.stop();
    console.log('[offscreen] MediaRecorder.stop() called');

    // Stop all tracks
    if (mediaStream) {
      console.log('[offscreen] Stopping media stream tracks...');
      mediaStream.getTracks().forEach((track) => {
        console.log('[offscreen] Stopping track:', track.kind);
        track.stop();
      });
      mediaStream = null;
    }

    console.log('[offscreen] Waiting for blob URL...');
    const blobUrl = await blobPromise;
    console.log('[offscreen] Blob URL ready');

    // Save blob to IndexedDB for persistence across page reloads
    console.log('[offscreen] Saving video to IndexedDB...');
    const mimeType = mediaRecorder.mimeType || 'video/webm';
    const videoBlob = new Blob(recordedChunks, { type: mimeType });
    try {
      await saveVideoBlob(videoBlob);
      console.log('[offscreen] Video saved to IndexedDB');
    } catch (saveError) {
      console.warn('[offscreen] Failed to save to IndexedDB:', saveError);
      // Continue anyway - blob URL will still work for this session
    }

    // Store for base64 conversion
    lastRecordedBlob = videoBlob;

    console.log('[offscreen] ✅ Recording stopped successfully');
    return { success: true, blobUrl: blobUrl };
  } catch (error) {
    console.error('[offscreen] ❌ Failed to stop recording:', error);
    console.error('[offscreen] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message || 'Failed to stop recording' };
  }
}

/**
 * Get a supported MIME type for recording.
 * @returns {string}
 */
function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'video/webm';
}

/**
 * Convert the last recorded blob to base64.
 * @returns {Promise<{success: boolean, base64?: string, mimeType?: string, error?: string}>}
 */
async function getVideoAsBase64() {
  if (!lastRecordedBlob) {
    return { success: false, error: 'No recorded video available' };
  }

  try {
    const reader = new FileReader();
    const base64 = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(lastRecordedBlob);
    });

    return {
      success: true,
      base64: base64,
      mimeType: lastRecordedBlob.type,
    };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to convert video to base64' };
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[offscreen] Message received:', message.type);
  
  if (message.type === 'screen-recorder:start') {
    console.log('[offscreen] Handling start message...');
    startRecording(message.streamId).then((result) => {
      console.log('[offscreen] Start result:', JSON.stringify(result));
      sendResponse(result);
    });
    return true; // Async response
  }

  if (message.type === 'screen-recorder:stop') {
    console.log('[offscreen] Handling stop message...');
    stopRecording().then((result) => {
      console.log('[offscreen] Stop result:', JSON.stringify({ success: result.success, error: result.error, hasBlobUrl: !!result.blobUrl }));
      sendResponse(result);
    });
    return true; // Async response
  }

  if (message.type === 'get-video-base64') {
    console.log('[offscreen] Handling get-video-base64 message...');
    getVideoAsBase64().then((result) => {
      console.log('[offscreen] Base64 result:', { success: result.success, hasBase64: !!result.base64, mimeType: result.mimeType });
      sendResponse(result);
    });
    return true; // Async response
  }

  console.log('[offscreen] Unknown message type:', message.type);
  return false;
});

console.log('[offscreen] ✅ Screen recording offscreen document loaded and ready');
