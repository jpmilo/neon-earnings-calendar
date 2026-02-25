const fs = require('fs');
const htmlPath = './public/index.html';
const jsonPath = './data/symbols.json';
const html = fs.readFileSync(htmlPath, 'utf8');
const symbols = fs.readFileSync(jsonPath, 'utf8');
const scriptTag = `    <script>\n        window.USER_STOCKS = ${symbols};\n    </script>\n</head>`;
const newHtml = html.replace('</head>', scriptTag);
fs.writeFileSync(htmlPath, newHtml);
console.log('Injected symbols into index.html');
