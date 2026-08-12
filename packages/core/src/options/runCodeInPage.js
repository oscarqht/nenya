/* global chrome */

/**
 * @typedef {Object} AceConfig
 * @property {function(string, *): void} set
 * @property {function(string): *} get
 * @property {function(string, string): void} setModuleUrl
 */

/**
 * @typedef {Object} AceApi
 * @property {AceConfig} config
 * @property {function(string[]|string, function?): *} require
 * @property {function(HTMLElement): any} edit
 * @property {function(string, string[], function): void} define
 */

/**
 * @type {AceApi | undefined}
 */
const ace =
  typeof window !== 'undefined' && /** @type {any} */ (window).ace
    ? /** @type {any} */ (window).ace
    : undefined;

/**
 * @typedef {Object} ToastifyOptions
 * @property {string} text
 * @property {number} duration
 * @property {string} gravity
 * @property {string} position
 * @property {string} backgroundColor
 */

/**
 * @typedef {Object} ToastifyInstance
 * @property {function(): void} showToast
 */

/**
 * @typedef {function(ToastifyOptions): ToastifyInstance} ToastifyFunction
 */

/**
 * @type {ToastifyFunction | undefined}
 */
const Toastify =
  typeof window !== 'undefined' && /** @type {any} */ (window).Toastify
    ? /** @type {any} */ (window).Toastify
    : undefined;

/**
 * @typedef {Object} RunCodeRule
 * @property {string} id
 * @property {string} title
 * @property {string[]} patterns
 * @property {string} code
 * @property {boolean | undefined} disabled
 * @property {string | undefined} createdAt
 * @property {string | undefined} updatedAt
 */

const STORAGE_KEY = 'runCodeInPageRules';

const form = /** @type {HTMLFormElement | null} */ (
  document.getElementById('runCodeRuleForm')
);
const titleInput = /** @type {HTMLInputElement | null} */ (
  document.getElementById('runCodeTitleInput')
);
const patternsChipsContainer = /** @type {HTMLDivElement | null} */ (
  document.getElementById('runCodePatternsChips')
);
const patternInput = /** @type {HTMLInputElement | null} */ (
  document.getElementById('runCodePatternInput')
);
const addPatternBtn = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('runCodeAddPatternBtn')
);
const patternError = /** @type {HTMLParagraphElement | null} */ (
  document.getElementById('runCodePatternError')
);
const jsInputContainer = /** @type {HTMLDivElement | null} */ (
  document.getElementById('runCodeJSInput')
);

/** @type {any} */
let jsEditor = null;
const saveButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('runCodeSaveButton')
);
const cancelButton = /** @type {HTMLButtonElement | null} */ (
  document.getElementById('runCodeCancelEditButton')
);
const formError = /** @type {HTMLParagraphElement | null} */ (
  document.getElementById('runCodeFormError')
);
const emptyState = /** @type {HTMLDivElement | null} */ (
  document.getElementById('runCodeRulesEmpty')
);
const listElement = /** @type {HTMLDivElement | null} */ (
  document.getElementById('runCodeRulesList')
);

/** @type {RunCodeRule[]} */
let rules = [];
let editingRuleId = '';
let syncing = false;
let currentPatterns = [];

/**
 * Generate a unique identifier for new rules.
 * @returns {string}
 */
function generateRuleId() {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2);
  return 'rule-' + Date.now().toString(36) + '-' + random;
}

/**
 * Create a deep copy of the provided rules and sort them for consistent rendering.
 * @param {RunCodeRule[]} collection
 * @returns {RunCodeRule[]}
 */
function sortRules(collection) {
  return [...collection].sort((a, b) => {
    return a.title.localeCompare(b.title);
  });
}

/**
 * Normalize possibly partial rule data read from storage.
 * @param {unknown} value
 * @returns {{ rules: RunCodeRule[], mutated: boolean }}
 */
