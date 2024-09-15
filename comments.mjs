// comments.js
/**
 * Extracts comments from the Solidity code.
 * @param {string} code - The Solidity code.
 * @returns {Array} - Array of comment objects with type, value, start, and end positions.
 */
function extractComments(code) {
    const commentPattern = /\/\/.*$|\/\*[\s\S]*?\*\//gm;
    const comments = [];
    let match;

    while ((match = commentPattern.exec(code)) !== null) {
        const comment = match[0];
        const startIndex = match.index;
        const endIndex = match.index + comment.length;

        const start = getLocation(code, startIndex);
        const end = getLocation(code, endIndex);

        comments.push({
            type: 'comment',
            value: comment,
            start,
            end
        });
    }

    return comments;
}

/**
 * Converts a character index to line and column numbers.
 * @param {string} code - The original code.
 * @param {number} index - The character index.
 * @returns {Object} - Object with line and column numbers.
 */
function getLocation(code, index) {
    const lines = code.slice(0, index).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1; // 1-based column
    return { line, column };
}

module.exports = extractComments;
export default { extractComments, getLocation };