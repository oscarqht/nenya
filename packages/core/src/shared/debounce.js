/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param {(...args: any[]) => void} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @returns {(...args: any[]) => void} Returns the new debounced function.
 */
export function debounce(func, wait) {
  /** @type {number | undefined} */
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}
