// parser.js
import parser from '@solidity-parser/parser';

//console.log(parser);
function parseSolidity(code) {
    const ast = parser.parse(code, { loc: true, range: true });
    const tokens = parser.tokenize(code);
    try {
        const ast = parser.parse(code, { loc: true, range: true });
        const tokens = parser.tokenize(code);
        return { ast, tokens };
    } catch (error) {
        console.error("Parsing error:", error.message, {error});
        throw error;
        process.exit(1);
    }
    
}

export default parseSolidity;
