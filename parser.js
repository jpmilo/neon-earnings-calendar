const fs = require('fs');
const path = require('path');

const ebkPath = '/Users/milozheng/Downloads/all+stock.ebk';
const content = fs.readFileSync(ebkPath, 'utf8');
const lines = content.split('\n').map(l => l.trim()).filter(l => l);

const symbols = new Set();
for (const line of lines) {
    if (line.startsWith('31#')) {
        // US Stocks
        let sym = line.substring(3);
        // Clean up common suffixes in ebk files for US stocks
        if (sym.endsWith('main')) sym = sym.replace('main', '');
        if (sym.endsWith('Q')) sym = sym.replace('Q', '');

        // Basic filter: if it's alphanumeric and relatively short, it's likely a valid base ticker
        if (/^[A-Z\.]+$/.test(sym) && sym.length <= 5) {
            symbols.add(sym);
        }
    } else if (line.startsWith('74#')) {
        // HK Stocks (e.g., 74#00700 -> 0700.HK)
        const sym = line.substring(3);
        if (/^\d{5}$/.test(sym)) {
            // Yahoo Finance HK ticker format
            symbols.add(`${sym.substring(1)}.HK`);
        }
    } else if (line.startsWith('JP#')) {
        // Japanese stocks (e.g., JP#7203 -> 7203.T)
        const sym = line.substring(3);
        if (/^\d{4}$/.test(sym)) {
            symbols.add(`${sym}.T`);
        }
    }
}

const symbolsArray = Array.from(symbols);
console.log(`Parsed ${symbolsArray.length} valid symbols from ${lines.length} lines.`);

// Save to a JSON file for the project to use
const outputFilePath = path.join(__dirname, 'data', 'symbols.json');
if (!fs.existsSync(path.dirname(outputFilePath))) {
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
}
fs.writeFileSync(outputFilePath, JSON.stringify(symbolsArray, null, 2));
console.log(`Saved symbols to ${outputFilePath}`);
