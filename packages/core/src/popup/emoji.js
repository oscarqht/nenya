import Picker from '../libs/emoji-picker-element.js';
import '../options/theme.js';

// Back button
const backButton = document.getElementById('backButton');
if (backButton) {
  backButton.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}

// Picker element
const picker = document.querySelector('emoji-picker');
const statusMessage = document.getElementById('statusMessage');
const statusText = document.getElementById('statusText');

let emojiSequence = [];
let sequenceTimeout = null;
let isCmdHeld = false;

/**
 * Focuses the emoji picker search input when available.
 * The picker renders its internal input asynchronously.
 *
 * @param {number} [attempts=20]
 * @returns {void}
 */
function focusPickerSearchInput(attempts = 20) {
  if (!picker || attempts <= 0) return;
  const searchInput = picker.shadowRoot?.querySelector('input[type="search"]');
  if (searchInput instanceof HTMLInputElement) {
    searchInput.focus();
    return;
  }
  window.setTimeout(() => {
    focusPickerSearchInput(attempts - 1);
  }, 50);
}

// Track modifier keys globally since the custom event doesn't carry them
document.addEventListener('keydown', (e) => {
  if (e.key === 'Meta' || e.key === 'Control') {
    isCmdHeld = true;
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'Meta' || e.key === 'Control') {
    isCmdHeld = false;
  }
});

window.addEventListener('blur', () => {
  isCmdHeld = false;
});

function showStatus(message, isError = false) {
  if (!statusMessage || !statusText) return;

  statusText.textContent = message;
  const alert = statusMessage.querySelector('.alert');
  if (alert) {
    if (isError) {
      alert.classList.remove('alert-success');
      alert.classList.add('alert-error');
    } else {
      alert.classList.remove('alert-error');
      alert.classList.add('alert-success');
    }
  }

  statusMessage.classList.remove('opacity-0');

  if (sequenceTimeout) {
    clearTimeout(sequenceTimeout);
  }

  sequenceTimeout = setTimeout(() => {
    statusMessage.classList.add('opacity-0');
  }, 2000);
}

if (picker) {
  focusPickerSearchInput();

  window.addEventListener('focus', () => {
    focusPickerSearchInput(5);
  });

  // Ensure the picker is focused or ready for interaction
  picker.addEventListener('emoji-click', async (event) => {
    const { detail } = event;
    const { unicode } = detail;
    if (!unicode) return;

    if (isCmdHeld) {
      emojiSequence.push(unicode);
      const sequence = emojiSequence.join('');
      try {
        await navigator.clipboard.writeText(sequence);
        showStatus(`Copied sequence: ${sequence}`);
      } catch (err) {
        console.error('Failed to copy sequence:', err);
        showStatus('Failed to copy', true);
      }
    } else {
      emojiSequence = [unicode];
      try {
        await navigator.clipboard.writeText(unicode);
        showStatus(`Copied: ${unicode}`);
        // Close the popup after copying
        window.close();
      } catch (err) {
        console.error('Failed to copy emoji:', err);
        showStatus('Failed to copy', true);
      }
    }
  });
}
