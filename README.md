# Solidity Code to ANSI for Discord

Discord doesn't recognize the `solidity` syntax language.
But it does allow ansi: https://gist.github.com/kkrypt0nn/a02506f3712ff2d1c8ca7c9e0aed7c06 


Solution is to parse the code to [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree), colorize, and output.

![Video](./readme_example/ex.mp4)

### Install and Usage

Node > v18.16.0.

1) `yarn install`

Depending on your os it's gonna use `pbcopy` or `xsel` to get it directly into the clipboard.
through https://github.com/sindresorhus/clipboardy

2) Copy the snippet you want to the clipboard
3) ./toDiscordAnsi.mjs
4) Paste into discord


Also supports passing a file input as 2nd param 
```
node toDiscordAnsi.mjs snippet.sol
```

## Bonus
Add it as an alias and forget
```
alias toDiscordAnsi="node {FULL_PATH_TO}/toDiscordAnsi.mjs"
```

## Palette Configuration

Colors are defined in `highlighter.mjs`
```js
const colorsMap = {
    keyword: colors.fg.blue,
    type: colors.fg.cyan,
    string: colors.fg.yellow,
    identifier: colors.fg.white,
    number: colors.fg.blue,
    operator: colors.fg.white,
    // ...
};
```

### TODO
- Global yarn package
- Finish definitions from `node_modules/@solidity-parser/parser/dist/src/ast-types.d.ts`

#### Disclaimer
Thanks to `solidity-parser-diligence` then continued by `@solidity-parser/parser`

### Other ways to solve it 

Maybe using something like Vscode TextMate language from https://github.com/tintinweb/vscode-solidity-language/blob/master/src/syntaxes/solidity.tmLanguage.json + https://github.com/microsoft/vscode-textmate 