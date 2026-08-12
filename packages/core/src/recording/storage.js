/* global indexedDB */

/**
 * @fileoverview IndexedDB storage for screen recordings.
 * Allows recordings to persist across page reloads.
 */

const DB_NAME = 'nenya-recordings';
const DB_VERSION = 1;
const STORE_NAME = 'videos';
const CURRENT_RECORDING_KEY = 'current';

/**
 * Open the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[storage] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
        console.log('[storage] Created object store:', STORE_NAME);
      }
    };
  });
}

/**
 * Save a video blob to IndexedDB.
 * @param {Blob} blob - The video blob to save
 * @param {string} [key=CURRENT_RECORDING_KEY] - The key to store under
 * @returns {Promise<void>}
 */
export async function saveVideoBlob(blob, key = CURRENT_RECORDING_KEY) {
  console.log('[storage] Saving video blob, size:', blob.size);
  
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Store blob with timestamp
    const data = {
      blob: blob,
      timestamp: Date.now(),
      size: blob.size,
      type: blob.type,
    };
    
    const request = store.put(data, key);
    
    request.onerror = () => {
      console.error('[storage] Failed to save video:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      console.log('[storage] Video saved successfully');
      resolve();
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Load a video blob from IndexedDB.
 * @param {string} [key=CURRENT_RECORDING_KEY] - The key to load from
 * @returns {Promise<{blob: Blob, timestamp: number, size: number, type: string} | null>}
 */
export async function loadVideoBlob(key = CURRENT_RECORDING_KEY) {
  console.log('[storage] Loading video blob...');
  
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onerror = () => {
        console.error('[storage] Failed to load video:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        const data = request.result;
        if (data && data.blob) {
          console.log('[storage] Video loaded, size:', data.size);
          resolve(data);
        } else {
          console.log('[storage] No video found');
          resolve(null);
        }
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[storage] Error loading video:', error);
    return null;
  }
}

/**
 * Delete a video from IndexedDB.
 * @param {string} [key=CURRENT_RECORDING_KEY] - The key to delete
 * @returns {Promise<void>}
 */
export async function deleteVideoBlob(key = CURRENT_RECORDING_KEY) {
  console.log('[storage] Deleting video blob...');
  
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      
      request.onerror = () => {
        console.error('[storage] Failed to delete video:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        console.log('[storage] Video deleted successfully');
        resolve();
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[storage] Error deleting video:', error);
  }
}

/**
 * Check if a video exists in IndexedDB.
 * @param {string} [key=CURRENT_RECORDING_KEY] - The key to check
 * @returns {Promise<boolean>}
 */
export async function hasVideoBlob(key = CURRENT_RECORDING_KEY) {
  const data = await loadVideoBlob(key);
  return data !== null;
}
