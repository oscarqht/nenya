/**
 * @fileoverview Custom Search Engines options section.
 * Allows users to manage custom search engine shortcuts.
 */

/* global chrome, getCustomSearchEngines, saveCustomSearchEngines, validateSearchEngine, normalizeSearchEngine */

let engines = [];
let editingId = null;

/**
 * Escapes HTML to prevent XSS.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Renders the list of custom search engines.
 */
function renderEngines() {
  const listContainer = document.getElementById('customSearchEnginesList');
  if (!listContainer) {
    return;
  }

  if (engines.length === 0) {
    listContainer.innerHTML = `
      <div class="text-base-content/60 text-sm text-center py-8">
        No custom search engines configured. Add one to get started!
      </div>
    `;
    return;
  }

  listContainer.innerHTML = engines
    .map(
      (engine) => `
    <div class="flex items-center gap-2 p-3 bg-base-200 rounded-lg">
      <div class="flex-1 min-w-0">
        <div class="font-medium truncate">${escapeHtml(engine.name)}</div>
        <div class="text-sm text-base-content/60 truncate">
          Shortcut: <code class="bg-base-300 px-1 rounded">${escapeHtml(
            engine.shortcut,
          )}</code>
        </div>
        <div class="text-xs text-base-content/50 truncate mt-1">
          ${escapeHtml(engine.searchUrl)}
        </div>
      </div>
      <div class="flex gap-1">
        <button class="btn btn-xs btn-ghost" data-action="edit" data-id="${
          engine.id
        }">
          Edit
        </button>
        <button class="btn btn-xs btn-ghost text-error" data-action="delete" data-id="${
          engine.id
        }">
          Delete
        </button>
      </div>
    </div>
  `,
    )
    .join('');
}

/**
 * Handles clicks on the engine list.
 * @param {Event} event
 */
function handleListClick(event) {
  const target = /** @type {HTMLElement} */ (event.target);
  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === 'edit' && id) {
    showEditDialog(id);
  } else if (action === 'delete' && id) {
    void handleDelete(id);
  }
}

/**
 * Shows the add dialog.
 */
function showAddDialog() {
  console.log('[customSearchEngines] showAddDialog called');
  editingId = null;
  const dialog = /** @type {HTMLDialogElement | null} */ (
    document.getElementById('searchEngineDialog')
  );
  const form = document.getElementById('searchEngineForm');
  const title = document.getElementById('searchEngineDialogTitle');

  if (!dialog || !form || !title) {
    console.error('[customSearchEngines] Missing dialog elements', {
      dialog,
      form,
      title,
    });
    return;
  }

  title.textContent = 'Add Search Engine';
  form.reset();
  clearError();
  dialog.showModal();
}

/**
 * Shows the edit dialog for a specific engine.
 * @param {string} id
 */
function showEditDialog(id) {
  const engine = engines.find((e) => e.id === id);
  if (!engine) {
    return;
  }

  editingId = id;
  const dialog = /** @type {HTMLDialogElement | null} */ (
    document.getElementById('searchEngineDialog')
  );
  const title = document.getElementById('searchEngineDialogTitle');
  const nameInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById('engineName')
  );
  const shortcutInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById('engineShortcut')
  );
  const urlInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById('engineUrl')
  );

  if (!dialog || !title || !nameInput || !shortcutInput || !urlInput) {
    return;
  }

  title.textContent = 'Edit Search Engine';
  nameInput.value = engine.name;
  shortcutInput.value = engine.shortcut;
  urlInput.value = engine.searchUrl;
  clearError();
  dialog.showModal();
}

/**
 * Hides the dialog.
 */
function hideDialog() {
  const dialog = /** @type {HTMLDialogElement | null} */ (
    document.getElementById('searchEngineDialog')
  );
  if (dialog) {
    dialog.close();
  }
  editingId = null;
}

/**
 * Handles saving a search engine.
 * @returns {Promise<void>}
 */
async function handleSave() {
  const nameInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById('engineName')
  );
  const shortcutInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById('engineShortcut')
  );
  const urlInput = /** @type {HTMLInputElement | null} */ (
    document.getElementById('engineUrl')
  );

  if (!nameInput || !shortcutInput || !urlInput) {
    return;
  }

  const engine = normalizeSearchEngine({
    id: editingId || undefined,
    name: nameInput.value,
    shortcut: shortcutInput.value,
    searchUrl: urlInput.value,
  });

  // Validate
  const validation = validateSearchEngine(engine, engines, editingId);
  if (!validation.valid) {
    showError(validation.error || 'Invalid search engine');
    return;
  }

  // Save
  if (editingId) {
    // Update existing
    const index = engines.findIndex((e) => e.id === editingId);
    if (index !== -1) {
      engines[index] = engine;
    }
  } else {
    // Add new
    engines.push(engine);
  }

  await saveCustomSearchEngines(engines);
  renderEngines();
  hideDialog();
}

/**
 * Handles deleting a search engine.
 * @param {string} id
 * @returns {Promise<void>}
 */
async function handleDelete(id) {
  const engine = engines.find((e) => e.id === id);
  if (!engine) {
    return;
  }

  if (!confirm(`Delete search engine "${engine.name}"?`)) {
    return;
  }

  engines = engines.filter((e) => e.id !== id);
  await saveCustomSearchEngines(engines);
  renderEngines();
}

/**
 * Shows an error message in the dialog.
 * @param {string} message
 */
function showError(message) {
  const errorDiv = document.getElementById('searchEngineError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}

/**
 * Clears the error message.
 */
function clearError() {
  const errorDiv = document.getElementById('searchEngineError');
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.classList.add('hidden');
  }
}

/**
 * Sets up event listeners for buttons.
 */
function setupEventListeners() {
  const listContainer = document.getElementById('customSearchEnginesList');
  if (listContainer) {
    listContainer.addEventListener('click', handleListClick);
  }

  const addButton = document.getElementById('addSearchEngineBtn');
  if (addButton) {
    addButton.addEventListener('click', showAddDialog);
  }

  const saveButton = document.getElementById('saveSearchEngineBtn');
  if (saveButton) {
    saveButton.addEventListener('click', () => void handleSave());
  }

  const cancelButton = document.getElementById('cancelSearchEngineBtn');
  if (cancelButton) {
    cancelButton.addEventListener('click', hideDialog);
  }
}

/**
 * Initializes the custom search engines section.
 * @returns {Promise<void>}
 */
async function initCustomSearchEngines() {
  engines = await getCustomSearchEngines();
  renderEngines();
  setupEventListeners();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    () => void initCustomSearchEngines(),
  );
} else {
  void initCustomSearchEngines();
}

document.addEventListener(
  'nenya-options-imported',
  () => void initCustomSearchEngines(),
);
