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

const ANNOTATION_STYLE_PREFERENCES_KEY = 'editorAnnotationStylePreferences';
const CLOSE_AFTER_ACTION_KEY = 'editorCloseAfterAction';
const EXPORT_IMAGE_FORMAT = 'jpeg';
const EXPORT_IMAGE_MIME_TYPE = 'image/jpeg';
const EXPORT_IMAGE_QUALITY = 0.85;
const EXPORT_IMAGE_PIXEL_RATIO = 1;
const ANNOTATION_SHAPE_TYPES = new Set(['arrow', 'draw', 'geo', 'highlight', 'line', 'note', 'text']);
const SHARED_ANNOTATION_STYLE_IDS = new Set(['tldraw:color']);

/**
 * @typedef {Object} AnnotationStylePreference
 * @property {Record<string, string | number | boolean>} stylesForNextShape
 * @property {number | undefined} opacityForNextShape
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} AnnotationStylePreferences
 * @property {number} version
 * @property {Record<string, AnnotationStylePreference>} shapes
 * @property {Record<string, string | number | boolean>} sharedStylesForNextShape
 */

/**
 * @typedef {Object} ScreenshotInfo
 * @property {string} dataUrl
 * @property {number} width
 * @property {number} height
 * @property {string} mimeType
 */

/**
 * @typedef {Object} EditorState
 * @property {any} editor
 * @property {string | null} screenshotShapeId
 * @property {any} bounds
 * @property {boolean} isCroppingScreenshot
 * @property {boolean} closeAfterAction
 * @property {Record<string, number>} actionFeedbackTimers
 * @property {AnnotationStylePreferences} annotationStylePreferences
 * @property {number | null} stylePreferencesSaveTimer
 */

