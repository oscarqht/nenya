/* global chrome */

/**
 * @fileoverview Preview page for screen recordings.
 * Allows users to view and download their recordings.
 */

import '../options/theme.js';
import { loadVideoBlob, deleteVideoBlob } from './storage.js';

(function () {
  'use strict';

  // DOM Elements
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const errorMessage = document.getElementById('errorMessage');
  const videoContainer = document.getElementById('videoContainer');
  const videoPlayer = /** @type {HTMLVideoElement} */ (document.getElementById('videoPlayer'));
  const videoInfo = document.getElementById('videoInfo');
  const downloadBtn = /** @type {HTMLButtonElement} */ (document.getElementById('downloadBtn'));
  const newRecordingBtn = document.getElementById('newRecordingBtn');

  /** @type {string | null} */
  let currentVideoUrl = null;

  /** @type {Blob | null} */
  let currentVideoBlob = null;

  /**
   * Show error state with message.
   * @param {string} message - Error message to display
   */
  function showError(message) {
    if (loadingState) loadingState.classList.add('hidden');
    if (videoContainer) videoContainer.classList.add('hidden');
    if (errorState) errorState.classList.remove('hidden');
    if (errorMessage) errorMessage.textContent = message;
  }

  /**
   * Show video player with the loaded video.
   */
  function showVideo() {
    if (loadingState) loadingState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (videoContainer) videoContainer.classList.remove('hidden');
    if (downloadBtn) downloadBtn.disabled = false;
  }

  /**
   * Format file size for display.
   * @param {number} bytes - Size in bytes
   * @returns {string}
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format duration for display.
   * @param {number} seconds - Duration in seconds
   * @returns {string}
   */
  function formatDuration(seconds) {
    // Handle invalid duration values
    if (!Number.isFinite(seconds) || seconds < 0) {
      return 'Unknown';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Update video info display.
   */
  function updateVideoInfo() {
    if (!videoInfo || !videoPlayer) return;
    
    // Show duration if available
    if (Number.isFinite(videoPlayer.duration) && videoPlayer.duration > 0) {
      videoInfo.textContent = `Duration: ${formatDuration(videoPlayer.duration)}`;
    } else {
      // Duration not yet available, hide the info for now
      videoInfo.textContent = '';
    }
  }

  /**
   * Generate a filename for the download.
   * @returns {string}
   */
  function generateFilename() {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `screen-recording-${dateStr}.webm`;
  }

  /**
   * Try to load video from blob URL.
   * Also tries to get the blob from IndexedDB for download support.
   * @param {string} videoUrl - The blob URL
   * @returns {Promise<boolean>} - Whether loading succeeded
   */
  async function tryLoadFromBlobUrl(videoUrl) {
    // Also try to get the blob from IndexedDB for download support
    try {
      const data = await loadVideoBlob();
      if (data && data.blob) {
        currentVideoBlob = data.blob;
        console.log('[preview] Got blob from IndexedDB for download support');
      }
    } catch (e) {
      console.warn('[preview] Could not get blob from IndexedDB:', e);
    }

    return new Promise((resolve) => {
      if (!videoPlayer) {
        resolve(false);
        return;
      }

      const timeoutId = setTimeout(() => {
        console.warn('[preview] Blob URL load timed out, trying fallback');
        resolve(false);
      }, 3000);

      videoPlayer.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        currentVideoUrl = videoUrl;
        resolve(true);
      };

      videoPlayer.onerror = () => {
        clearTimeout(timeoutId);
        console.warn('[preview] Failed to load from blob URL, trying fallback');
        resolve(false);
      };

      videoPlayer.src = videoUrl;
    });
  }

  /**
   * Try to load video from IndexedDB storage.
   * @returns {Promise<boolean>} - Whether loading succeeded
   */
  async function tryLoadFromIndexedDB() {
    try {
      console.log('[preview] Attempting to load from IndexedDB...');
      const data = await loadVideoBlob();
      
      if (!data || !data.blob) {
        console.log('[preview] No video found in IndexedDB');
        return false;
      }

      console.log('[preview] Video found in IndexedDB, size:', data.size);
      currentVideoBlob = data.blob;
      currentVideoUrl = URL.createObjectURL(currentVideoBlob);

      if (videoPlayer) {
        videoPlayer.src = currentVideoUrl;
      }

      return true;
    } catch (error) {
      console.error('[preview] Failed to load from IndexedDB:', error);
      return false;
    }
  }

  /**
   * Load video from base64 data via messaging.
   * @returns {Promise<boolean>} - Whether loading succeeded
   */
  async function tryLoadFromBase64() {
    try {
      console.log('[preview] Requesting video as base64...');
      const response = await chrome.runtime.sendMessage({
        type: 'screen-recorder:get-video-blob',
      });

      if (!response || !response.success || !response.base64) {
        console.error('[preview] Failed to get base64 video:', response?.error);
        return false;
      }

      // Convert base64 data URL to blob
      const fetchResponse = await fetch(response.base64);
      currentVideoBlob = await fetchResponse.blob();
      currentVideoUrl = URL.createObjectURL(currentVideoBlob);

      if (videoPlayer) {
        videoPlayer.src = currentVideoUrl;
      }

      return true;
    } catch (error) {
      console.error('[preview] Failed to load from base64:', error);
      return false;
    }
  }

  /**
   * Load video from URL parameter or storage.
   */
  async function loadVideo() {
    try {
      // First, try to get video URL from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      let videoUrl = urlParams.get('video');

      // If not in URL params, try session storage
      if (!videoUrl) {
        const stored = await chrome.storage.session.get('recordedVideoUrl');
        videoUrl = stored.recordedVideoUrl;
      }

      let loaded = false;

      // Try loading from blob URL first (fastest if still valid)
      if (videoUrl && videoUrl.startsWith('blob:')) {
        console.log('[preview] Trying to load from blob URL...');
        loaded = await tryLoadFromBlobUrl(videoUrl);
      }

      // If blob URL failed or not available, try IndexedDB (persistent storage)
      if (!loaded) {
        console.log('[preview] Trying to load from IndexedDB...');
        loaded = await tryLoadFromIndexedDB();
      }

      // If IndexedDB failed, try base64 from offscreen document (if still open)
      if (!loaded) {
        console.log('[preview] Trying to load from base64...');
        loaded = await tryLoadFromBase64();
      }

      if (!loaded) {
        showError('No recording found. Please start a new recording.');
        return;
      }

      // Wait for video to be ready
      if (videoPlayer) {
        videoPlayer.onloadedmetadata = () => {
          showVideo();

          // Update video info
          updateVideoInfo();

          // Tell background to close the offscreen document
          chrome.runtime.sendMessage({ type: 'screen-recorder:close-offscreen' });
        };

        // Update info when duration becomes available (for streaming videos)
        videoPlayer.ondurationchange = () => {
          updateVideoInfo();
        };

        // If metadata is already loaded
        if (videoPlayer.readyState >= 1) {
          showVideo();
          updateVideoInfo();
          chrome.runtime.sendMessage({ type: 'screen-recorder:close-offscreen' });
        }
      }
    } catch (error) {
      console.error('[preview] Failed to load video:', error);
      showError('Failed to load video: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Download the current video.
   */
  async function downloadVideo() {
    try {
      // If we don't have the blob, try to get it from IndexedDB
      if (!currentVideoBlob) {
        console.log('[preview] No blob in memory, trying IndexedDB...');
        const data = await loadVideoBlob();
        if (data && data.blob) {
          currentVideoBlob = data.blob;
          console.log('[preview] Got blob from IndexedDB');
        }
      }

      // If still no blob and we have a URL, try to fetch it
      if (!currentVideoBlob && currentVideoUrl) {
        console.log('[preview] Trying to fetch blob from URL...');
        const response = await fetch(currentVideoUrl);
        currentVideoBlob = await response.blob();
      }

      if (!currentVideoBlob) {
        throw new Error('No video data available');
      }

      // Create a download link
      const filename = generateFilename();
      const downloadUrl = URL.createObjectURL(currentVideoBlob);

      // Use Chrome downloads API
      await chrome.downloads.download({
        url: downloadUrl,
        filename: filename,
        saveAs: true,
      });
    } catch (error) {
      console.error('[preview] Failed to download video:', error);
      alert('Failed to download video: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Start a new recording.
   */
  async function startNewRecording() {
    try {
      // Clean up current recording from IndexedDB
      console.log('[preview] Cleaning up old recording...');
      await deleteVideoBlob();
      
      // Send message to background to start new recording
      await chrome.runtime.sendMessage({
        type: 'screen-recorder:start-new',
      });
      // Close this tab
      window.close();
    } catch (error) {
      console.error('[preview] Failed to start new recording:', error);
    }
  }

  // Event listeners
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadVideo);
  }

  if (newRecordingBtn) {
    newRecordingBtn.addEventListener('click', startNewRecording);
  }

  // Notify background when page loads (to cancel any pending deletion)
  chrome.runtime.sendMessage({ type: 'screen-recorder:preview-opened' });

  // Clean up blob URLs when page unloads
  window.addEventListener('beforeunload', () => {
    if (currentVideoUrl && currentVideoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentVideoUrl);
    }
    // Clear session storage
    chrome.storage.session.remove('recordedVideoUrl');
    
    // Notify background to schedule deletion (1 minute after page closes)
    chrome.runtime.sendMessage({ type: 'screen-recorder:preview-closed' });
  });

  // Load video on page load
  loadVideo();
})();
