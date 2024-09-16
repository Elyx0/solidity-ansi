// highlighter.js
import parser from '@solidity-parser/parser';
import colors from './colors.mjs'

const commentPattern = /\/\/.*$|\/\*[\s\S]*?\*\//gm;

const solidityTypes = new Set([
    'address', 'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uint128', 'uint256',
    'int', 'int8', 'int16', 'int32', 'int64', 'int128', 'int256',
    'bool', 'bytes', 'bytes1', 'bytes2', 'bytes3', 'bytes4', 'bytes5', 'bytes6',
    'bytes7', 'bytes8', 'bytes9', 'bytes10', 'bytes11', 'bytes12', 'bytes13',
    'bytes14', 'bytes15', 'bytes16', 'bytes17', 'bytes18', 'bytes19', 'bytes20',
    'bytes21', 'bytes22', 'bytes23', 'bytes24', 'bytes25', 'bytes26', 'bytes27',
    'bytes28', 'bytes29', 'bytes30', 'bytes31', 'bytes32',
    'string'
]);

const solidityGlobalVars = new Set([
    'constructor', 'block', 'tx', 'now', 'msg.sender', 'msg.value', 'msg.data', 'msg.sig',
    'msg.gas', 'block.coinbase', 'block.difficulty', 'block.gaslimit', 'block.number',
    'block.timestamp', 'tx.gasprice', 'tx.origin'
]);

/**
 * Check if a given range overlaps with any comment ranges.
 * @param {Array} range - [start, end]
 * @param {Array} commentRanges - Array of [start, end] ranges.
 * @returns {boolean} - True if overlapping, else false.
 */
function isRangeInComments(range, commentRanges) {
    if (!range || !commentRanges) return true;
    return commentRanges.some(commentRange =>
        range[0] >= commentRange[0] && range[1] <= commentRange[1]
    );
}

function getFullMemberExpression(node) {
    let parts = [];
    let current = node;

    while (current.type === 'MemberAccess') {
        parts.unshift(current.memberName);
        current = current.expression;
    }

    if (current.type === 'Identifier') {
        parts.unshift(current.name);
    }

    return parts.join('.');
}


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

        comments.push({
            type: 'comment',
            value: comment,
            range: [startIndex, endIndex]
        });
    }

    return comments;
}

function collectAllTokens(ast, code) {
    const commentTokens = extractComments(code);
    const astTokens = collectTokens(ast, code, commentTokens.map(c => c.range));

    const allTokens = [...commentTokens,...astTokens];
    allTokens.sort((a, b) => a.range[0] - b.range[0]);
    return allTokens;
}

function safeFindNameAndPush(node, tokens, code, keyword, tokenNameForColor) {
    if (node.name) {
        const funcName = node.name;
        //console.log(node, funcName);
        // Find the start index of the function name
        const nameStart = node.range[0] + keyword.length + 1; // +1 for space
        const nameEnd = nameStart + funcName.length;

        // Verify that the slice matches the function name
        if (code.slice(nameStart, nameEnd) === funcName) {
            tokens.push({
                type: tokenNameForColor,
                value: funcName,
                range: [nameStart, nameEnd]
            });
        } else {
            // Fallback: Search for the function name after keyword
            const actualStart = code.indexOf(funcName, node.range[0] + keyword.length);
            if (actualStart !== -1) {
                tokens.push({
                    type: tokenNameForColor,
                    value: funcName,
                    range: [actualStart, actualStart + funcName.length]
                });
            }
        }
    }
}

/**
 * Traverses the AST and collects tokens with their types and ranges.
 * @param {Object} ast - The AST of the Solidity code.
 * @param {string} code - The original Solidity code.
 * @returns {Array} - Array of token objects with type, value, and range.
 */