/** @type {EditorState} */
const editorState = {
  editor: null,
  screenshotShapeId: null,
  bounds: null,
  isCroppingScreenshot: false,
  closeAfterAction: false,
  actionFeedbackTimers: {},
  annotationStylePreferences: { version: 1, shapes: {}, sharedStylesForNextShape: {} },
  stylePreferencesSaveTimer: null,
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
 * @param {unknown} value
 * @returns {value is string | number | boolean}
 */
function isSerializableStyleValue(value) {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * @param {unknown} value
 * @returns {AnnotationStylePreferences}
 */
function normalizeAnnotationStylePreferences(value) {
  if (!value || typeof value !== 'object') {
    return { version: 1, shapes: {}, sharedStylesForNextShape: {} };
  }

  const source = /** @type {{ shapes?: unknown, sharedStylesForNextShape?: unknown }} */ (value);
  const shapes = source.shapes && typeof source.shapes === 'object' ? source.shapes : {};
  /** @type {Record<string, AnnotationStylePreference>} */
  const normalizedShapes = {};
  /** @type {Record<string, string | number | boolean>} */
  const sharedStylesForNextShape = {};

  if (
    source.sharedStylesForNextShape &&
    typeof source.sharedStylesForNextShape === 'object'
  ) {
    for (const [styleId, styleValue] of Object.entries(source.sharedStylesForNextShape)) {
      if (SHARED_ANNOTATION_STYLE_IDS.has(styleId) && isSerializableStyleValue(styleValue)) {
        sharedStylesForNextShape[styleId] = styleValue;
      }
    }
  }

  for (const [key, preference] of Object.entries(shapes)) {
    if (!preference || typeof preference !== 'object') continue;

    const sourcePreference = /** @type {{ stylesForNextShape?: unknown, opacityForNextShape?: unknown, updatedAt?: unknown }} */ (
      preference
    );
    const sourceStyles =
      sourcePreference.stylesForNextShape && typeof sourcePreference.stylesForNextShape === 'object'
        ? sourcePreference.stylesForNextShape
        : {};
    /** @type {Record<string, string | number | boolean>} */
    const stylesForNextShape = {};

    for (const [styleId, styleValue] of Object.entries(sourceStyles)) {
      if (isSerializableStyleValue(styleValue)) {
        stylesForNextShape[styleId] = styleValue;
      }
    }

    const opacityForNextShape =
      typeof sourcePreference.opacityForNextShape === 'number'
        ? Math.max(0, Math.min(1, sourcePreference.opacityForNextShape))
        : undefined;

    if (Object.keys(stylesForNextShape).length > 0 || opacityForNextShape !== undefined) {
      normalizedShapes[key] = {
        stylesForNextShape,
        opacityForNextShape,
        updatedAt:
          typeof sourcePreference.updatedAt === 'number'
            ? sourcePreference.updatedAt
            : Date.now(),
      };
    }
  }

  return { version: 1, shapes: normalizedShapes, sharedStylesForNextShape };
}

/**
 * @returns {Promise<AnnotationStylePreferences>}
 */
async function loadAnnotationStylePreferences() {
  const result = await chrome.storage.local.get(ANNOTATION_STYLE_PREFERENCES_KEY);
  return normalizeAnnotationStylePreferences(result[ANNOTATION_STYLE_PREFERENCES_KEY]);
}

/**
 * @returns {Promise<boolean>}
 */
async function loadCloseAfterActionPreference() {
  const result = await chrome.storage.local.get(CLOSE_AFTER_ACTION_KEY);
  return result[CLOSE_AFTER_ACTION_KEY] === true;
}

/**
 * @param {boolean} value
 * @returns {void}
 */
function saveCloseAfterActionPreference(value) {
  void chrome.storage.local.set({
    [CLOSE_AFTER_ACTION_KEY]: value,
  });
}

/**
 * @returns {void}
 */
function scheduleAnnotationStylePreferencesSave() {
  if (editorState.stylePreferencesSaveTimer !== null) {
    window.clearTimeout(editorState.stylePreferencesSaveTimer);
  }

  editorState.stylePreferencesSaveTimer = window.setTimeout(() => {
    editorState.stylePreferencesSaveTimer = null;
    void chrome.storage.local.set({
      [ANNOTATION_STYLE_PREFERENCES_KEY]: editorState.annotationStylePreferences,
    });
  }, 250);
}

/**
 * @param {any} shape
 * @returns {boolean}
 */
function isAnnotationShape(shape) {
  return Boolean(shape && ANNOTATION_SHAPE_TYPES.has(shape.type));
}

/**
 * @param {any} shape
 * @returns {string | null}
 */
function getAnnotationStylePreferenceKeyForShape(shape) {
  if (!isAnnotationShape(shape)) return null;
  if (shape.type === 'geo') {
    return `geo:${typeof shape.props?.geo === 'string' ? shape.props.geo : 'rectangle'}`;
  }

  return shape.type;
}

/**
 * @param {any} editor
 * @param {string} shapeType
 * @returns {Map<any, string> | null}
 */
function getShapeStyleProps(editor, shapeType) {
  const styleProps = editor?.styleProps?.[shapeType];
  return styleProps instanceof Map ? styleProps : null;
}

/**
 * @param {any} editor
 * @param {any} shape
 * @returns {AnnotationStylePreference | null}
 */
function getAnnotationStylePreferenceForShape(editor, shape) {
  const styleProps = getShapeStyleProps(editor, shape.type);
  if (!styleProps) return null;

  /** @type {Record<string, string | number | boolean>} */
  const stylesForNextShape = {};

  for (const [styleProp, propName] of styleProps) {
    const value = shape.props?.[propName];
    if (styleProp?.id && isSerializableStyleValue(value)) {
      stylesForNextShape[styleProp.id] = value;
    }
  }

  const opacityForNextShape =
    typeof shape.opacity === 'number' ? Math.max(0, Math.min(1, shape.opacity)) : undefined;

  if (Object.keys(stylesForNextShape).length === 0 && opacityForNextShape === undefined) {
    return null;
  }

  return {
    stylesForNextShape,
    opacityForNextShape,
    updatedAt: Date.now(),
  };
}

/**
 * @param {Record<string, string | number | boolean>} styles
 * @returns {Record<string, string | number | boolean>}
 */
function getSharedAnnotationStyles(styles) {
  /** @type {Record<string, string | number | boolean>} */
  const sharedStyles = {};

  for (const [styleId, value] of Object.entries(styles)) {
    if (SHARED_ANNOTATION_STYLE_IDS.has(styleId) && isSerializableStyleValue(value)) {
      sharedStyles[styleId] = value;
    }
  }

  return sharedStyles;
}

/**
 * @param {Record<string, string | number | boolean>} styles
 * @returns {void}
 */
function rememberSharedAnnotationStyles(styles) {
  const sharedStyles = getSharedAnnotationStyles(styles);
  if (Object.keys(sharedStyles).length === 0) return;

  editorState.annotationStylePreferences = {
    version: 1,
    shapes: editorState.annotationStylePreferences.shapes,
    sharedStylesForNextShape: {
      ...editorState.annotationStylePreferences.sharedStylesForNextShape,
      ...sharedStyles,
    },
  };
  scheduleAnnotationStylePreferencesSave();
}

/**
 * @param {any} editor
 * @returns {void}
 */
function rememberSharedAnnotationStylesFromEditor(editor) {
  const styles = editor?.getInstanceState?.()?.stylesForNextShape;
  if (!styles || typeof styles !== 'object') return;
  rememberSharedAnnotationStyles(styles);
}

/**
 * @param {any} editor
 * @returns {{ key: string } | null}
 */
function getCurrentAnnotationStylePreferenceTarget(editor) {
  const shapeType = editor?.getCurrentTool?.()?.shapeType;
  if (!ANNOTATION_SHAPE_TYPES.has(shapeType)) return null;

  if (shapeType === 'geo') {
    const geo = editor.getInstanceState?.().stylesForNextShape?.['tldraw:geo'];
    return { key: `geo:${typeof geo === 'string' ? geo : 'rectangle'}` };
  }

  return { key: shapeType };
}

/**
 * @param {any} editor
 * @param {string} key
 * @returns {void}
 */
function applyAnnotationStylePreference(editor, key) {
  const preference = editorState.annotationStylePreferences.shapes[key];
  const sharedStyles = editorState.annotationStylePreferences.sharedStylesForNextShape;

  if (!preference && Object.keys(sharedStyles).length === 0) return;

  const instanceState = editor.getInstanceState?.();
  if (!instanceState) return;

  /** @type {{ stylesForNextShape: Record<string, string | number | boolean>, opacityForNextShape?: number }} */
  const nextState = {
    stylesForNextShape: {
      ...(instanceState.stylesForNextShape || {}),
      ...(preference?.stylesForNextShape || {}),
      ...sharedStyles,
    },
  };

  if (preference?.opacityForNextShape !== undefined) {
    nextState.opacityForNextShape = preference.opacityForNextShape;
  }

  editor.updateInstanceState(nextState);
}

/**
 * @param {any} editor
 * @returns {void}
 */
function applyCurrentAnnotationStylePreference(editor) {
  const target = getCurrentAnnotationStylePreferenceTarget(editor);
  if (!target) return;
  applyAnnotationStylePreference(editor, target.key);
}

/**
 * @param {string} key
 * @param {AnnotationStylePreference | null} preference
 * @returns {void}
 */
function rememberAnnotationStylePreference(key, preference) {
  if (!preference) return;
  rememberSharedAnnotationStyles(preference.stylesForNextShape);

  editorState.annotationStylePreferences = {
    version: 1,
    shapes: {
      ...editorState.annotationStylePreferences.shapes,
      [key]: preference,
    },
    sharedStylesForNextShape: editorState.annotationStylePreferences.sharedStylesForNextShape,
  };
  scheduleAnnotationStylePreferencesSave();
}

/**
 * @param {any} editor
 * @param {any} shape
 * @returns {void}
 */
function rememberAnnotationShapeStyle(editor, shape) {
  const key = getAnnotationStylePreferenceKeyForShape(shape);
  if (!key) return;
  rememberAnnotationStylePreference(key, getAnnotationStylePreferenceForShape(editor, shape));
}

/**
 * @param {any} value
 * @returns {any[]}
 */
function getChangeRecords(value) {
  if (!value) return [];
  if (value instanceof Map) return Array.from(value.values());
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return Object.values(value);
  return [];
}

/**
 * @param {any} editor
 * @returns {() => void}
 */
function bindAnnotationStylePreferences(editor) {
  applyCurrentAnnotationStylePreference(editor);

  const scheduleApplyCurrentPreference = () => {
    window.requestAnimationFrame(() => {
      rememberSharedAnnotationStylesFromEditor(editor);
      applyCurrentAnnotationStylePreference(editor);
    });
  };
  const applyBeforeCreatingShape = () => {
    rememberSharedAnnotationStylesFromEditor(editor);
    applyCurrentAnnotationStylePreference(editor);
  };

  document.addEventListener('pointerdown', applyBeforeCreatingShape, true);
  document.addEventListener('pointerup', scheduleApplyCurrentPreference, true);
  document.addEventListener('keydown', scheduleApplyCurrentPreference, true);

  const disposeDocumentListener = editor.store.listen(
    ({ changes }) => {
      for (const record of getChangeRecords(changes?.added)) {
        if (record?.typeName === 'shape') {
          rememberAnnotationShapeStyle(editor, record);
        }
      }

      for (const value of getChangeRecords(changes?.updated)) {
        const record = Array.isArray(value) ? value[1] : value;
        if (record?.typeName === 'shape') {
          rememberAnnotationShapeStyle(editor, record);
        }
      }
    },
    { source: 'user', scope: 'document' }
  );

  return () => {
    document.removeEventListener('pointerdown', applyBeforeCreatingShape, true);
    document.removeEventListener('pointerup', scheduleApplyCurrentPreference, true);
    document.removeEventListener('keydown', scheduleApplyCurrentPreference, true);
    disposeDocumentListener?.();
  };
}

/**
 * @returns {HTMLButtonElement | null}
 */
function getCropButton() {
  return /** @type {HTMLButtonElement | null} */ (document.getElementById('action-crop'));
}

/**
 * @param {boolean} active
 * @returns {void}
 */
function setCropButtonActive(active) {
  const button = getCropButton();
  if (!button) return;
  button.classList.toggle('btn-active', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
}

/**
 * @returns {any | null}
 */
function getScreenshotShape() {
  const { editor, screenshotShapeId } = editorState;
  if (!editor || !screenshotShapeId) return null;
  return editor.getShape?.(screenshotShapeId) || null;
}

/**
 * @returns {void}
 */
function updateScreenshotExportBounds() {
  const { editor, screenshotShapeId } = editorState;
  if (!editor || !screenshotShapeId) return;

  const bounds = editor.getShapePageBounds?.(screenshotShapeId);
  if (bounds) {
    editorState.bounds = bounds;
  }
}

/**
 * @param {boolean} locked
 * @returns {void}
 */
function setScreenshotLocked(locked) {
  const { editor } = editorState;
  const shape = getScreenshotShape();
  if (!editor || !shape || shape.isLocked === locked) return;

  editor.run(
    () => {
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        isLocked: locked,
      });
    },
    { history: 'ignore', ignoreShapeLock: true }
  );
}

/**
 * @returns {boolean}
 */
function isScreenshotCropModeActive() {
  const { editor, screenshotShapeId } = editorState;
  if (!editor || !screenshotShapeId) return false;

  const croppingShapeId = editor.getCroppingShapeId?.();
  if (croppingShapeId === screenshotShapeId) return true;

  const selectedShapeIds = editor.getSelectedShapeIds?.() || [];
  return selectedShapeIds.includes(screenshotShapeId) && Boolean(editor.isIn?.('select.crop'));
}

/**
 * @returns {void}
 */
function syncScreenshotCropState() {
  const active = isScreenshotCropModeActive();
  setCropButtonActive(active);
  updateScreenshotExportBounds();

  if (editorState.isCroppingScreenshot && !active) {
    editorState.isCroppingScreenshot = false;
    setScreenshotLocked(true);
    updateScreenshotExportBounds();
  }
}

/**
 * @param {any} editor
 * @returns {() => void}
 */
function bindScreenshotCropState(editor) {
  let syncFrame = 0;
  const scheduleSync = () => {
    if (syncFrame) return;
    syncFrame = window.requestAnimationFrame(() => {
      syncFrame = 0;
      syncScreenshotCropState();
    });
  };

  const disposeStoreListener = editor.store.listen(scheduleSync);
  document.addEventListener('pointerup', scheduleSync, true);
  document.addEventListener('keydown', scheduleSync, true);

  return () => {
    if (syncFrame) {
      window.cancelAnimationFrame(syncFrame);
    }
    document.removeEventListener('pointerup', scheduleSync, true);
    document.removeEventListener('keydown', scheduleSync, true);
    disposeStoreListener?.();
  };
}

/**
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
function isEditableShortcutTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

/**
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
function isCropShortcutEvent(event) {
  return (
    event.key.toLowerCase() === 'c' &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    !isEditableShortcutTarget(event.target) &&
    !editorState.editor?.getEditingShapeId?.()
  );
}

/**
 * @param {KeyboardEvent} event
 * @returns {void}
 */
function handleScreenshotEditorShortcut(event) {
  if (!isCropShortcutEvent(event) || isScreenshotCropModeActive()) return;

  event.preventDefault();
  event.stopPropagation();
  startScreenshotCrop();
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
 * @returns {void}
 */
function startScreenshotCrop() {
  if (isScreenshotCropModeActive()) {
    finishScreenshotCrop();
    return;
  }

  const { editor, screenshotShapeId } = editorState;
  const shape = getScreenshotShape();

  if (!editor || !screenshotShapeId || !shape) {
    alert('Screenshot editor is not ready yet.');
    return;
  }

  editor.complete?.();
  editor.run(
    () => {
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        isLocked: false,
      });
      editor.select(screenshotShapeId);
      editor.setCroppingShape?.(screenshotShapeId);
      editor.setCurrentTool('select.crop.idle');
    },
    { history: 'ignore', ignoreShapeLock: true }
  );

  editorState.isCroppingScreenshot = true;
  setCropButtonActive(true);
}