function normalizeRules(value) {
  const sanitized = [];
  let mutated = false;

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const raw =
        /** @type {{ id?: unknown, title?: unknown, patterns?: unknown, code?: unknown, disabled?: unknown, createdAt?: unknown, updatedAt?: unknown }} */ (
          entry
        );
      const title = typeof raw.title === 'string' ? raw.title.trim() : '';
      if (!title) {
        return;
      }

      const patterns = Array.isArray(raw.patterns)
        ? raw.patterns.filter(p => {
            if (typeof p !== 'string' || !p.trim()) return false;
            try {
                new URLPattern(p);
                return true;
            } catch {
                return false;
            }
        })
        : [];

      const code = typeof raw.code === 'string' ? raw.code : '';

      let id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
      if (!id) {
        id = generateRuleId();
        mutated = true;
      }

      /** @type {RunCodeRule} */
      const rule = {
        id,
        title,
        patterns,
        code,
        disabled: !!raw.disabled,
        createdAt: undefined,
        updatedAt: undefined,
      };
      if (typeof raw.createdAt === 'string') {
        rule.createdAt = raw.createdAt;
      }
      if (typeof raw.updatedAt === 'string') {
        rule.updatedAt = raw.updatedAt;
      }
      sanitized.push(rule);
    });
  }

  return { rules: sortRules(sanitized), mutated };
}

/**
 * Persist the provided rules in chrome.storage.local.
 * @param {RunCodeRule[]} nextRules
 * @returns {Promise<void>}
 */
async function saveRules(nextRules) {
  if (!chrome?.storage?.local) {
    return;
  }
  syncing = true;
  try {
    await chrome.storage.local.set({
      [STORAGE_KEY]: nextRules,
    });
  } catch (error) {
    console.warn('[options:runCode] Failed to save rules:', error);
    throw error;
  } finally {
    syncing = false;
  }
}

/**
 * Load rules from storage, synchronizing invalid entries if needed.
 * @returns {Promise<void>}
 */
async function loadRules() {
  if (!chrome?.storage?.local) {
    rules = [];
    return;
  }

  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const { rules: sanitized, mutated } = normalizeRules(stored?.[STORAGE_KEY]);
    rules = sanitized;
    if (mutated) {
      await saveRules(sanitized);
    }
    render();
  } catch (error) {
    console.warn('[options:runCode] Failed to load rules:', error);
    rules = [];
    render();
  }
}

/**
 * Display or hide a form level error message.
 * @param {string} message
 * @returns {void}
 */
function showFormError(message) {
  if (!formError) {
    return;
  }
  if (!message) {
    formError.hidden = true;
    formError.textContent = '';
    return;
  }
  formError.hidden = false;
  formError.textContent = message;
}

/**
 * Find a rule by ID.
 * @param {string} ruleId
 * @returns {RunCodeRule | undefined}
 */
function findRule(ruleId) {
  return rules.find((rule) => rule.id === ruleId);
}

/**
 * Build a readable title for a duplicated rule.
 * @param {string} sourceTitle
 * @returns {string}
 */
function createDuplicateTitle(sourceTitle) {
  const baseTitle = sourceTitle.replace(/ \(copy(?: \d+)?\)$/i, '');
  const existingTitles = new Set(
    rules.map((rule) => rule.title.trim().toLowerCase()),
  );

  let nextTitle = baseTitle + ' (copy)';
  let copyIndex = 2;
  while (existingTitles.has(nextTitle.toLowerCase())) {
    nextTitle = baseTitle + ' (copy ' + copyIndex + ')';
    copyIndex += 1;
  }

  return nextTitle;
}

/**
 * Create a persisted copy of an existing rule.
 * @param {string} ruleId
 * @returns {void}
 */
function duplicateRule(ruleId) {
  const existing = findRule(ruleId);
  if (!existing) {
    return;
  }

  const now = new Date().toISOString();
  const duplicate = {
    id: generateRuleId(),
    title: createDuplicateTitle(existing.title),
    patterns: [...existing.patterns],
    code: existing.code,
    disabled: existing.disabled,
    createdAt: now,
    updatedAt: now,
  };

  rules = sortRules([...rules, duplicate]);
  void saveRules(rules);
  render();
}

/**
 * Resize Ace editors to match their containers.
 * @returns {void}
 */
function resizeAceEditors() {
  if (jsEditor) {
    jsEditor.resize();
  }
}