function collectTokens(ast, code, commentsRange) {
    const tokens = [];
    const seen = {};
    parser.visit(ast, {
        // Handle Contract Definitions
        ContractDefinition(node) {
            // 'contract' keyword
            tokens.push({
                type: 'keyword',
                value: 'contract',
                range: [node.range[0], node.range[0] + 'contract'.length]
            });

            // Contract name
            if (node.name) {
                const contractName = node.name;
                // Find the start index of the contract name
                const nameStart = node.range[0] + 'contract'.length + 1; // +1 for space
                const nameEnd = nameStart + contractName.length;

                // Verify that the slice matches the contract name
                if (code.slice(nameStart, nameEnd) === contractName) {
                    tokens.push({
                        type: 'contractName',
                        value: contractName,
                        range: [nameStart, nameEnd]
                    });
                } else {
                    // Fallback: Search for the contract name after 'contract'
                    const actualStart = code.indexOf(contractName, node.range[0] + 'contract'.length);
                    if (actualStart !== -1) {
                        tokens.push({
                            type: 'contractName',
                            value: contractName,
                            range: [actualStart, actualStart + contractName.length]
                        });
                    }
                }
            }
        },
        // Probably Unused, can't hit it
        TypeConversion(node) {
            //console.log(node);
            if (isRangeInComments(node.range, commentsRange)) return;
            if (seen[node.range.join(',')]) return;
            seen[node.range.join(',')] = true;
          
            if (node.typeName) {
                const typeName = node.typeName.name;
                tokens.push({
                    type: 'type',
                    value: typeName,
                    range: [node.typeName.range[0], node.typeName.range[1]+1]
                });
            }
        },
        MemberAccess(node) {
            if (isRangeInComments(node.range, commentsRange)) return;
            if (seen[node.memberName+node.range.join(',')]) return;
            
            // Reconstruct the full member expression (e.g., msg.sender)
            const fullExpression = getFullMemberExpression(node);
            if (solidityGlobalVars.has(fullExpression)) {
                // Colorize the entire expression as 'visibility'
                tokens.push({
                    type: 'keyword',
                    value: fullExpression,
                    range: [node.range[0], node.range[1] + 1]
                });
                return;
            } 

            tokens.push({
                type: 'memberAccess',
                value: node.memberName,
                range: [node.range[0] + node.expression.range[1] - node.expression.range[0] + 2, node.range[1] + 1]
            });
            seen[node.memberName+node.range.join(',')] = true;
        },
        EventDefinition(node) {
            tokens.push({
                type: 'keyword',
                value: 'event',
                range: [node.range[0], node.range[0] + 'event'.length]
            });
            //console.log(node);
            safeFindNameAndPush(node, tokens, code, "event", 'eventName');

        },

        EmitStatement(node) {
            tokens.push({
                type: 'parenthesis',
                value: 'emit',
                range: [node.range[0], node.range[0] + 'emit'.length]
            });
            //console.log(node);
            // if (node.eventCall) {
            //     const funcName = node.eventCall.expression.name;
            //     tokens.push({
            //         type: 'eventName',
            //         value: funcName,
            //         range: [node.eventCall.range[0], node.eventCall.range[0] + funcName.length]
            //     });
            // }
        },
        HexNumber(node) {
            if (isRangeInComments(node.range, commentsRange)) return;
            if (seen[node.value+node.range.join(',')]) return;
            tokens.push({
                type: 'hexNumber',
                value: node.value,
                range: [node.range[0], node.range[1]+1]
            });
            seen[node.value+node.range.join(',')] = true;
        },

        StructDefinition(node) {
            if (isRangeInComments(node.range, commentsRange)) return;
            tokens.push({
                type: 'keyword',
                value: 'struct',
                range: [node.range[0], node.range[0] + 'struct'.length]
            });
            //console.log(node);
            safeFindNameAndPush(node, tokens, code, "struct", 'structName');
        },

        Mapping(node) {
            if (isRangeInComments(node.range, commentsRange)) return;
            if (seen[node.range.join(',')]) return;
            seen[node.range.join(',')] = true;
            tokens.push({
                type: 'keyword',
                value: 'mapping',
                range: [node.range[0], node.range[0] + 'mapping'.length]
            });
            //console.log(node);
            if (node.keyType) {
                const typeName = node.keyType.name;
                tokens.push({
                    type: 'type',
                    value: typeName,
                    range: [node.keyType.range[0], node.keyType.range[1]+1]
                });
            }
            if (node.valueType) {
                if (node.valueType.type == 'Mapping') return;
                const typeName = node.valueType.name;
                tokens.push({
                    type: 'type',
                    value: typeName,
                    range: [node.valueType.range[0], node.valueType.range[1]+1]
                });
            }
        },

        // Handle Function Definitions
        FunctionDefinition(node) {
            if (isRangeInComments(node.range, commentsRange)) return;
            // 'function' keyword
            tokens.push({
                type: 'keyword',
                value: 'function',
                range: [node.range[0], node.range[0] + 'function'.length]
            });
            if (node.visibility) {
                const visibility = node.visibility;
               
                const nodeStart = node.range[0];
                const visibilityStart = code.indexOf(visibility, nodeStart);
                //console.log(visibility, nodeStart, visibilityStart);
                if (visibilityStart !== -1) {
                    const visibilityEnd = visibilityStart + visibility.length;
                    tokens.push({
                        type: 'visibility',
                        value: visibility,
                        range: [visibilityStart, visibilityEnd]
                    });
                }
            }
            if (node.stateMutability) {
                const visibility = node.stateMutability;
               
                const nodeStart = node.range[0];
                const visibilityStart = code.indexOf(visibility, nodeStart);
                //console.log(visibility, nodeStart, visibilityStart);
                if (visibilityStart !== -1) {
                    const visibilityEnd = visibilityStart + visibility.length;
                    tokens.push({
                        type: 'visibility',
                        value: visibility,
                        range: [visibilityStart, visibilityEnd]
                    });
                }
            }
            safeFindNameAndPush(node, tokens, code, "function", 'funcName');
            //console.log(node);
            if (node.returnParameters && node.returnParameters?.length > 0) {
                const returnsKeyword = 'returns';
                const returnsStart = code.indexOf(returnsKeyword, node.range[0]);
                //console.log(returnsStart, returnsKeyword,'returns');
                if (returnsStart !== -1) {
                    // 'returns' keyword
                    tokens.push({
                        type: 'returnsKeyword',
                        value: returnsKeyword,
                        range: [returnsStart, returnsStart + returnsKeyword.length]
                    });

                    // Find '(' and ')' around return parameters
                    // const openParen = code.indexOf('(', returnsStart);
                    // const closeParen = code.indexOf(')', openParen);
                    // if (openParen !== -1) {
                    //     tokens.push({
                    //         type: 'parenthesis',
                    //         value: '(',
                    //         range: [openParen, openParen + 1]
                    //     });
                    // }
                    // if (closeParen !== -1) {
                    //     tokens.push({
                    //         type: 'parenthesis',
                    //         value: ')',
                    //         range: [closeParen, closeParen + 1]
                    //     });
                    // }

                    // Iterate over return parameters to colorize types and identifiers
                    // node.returnParameters.forEach(param => {
                    //     // Return Type
                    //     if (param.typeName && param.typeName.name) {
                    //         const typeName = param.typeName.name; // e.g., 'uint8'
                    //         const typeStart = param.typeName.range[0];
                    //         tokens.push({
                    //             type: 'returnType',
                    //             value: typeName,
                    //             range: [typeStart, typeStart + typeName.length]
                    //         });
                    //     }

                    //     // Return Identifier
                    //     if (param.name) {
                    //         const paramName = param.name; // e.g., 'b'
                    //         const nameStart = param.range[0] + param.typeName.range[1] - param.typeName.range[0] + 1; // +1 for space
                    //         tokens.push({
                    //             type: 'returnIdentifier',
                    //             value: paramName,
                    //             range: [nameStart, nameStart + paramName.length]
                    //         });
                    //     }
                    // });
                }
            }
        },
        TypeNameExpression(node) {
     
            if (isRangeInComments(node.range, commentsRange)) return;
            if (seen[node.range.join(',')]) return;
            seen[node.range.join(',')] = true;
            //console.log(node);
            if (node.name) {
                const typeName = node.name;
                tokens.push({
                    type: 'type',
                    value: typeName,
                    range: [node.range[0], node.range[1]+1]
                });
            }
        },
        ElementaryTypeName(node) {
            //console.log(node);
            if (isRangeInComments(node.range, commentsRange)) return;
            if (seen[node.range.join(',')]) return;
            console.log(node);
            tokens.push({
                type: 'type',
                value: node.name,
                range: [node.range[0], node.range[1]+1]
            });
            seen[node.range.join(',')] = true;
        },
        // Handle Variable Declarations
        VariableDeclaration(node) {
            // Handle the type
  
            if (isRangeInComments(node.range, commentsRange)) return;
            if (seen[node.range.join(',')]) return;
            seen[node.range.join(',')] = true;
            // let potentialName = node.typeName.name || node.typeName?.baseTypeName?.name;
            // if (node.typeName && potentialName) {
            //    // console.log(potentialName,'potentialName');
            //     if (node.typeName.type == 'ArrayTypeName') {
            //         node.typeName.range[1] -= 2;
            //     }
            //     //console.log(node,node.typeName.loc);
            //     const typeName = potentialName;
            //     tokens.push({
            //         type: 'type',
            //         value: typeName,
            //         range: [node.typeName.range[0], node.typeName.range[1]+1]
            //     });
            // }

            // Handle the variable name
            if (node.name) {
                const varName = node.name;
                const typeEnd = node.typeName.range[1];

                // Skip any whitespace after the type
                let nameStart = typeEnd;
                while (code[nameStart] === ' ' || code[nameStart] === '\t') {
                    nameStart++;
                }

                const nameEnd = nameStart + varName.length;

                // Verify that the slice matches the variable name
                if (code.slice(nameStart, nameEnd) === varName) {
                    tokens.push({
                        type: 'identifier',
                        value: varName,
                        range: [nameStart, nameEnd]
                    });
                } else {
                    // // Fallback: Search for the variable name after the type
                    // const actualStart = code.indexOf(varName, typeEnd);
                    // if (actualStart !== -1) {
                    //     tokens.push({
                    //         type: 'identifier',
                    //         value: varName,
                    //         range: [actualStart, actualStart + varName.length]
                    //     });
                    // }
                }
            }
            //console.log(node);
            if (node.visibility) {
                const visibility = node.visibility;
               
                const nodeStart = node.typeName.range[1];
                const visibilityStart = code.indexOf(visibility, nodeStart);
                if (visibilityStart !== -1) {
                    const visibilityEnd = visibilityStart + visibility.length;
                    tokens.push({
                        type: 'visibility',
                        value: visibility,
                        range: [visibilityStart, visibilityEnd]
                    });
                }
            }
            if (node.storageLocation) {
                const storageLocation = node.storageLocation;
             //   console.log({node}, storageLocation,'storageLocation');
                const nodeStart = node.range[0];
                const storageLocationStart = code.indexOf(storageLocation, nodeStart);
              //  console.log(storageLocation, nodeStart, storageLocationStart);
                if (storageLocationStart !== -1) {
                    const storageLocationEnd = storageLocationStart + storageLocation.length;
                    tokens.push({
                        type: 'storageLocation',
                        value: storageLocation,
                        range: [storageLocationStart, storageLocationEnd]
                    });
                 //   console.log('pushed', tokens[tokens.length-1]);
                }
            }
        },

        // Handle Literals (Strings and Numbers)
        StringLiteral(node) {
            if (isRangeInComments(node.range, commentsRange)) return;

            if (typeof node.value === 'string') {
                // Check if value not seen at range
                if (seen[node.range.join(',')]) return;
                seen[node.range.join(',')] = true;
                seen[node.range[0]] = node.value.length;
               // console.log('Seen', node.range.join(','));
                tokens.push({
                    type: 'string',
                    value: node.value,
                    range: node.range
                });
            }
        },
        NumberLiteral(node) {
            if (isRangeInComments(node.range, commentsRange)) return;

            if (seen[node.value+node.range.join(',')]) return;
                tokens.push({
                    type: 'number',
                    value: node.number.toString(),
                    range: [node.range[0], node.range[1]+1]
                });
            seen[node.value+node.range.join(',')] = true;

        },
        BinaryOperation(node) {
            if (isRangeInComments(node.range, commentsRange)) return;

            if (seen[node.range.join(',')]) return;
            seen[node.range.join(',')] = true;
            const operator = node.operator; // e.g., '!='
            const operatorStart = node.left.range[1];
            const operatorEnd = operatorStart + operator.length;

            // Validate that the operator in the code matches the expected operator
            const actualOperator = code.slice(operatorStart, operatorEnd);
            if (actualOperator === operator) {
                tokens.push({
                    type: 'operator',
                    value: operator,
                    range: [operatorStart, operatorEnd]
                });
            } else {
               // console.warn(`Operator mismatch: expected '${operator}' but found '${actualOperator}' at range [${operatorStart}, ${operatorEnd}]`);
               // Optionally, handle the mismatch or skip
            }
        },

        FunctionCall(node) {
            if (isRangeInComments(node.range, commentsRange)) return;
            //console.log(node);

            if (seen[node.expression.name+node.range.join(',')]) return;
            if (node.expression.type === 'Identifier') {
                let finalType = solidityTypes.has(node.expression.name) ? 'type' : 'memberAccess';
                if (node.expression.name === 'keccak256') {
                    finalType = 'funcName';
                }

                tokens.push({
                    type: finalType,
                    value: node.expression.name,
                    range: [node.expression.range[0], node.expression.range[1]+1]
                });
            }
            // tokens.push({
            //     type: 'funcName',
            //     value: node.expression.name,
            //     range: [node.expression.range[0], node.expression.range[1]+1]
            // });
            seen[node.expression.name+node.range.join(',')] = true;
        },


        // Handle Require Statements (as an example)
        ExpressionStatement(node) {
            if (isRangeInComments(node.range, commentsRange)) return;
            if (seen[node.range.join(',')]) return;
            seen[node.range.join(',')] = true;
            if (node.expression && node.expression.type === 'FunctionCall') {
                const funcName = node.expression.expression.name;
                // if (funcName === 'require') {
                //     const requireStart = node.expression.range[0];
                //     const requireEnd = requireStart + 'require'.length;
                //     tokens.push({
                //         type: 'keyword',
                //         value: 'require',
                //         range: [requireStart, requireEnd]
                //     });
                // }
            }
        },
        // Identifier(node, parent) {
        //     if (parent.type === 'FunctionCall') {
        //         tokens.push({
        //             type: 'function',
        //             value: node.name,
        //             range: node.range
        //         });
        //     } else {
        //         tokens.push({
        //             type: 'identifier',
        //             value: node.name,
        //             range: node.range
        //         });
        //     }
        // },
                // Exit Handlers (Leave them empty to avoid duplication)
                'StringLiteral:exit'(node) {
                    // Do nothing on exit
                },
                'NumberLiteral:exit'(node) {
                    // Do nothing on exit
                },
                'BooleanLiteral:exit'(node) {
                    // Do nothing on exit
                },
                'ContractDefinition:exit'(node) {
                    // Do nothing on exit
                },
                'FunctionDefinition:exit'(node) {
                    // Do nothing on exit
                },
                'VariableDeclaration:exit'(node) {
                    // Do nothing on exit
                },
                // Add more exit handlers as needed

        // Add more visitor methods for different node types as needed
    });

    // Scan for all '(' and ')' in the code
    for (let i = 0; i < code.length; i++) {
        if (seen[i]) {
            i+=seen[i];
            continue;
        }
        const char = code[i];
        if (char === '(' || char === ')' || char === '{' || char === '}') {
            const range = [i, i + 1];
            if (isRangeInComments(range, commentsRange)) continue;
            tokens.push({
                type: 'parenthesis',
                value: char,
                range,
            });
        }
        if (char === '[' || char === ']') {
            const range = [i, i + 1];
            if (isRangeInComments(range, commentsRange)) continue;
            tokens.push({
                type: 'brackets',
                value: char,
                range,
            });
        }
    }
    // // Find all occurences of those variables and colorize them like `msg.sender`
    // const globalVars = ['constructor', 'block', 'tx', 'now', 'msg.sender', 'msg.value', 'msg.data', 'msg.sig', 'msg.gas', 'block.coinbase', 'block.difficulty', 'block.gaslimit', 'block.number', 'block.timestamp', 'tx.gasprice', 'tx.origin'];
    // // Sort by length in descending order
    // globalVars.sort((a, b) => b.length - a.length);
    // // Transform into a regex
    // const globalVarsRegex = new RegExp(globalVars.join('|'), 'g');
    // let match;
    // while ((match = globalVarsRegex.exec(code)) !== null) {
    //     const varName = match[0];
    //     const startIndex = match.index;
    //     const endIndex = match.index + varName.length;
    //     const range = [startIndex, endIndex];
    //     if (isRangeInComments(range, commentsRange)) continue;
    //     seen[varName+range.join(',')] = true;
    //     tokens.push({
    //         type: 'visibility',
    //         value: varName,
    //         range: [startIndex, endIndex]
    //     });
    // }

    const globalVarsRegexExtra = new RegExp(/return\s|assembly\s/, 'g');

    let matchExtra;
     while ((matchExtra = globalVarsRegexExtra.exec(code)) !== null) {
         const varName = matchExtra[0];
         const startIndex = matchExtra.index;
         const endIndex = matchExtra.index + varName.length;
         const range = [startIndex, endIndex];
         if (isRangeInComments(range, commentsRange)) continue;
         tokens.push({
             type: 'returnsKeyword',
             value: varName,
             range: [startIndex, endIndex]
         });
       }
    return tokens;
}

