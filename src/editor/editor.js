import {
  AssetRecordType,
  Tldraw,
  createElement,
  createRoot,
  createShapeId,
  getAssetUrls,
  useCallback,
  useMemo,
} from '../libs/tldraw/tldraw-vendor.mjs';

/**
 * @typedef {Object} ScreenshotInfo
 * @property {string} dataUrl
 * @property {number} width
 * @property {number} height
 * @property {string} mimeType
 */

/** @type {{ editor: any, screenshotShapeId: string | null, bounds: any, closeAfterAction: boolean, actionFeedbackTimers: Record<string, number> }} */
const editorState = {
  editor: null,
  screenshotShapeId: null,
  bounds: null,
  closeAfterAction: false,
  actionFeedbackTimers: {},
};

const h = createElement;

/**
 * @param {string} message
 * @returns {void}
 */
function setStatus(message) {
  const status = document.getElementById('editor-status');
  if (!status) return;
  status.textContent = message;
  status.classList.remove('hidden');
}

/**
 * @returns {void}
 */
function hideStatus() {
  const status = document.getElementById('editor-status');
  if (!status) return;
  status.classList.add('hidden');
}

/**
 * @returns {string}
 */
function getSuccessIconSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
}

/**
 * @param {string} buttonId
 * @returns {void}
 */
function showActionSuccessIcon(buttonId) {
  const button = /** @type {HTMLButtonElement | null} */ (document.getElementById(buttonId));
  if (!button) return;

  if (!button.dataset.originalIconHtml) {
    button.dataset.originalIconHtml = button.innerHTML;
  }

  const existingTimer = editorState.actionFeedbackTimers[buttonId];
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  button.innerHTML = getSuccessIconSvg();
  editorState.actionFeedbackTimers[buttonId] = window.setTimeout(() => {
    if (button.dataset.originalIconHtml) {
      button.innerHTML = button.dataset.originalIconHtml;
    }
    delete editorState.actionFeedbackTimers[buttonId];
  }, 2000);
}

/**
 * @param {HTMLButtonElement | null} button
 * @param {boolean} busy
 * @returns {void}
 */
function setButtonBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle('loading', busy);
}

/**
 * @param {string} dataUrl
 * @returns {Promise<ScreenshotInfo>}
 */
function loadScreenshotInfo(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const mimeType = /^data:([^;,]+)/.exec(dataUrl)?.[1] || 'image/png';
      resolve({
        dataUrl,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        mimeType,
      });
    };
    image.onerror = () => reject(new Error('Failed to load screenshot image'));
    image.src = dataUrl;
  });
}

/**
 * @returns {Promise<ScreenshotInfo>}
 */
async function loadStoredScreenshot() {
  const result = await chrome.storage.local.get('editorScreenshot');
  const dataUrl = typeof result.editorScreenshot === 'string' ? result.editorScreenshot : '';

  if (!dataUrl) {
    throw new Error('No screenshot found. Take a screenshot again.');
  }

  return loadScreenshotInfo(dataUrl);
}

/**
 * @param {any} editor
 * @param {ScreenshotInfo} screenshot
 * @returns {void}
 */
function insertScreenshot(editor, screenshot) {
  const assetId = AssetRecordType.createId();
  const shapeId = createShapeId('screenshot-background');

  editor.run(
    () => {
      editor.createAssets([
        {
          id: assetId,
          typeName: 'asset',
          type: 'image',
          props: {
            name: 'screenshot.png',
            src: screenshot.dataUrl,
            w: screenshot.width,
            h: screenshot.height,
            mimeType: screenshot.mimeType,
            isAnimated: false,
          },
          meta: {},
        },
      ]);

      editor.createShape({
        id: shapeId,
        type: 'image',
        x: 0,
        y: 0,
        isLocked: true,
        props: {
          assetId,
          w: screenshot.width,
          h: screenshot.height,
          altText: 'Captured screenshot',
        },
      });

      editor.selectNone();
    },
    { history: 'ignore', ignoreShapeLock: true }
  );

  editorState.screenshotShapeId = shapeId;
  editorState.bounds =
    editor.getShapePageBounds(shapeId) || {
      x: 0,
      y: 0,
      w: screenshot.width,
      h: screenshot.height,
    };

  editor.zoomToBounds(editorState.bounds, { immediate: true, inset: 64 });
}