async function configureAceWorkers() {
    if (typeof ace === 'undefined' || !ace.config) {
      return;
    }
    ace.config.set('loadWorkerFromBlob', true);
    let jsWorkerCode = null;
    try {
      const jsWorkerResponse = await fetch(
        chrome.runtime.getURL('src/libs/worker-javascript.js'),
      );
      jsWorkerCode = await jsWorkerResponse.text();
    } catch (error) {
      console.warn(
        '[options:runCode] Failed to load Ace worker files:',
        error,
      );
      return;
    }
    return new Promise((resolve) => {
      try {
        if (ace.require && typeof ace.require === 'function') {
          ace.require(
            ['ace/worker/worker_client'],
            function (workerClientModule) {
              if (workerClientModule && workerClientModule.createWorker) {
                const originalCreateWorker = workerClientModule.createWorker;
                workerClientModule.createWorker = function (workerUrl) {
                  if (workerUrl && typeof workerUrl === 'string') {
                    let workerCode = null;
                    if (
                      workerUrl.includes('worker-javascript') ||
                      workerUrl.includes('javascript_worker')
                    ) {
                      workerCode = jsWorkerCode;
                    }

                    if (workerCode) {
                      const blob = new Blob([workerCode], {
                        type: 'application/javascript',
                      });
                      const blobURL = URL.createObjectURL(blob);
                      return new Worker(blobURL);
                    }
                  }
                  return originalCreateWorker.call(this, workerUrl);
                };
              }
              resolve();
            },
          );
        } else {
          resolve();
        }
      } catch (error) {
        console.warn(
          '[options:runCode] Failed to patch Ace worker creation:',
          error,
        );
        resolve();
      }
    });
  }

/**
 * Initialize Ace editors for JavaScript.
 * @returns {Promise<void>}
 */
async function initAceEditors() {
    if (typeof ace === 'undefined') {
      console.warn('[options:runCode] Ace editor not available');
      return;
    }
    await configureAceWorkers();

    if (ace && ace.require) {
      try {
        ace.require(['ace/ext/language_tools'], function () {});
      } catch (error) {
        console.warn(
          '[options:runCode] Failed to load Ace language tools:',
          error,
        );
      }
    }

    if (jsInputContainer && !jsEditor) {
      jsEditor = ace.edit(jsInputContainer);
      jsEditor.session.setMode('ace/mode/javascript');
      jsEditor.setTheme('ace/theme/monokai');
      jsEditor.setOptions({
        fontSize: 14,
        showPrintMargin: false,
        wrap: true,
        useSoftTabs: true,
        tabSize: 2,
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true,
      });
      jsEditor.setValue('', -1);
    }

    window.addEventListener('resize', resizeAceEditors);

    const section = form?.closest('[data-section]');
    if (section) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'hidden'
          ) {
            setTimeout(resizeAceEditors, 100);
          }
        });
      });
      observer.observe(section, {
        attributes: true,
        attributeFilter: ['hidden'],
      });
    }
  }

/**
 * Render the pattern chips.
 * @returns {void}
 */
function renderPatterns() {
    if (!patternsChipsContainer) return;
    patternsChipsContainer.innerHTML = '';
    currentPatterns.forEach((pattern, index) => {
      const chip = document.createElement('div');
      chip.className = 'badge badge-outline gap-2';
      chip.textContent = pattern;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn-xs btn-circle btn-ghost';
      removeBtn.textContent = '✕';
      removeBtn.onclick = () => {
        currentPatterns.splice(index, 1);
        renderPatterns();
      };
      chip.appendChild(removeBtn);
      patternsChipsContainer.appendChild(chip);
    });
  }

  function handleAddPattern() {
    if (!patternInput || !patternError) return;
    const pattern = patternInput.value.trim();
    if (!pattern) return;

    try {
      new URLPattern(pattern);
      patternError.hidden = true;
    } catch {
      patternError.textContent = 'Invalid URL pattern.';
      patternError.hidden = false;
      return;
    }

    if (!currentPatterns.includes(pattern)) {
      currentPatterns.push(pattern);
      renderPatterns();
    }
    patternInput.value = '';
    patternInput.focus();
  }

/**
 * Reset the form to its default (create) state.
 * @returns {void}
 */
function resetForm() {
  editingRuleId = '';
  if (form) {
    form.reset();
  }
  if (jsEditor) {
    jsEditor.setValue('', -1);
  }
  if (saveButton) {
    saveButton.textContent = 'Add rule';
  }
  if (cancelButton) {
    cancelButton.hidden = true;
  }
  currentPatterns = [];
  renderPatterns();
  showFormError('');
}

/**
 * Render the saved rules list.
 * @returns {void}
 */