const colorsMap = {
    keyword: colors.fg.blue,
    type: colors.fg.cyan,
    string: colors.fg.green,
    identifier: colors.fg.white,
    number: colors.fg.blue,
    operator: colors.fg.white,
    comment: colors.fg.black,
    visibility: colors.fg.blue,
    contractName: colors.fg.cyan,
    eventName: colors.fg.cyan,
    funcName: colors.fg.yellow,
    parenthesis: colors.fg.magenta,
    brackets: colors.fg.blue,
    storageLocation: colors.fg.blue,
    returnsKeyword: colors.fg.magenta,
    hexNumber: colors.fg.green,
    structName: colors.fg.green,
    memberAccess: colors.fg.yellow,
};

/**
 * Apply ANSI color codes to the Solidity code based on tokens.
 * @param {String} code - The original Solidity code.
 * @param {Array} tokens - Array of token objects with type, value, start, and end positions.
 * @returns {String} - The colored Solidity code with ANSI codes.
 */
function applyColors(code, tokens) {
    // Sort tokens by start position
    tokens.sort((a, b) => a.range[0] - b.range[0]);

    let coloredCode = '';
    let currentIndex = 0;

    tokens.forEach(token => {
        const [start, end] = token.range;

        // Append code before the token
        if (currentIndex < start) {
            coloredCode += code.slice(currentIndex, start);
            currentIndex = start;
        }

        // Apply color
        const color = colorsMap[token.type] || colors.reset;
        coloredCode += `${color}${code.slice(start, end)}${colors.reset}`;
        currentIndex = end;
    });

    // Append the remaining code
    if (currentIndex < code.length) {
        coloredCode += code.slice(currentIndex);
    }

    return coloredCode;
}

// Export functions
export { collectAllTokens, applyColors };
