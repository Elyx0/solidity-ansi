import fs from 'fs';
import parseSolidity from './parseSolidity.mjs';
import { collectAllTokens, applyColors } from './highlighter.mjs';
import clipboard from 'clipboardy';

// Read Solidity code from a file
let inputFile = process.argv[2];
let code;
if (!inputFile) {
    code = clipboard.readSync();
} else {
    code = fs.readFileSync(inputFile, 'utf8');
}

/**
 * Merge AST tokens and comments, then apply colors.
 * @param {string} code - The original Solidity code.
 * @returns {string} - The colored Solidity code with ANSI codes.
 */
function highlightSolidityCode(code) {
    let ast;
    let surroundedCode = false;
    try {
        const result  = parseSolidity(code);
        ast = result.ast;
    } catch (error) {
        if (error.message.includes("Cannot read properties of null (reading 'getText')")) {
            code = `contract Dummy {\n${code}\n}`;
            surroundedCode = true;
            ast = parseSolidity(code).ast;
        }
    }
    const astTokens = collectAllTokens(ast, code);


    // Apply colors
    let coloredCode = applyColors(code, astTokens);
    if (surroundedCode) {
        coloredCode = coloredCode.split('\n').slice(1, -1).join('\n');
    }
    return coloredCode;
}

let highlightedCode = highlightSolidityCode(code);

const discordCode =  `\`\`\`ansi\n${highlightedCode}\n\`\`\``;
console.log(discordCode);
console.log('\x1b[92m[ Code copied to clipboard! ]');
// Copy the highlighted code to the clipboard
clipboard.writeSync(discordCode);