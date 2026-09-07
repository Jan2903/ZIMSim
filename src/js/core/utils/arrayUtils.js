/**
 * Swaps an element in an array with the one above it.
 * @param {Array} arr - The array
 * @param {number} index - The index of the item to move up
 * @returns {boolean} True if moved, false if already at top
 */
export function moveItemUp(arr, index) {
    if (index > 0 && index < arr.length) {
        const temp = arr[index - 1];
        arr[index - 1] = arr[index];
        arr[index] = temp;
        return true;
    }
    return false;
}

/**
 * Swaps an element in an array with the one below it.
 * @param {Array} arr - The array
 * @param {number} index - The index of the item to move down
 * @returns {boolean} True if moved, false if already at bottom
 */
export function moveItemDown(arr, index) {
    if (index >= 0 && index < arr.length - 1) {
        const temp = arr[index + 1];
        arr[index + 1] = arr[index];
        arr[index] = temp;
        return true;
    }
    return false;
}