/**
 * @returns {void}
 */
function finishScreenshotCrop() {
  const { editor } = editorState;
  if (!editor || (!editorState.isCroppingScreenshot && !isScreenshotCropModeActive())) return;

  editor.complete?.();
  editor.setCroppingShape?.(null);
  editor.setCurrentTool?.('select.idle');
  editorState.isCroppingScreenshot = false;
  setScreenshotLocked(true);
  setCropButtonActive(false);
  updateScreenshotExportBounds();
}

/**
 * @param {'png' | 'jpeg'} format
 * @returns {Promise<Blob>}
 */
async function exportAnnotatedScreenshot(format) {
  const { editor } = editorState;
  if (!editor || !editorState.bounds) {
    throw new Error('Screenshot editor is not ready yet.');
  }

  finishScreenshotCrop();
  editor.selectNone();
  updateScreenshotExportBounds();
  if (!editorState.bounds) {
    throw new Error('Screenshot editor is not ready yet.');
  }

  const shapeIds = Array.from(editor.getCurrentPageShapeIds());
  const result = await editor.toImage(shapeIds, {
    format,
    bounds: editorState.bounds,
    background: true,
    padding: 0,
    pixelRatio: EXPORT_IMAGE_PIXEL_RATIO,
    ...(format === 'jpeg' ? { quality: EXPORT_IMAGE_QUALITY } : {}),
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
  return `screenshot-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.jpg`;
}

/**
 * @returns {Promise<void>}
 */
async function copyToClipboard() {
  const button = /** @type {HTMLButtonElement | null} */ (document.getElementById('action-copy'));
  try {
    setButtonBusy(button, true);
    const blob = await exportAnnotatedScreenshot(EXPORT_IMAGE_FORMAT);
    await navigator.clipboard.write([new ClipboardItem({ [EXPORT_IMAGE_MIME_TYPE]: blob })]);
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
    const blob = await exportAnnotatedScreenshot(EXPORT_IMAGE_FORMAT);
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
      const disposeAnnotationStylePreferences = bindAnnotationStylePreferences(editor);
      const disposeScreenshotCropState = bindScreenshotCropState(editor);
      hideStatus();
      return () => {
        disposeAnnotationStylePreferences();
        disposeScreenshotCropState();
      };
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
  if (closeAfter) {
    closeAfter.checked = editorState.closeAfterAction;
  }

  closeAfter?.addEventListener('change', () => {
    editorState.closeAfterAction = Boolean(closeAfter.checked);
    saveCloseAfterActionPreference(editorState.closeAfterAction);
  });

  getCropButton()?.addEventListener('click', () => {
    startScreenshotCrop();
  });
  document.addEventListener('keydown', handleScreenshotEditorShortcut, true);
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
    const [screenshot, annotationStylePreferences, closeAfterAction] = await Promise.all([
      loadStoredScreenshot(),
      loadAnnotationStylePreferences(),
      loadCloseAfterActionPreference(),
    ]);
    editorState.annotationStylePreferences = annotationStylePreferences;
    editorState.closeAfterAction = closeAfterAction;

    const closeAfter = /** @type {HTMLInputElement | null} */ (
      document.getElementById('prop-close-after')
    );
    if (closeAfter) {
      closeAfter.checked = closeAfterAction;
    }

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
