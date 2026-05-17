// extractor_with_labels.js
// Run this in the Console of your original V9 HTML file to regenerate data.js WITH verse labels and header colors.
function extractFinalWithLabels() {
  const groups = document.querySelectorAll("article.group");
  const DATA = [];
  groups.forEach((g, index) => {
    const title = g.querySelector(".group-title")?.innerText.trim() || "";
    const header = g.querySelector(".group-header");
    const color = header ? (header.style.background || "#1A4A7E") : "#1A4A7E";
    let surahs = [];
    try { surahs = JSON.parse(g.getAttribute("data-surahs") || "[]"); } catch(e) { surahs = []; }
    const verses = [];
    g.querySelectorAll(".verse-card").forEach(v => {
      const surah = v.querySelector(".surah-name")?.innerText.trim() || "";
      const ayah = v.querySelector(".ayah-num")?.innerText.trim() || "";
      const label = v.querySelector(".verse-lbl")?.innerText.trim() || "";
      const parts = [];
      const textDiv = v.querySelector(".verse-text");
      if (textDiv) {
        textDiv.childNodes.forEach(node => {
          if (node.nodeType === 1) {
            let type = "normal";
            if (node.classList.contains("shared")) type = "shared";
            else if (node.classList.contains("diff")) type = "diff";
            else if (node.classList.contains("addition")) type = "addition";
            else if (node.classList.contains("unique")) type = "unique";
            parts.push({ type, text: node.innerText });
          }
          if (node.nodeType === 3) {
            const text = node.textContent;
            if (text && text.trim()) parts.push({ type: "normal", text });
          }
        });
      }
      verses.push({ surah, ayah, label, parts });
    });
    const note = g.querySelector(".note")?.innerText || "";
    const unote = g.querySelector(".unote")?.innerText || "";
    DATA.push({ id: index + 1, title, color, surahs, verses, note, unote });
  });
  const blob = new Blob(["const DATA = " + JSON.stringify(DATA, null, 2) + ";"], { type: "application/javascript" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "data.js";
  a.click();
}
extractFinalWithLabels();