/**
 * @param {'png' | 'jpeg'} format
 * @returns {Promise<Blob>}
 */
async function exportAnnotatedScreenshot(format) {
  const { editor, bounds } = editorState;
  if (!editor || !bounds) {
    throw new Error('Screenshot editor is not ready yet.');
  }

  editor.selectNone();
  const shapeIds = Array.from(editor.getCurrentPageShapeIds());
  const result = await editor.toImage(shapeIds, {
    format,
    bounds,
    background: true,
    padding: 0,
    pixelRatio: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
  });

  if (!result || !result.blob) {
    throw new Error('Failed to export annotated screenshot.');
  }

  return result.blob;
}

/**
 * @returns {string}
 */
function createScreenshotFilename() {
  return `screenshot-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
}

/**
 * @returns {Promise<void>}
 */
async function copyToClipboard() {
  const button = /** @type {HTMLButtonElement | null} */ (document.getElementById('action-copy'));
  try {
    setButtonBusy(button, true);
    const blob = await exportAnnotatedScreenshot('png');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showActionSuccessIcon('action-copy');

    if (editorState.closeAfterAction) {
      window.setTimeout(() => window.close(), 500);
    }
  } catch (error) {
    console.error('[editor] Failed to copy annotated screenshot:', error);
    alert(error instanceof Error ? error.message : 'Failed to copy to clipboard.');
  } finally {
    setButtonBusy(button, false);
  }
}

/**
 * @returns {Promise<void>}
 */
async function saveImage() {
  const button = /** @type {HTMLButtonElement | null} */ (document.getElementById('action-save'));
  let objectUrl = '';
  try {
    setButtonBusy(button, true);
    const blob = await exportAnnotatedScreenshot('png');
    objectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = createScreenshotFilename();
    link.href = objectUrl;
    link.click();

    showActionSuccessIcon('action-save');

    if (editorState.closeAfterAction) {
      window.setTimeout(() => window.close(), 500);
    }
  } catch (error) {
    console.error('[editor] Failed to save annotated screenshot:', error);
    alert(error instanceof Error ? error.message : 'Failed to save screenshot.');
  } finally {
    if (objectUrl) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
    setButtonBusy(button, false);
  }
}

/**
 * @param {{ screenshot: ScreenshotInfo }} props
 * @returns {any}
 */
function ScreenshotEditorApp({ screenshot }) {
  const assetUrls = useMemo(() => {
    return getAssetUrls({
      baseUrl: chrome.runtime.getURL('src/libs/tldraw/assets'),
    });
  }, []);

  const handleMount = useCallback(
    (editor) => {
      editorState.editor = editor;
      insertScreenshot(editor, screenshot);
      hideStatus();
    },
    [screenshot]
  );

  return h(Tldraw, {
    assetUrls,
    autoFocus: true,
    onMount: handleMount,
  });
}

/**
 * @returns {void}
 */
function bindActions() {
  const closeAfter = /** @type {HTMLInputElement | null} */ (
    document.getElementById('prop-close-after')
  );
  closeAfter?.addEventListener('change', () => {
    editorState.closeAfterAction = Boolean(closeAfter.checked);
  });

  document.getElementById('action-copy')?.addEventListener('click', () => {
    void copyToClipboard();
  });
  document.getElementById('action-save')?.addEventListener('click', () => {
    void saveImage();
  });
}

/**
 * @returns {Promise<void>}
 */
async function init() {
  bindActions();

  try {
    const screenshot = await loadStoredScreenshot();
    const mountNode = document.getElementById('tldraw-editor');
    if (!mountNode) {
      throw new Error('Screenshot editor mount node is missing.');
    }

    const root = createRoot(mountNode);
    root.render(h(ScreenshotEditorApp, { screenshot }));
  } catch (error) {
    console.error('[editor] Failed to initialize screenshot editor:', error);
    setStatus(error instanceof Error ? error.message : 'Failed to initialize screenshot editor.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void init();
});