function renderList() {
  if (!listElement || !emptyState) {
    return;
  }

  listElement.textContent = '';
  if (rules.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  rules.forEach((rule) => {
    const container = document.createElement('article');
    container.className =
      'rounded-lg border border-base-300 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between';
    container.setAttribute('role', 'listitem');

    if (rule.disabled) {
      container.classList.add('opacity-50');
    }

    const info = document.createElement('div');
    info.className = 'space-y-1 flex-1 min-w-0';

    const title = document.createElement('p');
    title.className = 'font-bold';
    title.textContent = rule.title;
    info.appendChild(title);

    const summary = document.createElement('p');
    summary.className = 'text-xs text-base-content/70';
    summary.textContent = rule.patterns.join(', ') || 'No patterns';
    info.appendChild(summary);

    container.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'flex flex-wrap gap-2';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'btn btn-sm btn-outline';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => {
      editingRuleId = rule.id;
      if (titleInput) {
        titleInput.value = rule.title;
      }
      currentPatterns = [...rule.patterns];
      renderPatterns();
      if (jsEditor) {
        jsEditor.setValue(rule.code || '', -1);
        setTimeout(() => jsEditor?.resize(), 50);
      }
      if (saveButton) {
        saveButton.textContent = 'Save changes';
      }
      if (cancelButton) {
        cancelButton.hidden = false;
      }
      if (titleInput) {
        titleInput.focus();
      }
    });
    actions.appendChild(editButton);

    const duplicateButton = document.createElement('button');
    duplicateButton.type = 'button';
    duplicateButton.className = 'btn btn-sm btn-outline';
    duplicateButton.textContent = 'Duplicate';
    duplicateButton.addEventListener('click', () => {
      duplicateRule(rule.id);
    });
    actions.appendChild(duplicateButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn-sm btn-error btn-outline';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm(
        'Delete the rule "' + rule.title + '"?',
      );
      if (!confirmed) {
        return;
      }
      rules = rules.filter((candidate) => candidate.id !== rule.id);
      if (editingRuleId === rule.id) {
        resetForm();
      }
      void saveRules(rules);
      render();
    });
    actions.appendChild(deleteButton);

    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'flex items-center gap-2';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.className = 'toggle toggle-success';
    toggle.checked = !rule.disabled;
    toggle.title = 'Enabled';
    toggle.addEventListener('change', (event) => {
      const isChecked = /** @type {HTMLInputElement} */ (event.target).checked;
      rule.disabled = !isChecked;
      void saveRules(rules);
      render();
    });
    toggleContainer.appendChild(toggle);
    actions.appendChild(toggleContainer);

    container.appendChild(actions);
    listElement.appendChild(container);
  });
}

/**
 * Render list.
 * @returns {void}
 */
function render() {
  renderList();
}

/**
 * Handle form submission to create or update rules.
 * @param {SubmitEvent} event
 * @returns {void}
 */
function handleFormSubmit(event) {
  event.preventDefault();
  if (!titleInput || !jsEditor) {
    return;
  }

  const title = titleInput.value.trim();
  if (!title) {
    showFormError('Enter a title.');
    return;
  }

  const code = jsEditor.getValue() || '';

  if (!code.trim()) {
    showFormError('Enter some JavaScript code.');
    return;
  }

  const now = new Date().toISOString();

  if (editingRuleId) {
    const existing = findRule(editingRuleId);
    if (!existing) {
      showFormError('Selected rule no longer exists.');
      resetForm();
      return;
    }
    existing.title = title;
    existing.patterns = currentPatterns;
    existing.code = code;
    existing.updatedAt = now;
    if (!existing.createdAt) {
      existing.createdAt = now;
    }
  } else {
    const rule = {
      id: generateRuleId(),
      title,
      patterns: currentPatterns,
      code,
      createdAt: now,
      updatedAt: now,
    };
    rules.push(rule);
  }

  rules = sortRules(rules);
  showFormError('');
  resetForm();
  void saveRules(rules);
  render();
}

/**
 * Handle cancel edit button click.
 * @returns {void}
 */
function handleCancelEdit() {
  resetForm();
}

/**
 * Initialize listeners and load existing data.
 * @returns {void}
 */
function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void initAceEditors();
    });
  } else {
    void initAceEditors();
  }

  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
  if (cancelButton) {
    cancelButton.addEventListener('click', handleCancelEdit);
  }
  if (addPatternBtn) {
    addPatternBtn.addEventListener('click', handleAddPattern);
  }
  if (patternInput) {
    patternInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddPattern();
      }
    });
  }

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY)) {
        return;
      }
      if (syncing) {
        return;
      }
      const { rules: sanitized } = normalizeRules(
        changes[STORAGE_KEY]?.newValue,
      );
      rules = sanitized;
      if (editingRuleId && !findRule(editingRuleId)) {
        resetForm();
      }
      render();
    });
  }

  void loadRules();
}

init();
