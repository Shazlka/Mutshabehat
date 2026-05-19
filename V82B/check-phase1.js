const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

function count(pattern) {
  const matches = html.match(pattern);
  return matches ? matches.length : 0;
}

const bodyCloseCount = count(/<\/body>/gi);
const htmlCloseCount = count(/<\/html>/gi);
const htmlCloseIndex = html.toLowerCase().lastIndexOf("</html>");
const trailingContent = html.slice(htmlCloseIndex + "</html>".length).trim();

if (bodyCloseCount !== 1) {
  throw new Error(`Expected exactly one </body>, found ${bodyCloseCount}`);
}

if (htmlCloseCount !== 1) {
  throw new Error(`Expected exactly one </html>, found ${htmlCloseCount}`);
}

if (trailingContent) {
  throw new Error("Found content after closing </html> tag");
}

console.log("V82B Phase 1 check passed");
