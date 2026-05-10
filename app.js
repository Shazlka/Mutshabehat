// app.js
// Full updated app.js — replace your existing file with this content.
// NOTE: After pasting, ensure your HTML contains an element with id="storageBadge"
// and optionally an element with id="githubUpdate" inside the storage bar.

/* =========================
   UTILITIES
========================= */

function safeText(value) {
  return value === undefined || value === null ? "" : String(value);
}

let selectedSurahFilter = null;
let draftVerses = [];
let editGroupIndex = null;

/* =========================
   PERSISTENT STORAGE
   localStorage + File System Access API
========================= */

const LS_KEY = "mutashabihat_data";
let fileHandle = null;  // File System Access API handle

// Auto-save DATA to localStorage (updated to persist timestamp)
function autoSaveToLocalStorage() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(DATA));
    const ts = Date.now();
    localStorage.setItem(LS_KEY + "_ts", String(ts));
    updateStorageStatus("saved");
    updateGitHubTimestampDisplay(ts);
  } catch (e) {
    console.warn("localStorage save failed:", e);
  }
}

// Load from localStorage on startup (overrides data.js if found)
function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.length) return false;
    DATA.length = 0;
    parsed.forEach(function(g) { DATA.push(g); });
    return true;
  } catch(e) {
    return false;
  }
}

// Show storage status badge
function updateStorageStatus(state) {
  const badge = document.getElementById("storageBadge");
  if (!badge) return;
  if (state === "loading") { badge.textContent = "⏳ جاري التحميل من GitHub..."; badge.style.color = "#B45309"; return; }
  if (state === "saved") {
    badge.textContent = "✓ محفوظ";
    badge.style.color = "var(--shared, #1B5E30)";
  } else if (state === "linked") {
    badge.textContent = "🔗 data.js مرتبط (PC)";
    badge.style.color = "#0D47A1";
  } else if (state === "writing") {
    badge.textContent = "⏳ جاري الكتابة...";
    badge.style.color = "#B45309";
  }
}

/* =========================
   FILE SYSTEM ACCESS API
========================= */

// File System Access API — Link data.js file (PC Chrome)
async function linkDataFile() {
  if (!("showOpenFilePicker" in window)) {
    alert("File System Access API غير مدعوم في هذا المتصفح.\nاستخدم Chrome على الكمبيوتر.");
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "JavaScript", accept: { "application/javascript": [".js"] } }],
      suggestedName: "data.js"
    });
    fileHandle = handle;
    updateStorageStatus("linked");
    localStorage.setItem("mutashabihat_file_linked", "true");
    alert("تم ربط data.js بنجاح!\nمن الآن، كل تعديل سيُحفظ تلقائياً في الملف مباشرة.");
  } catch(e) {
    if (e.name !== "AbortError") console.error(e);
  }
}

// Write directly to linked file (replaced with robust version that updates timestamp)
async function writeToLinkedFile() {
  if (!fileHandle) return false;
  try {
    updateStorageStatus("writing");
    const header = `// data.js — lastUpdated: ${new Date().toISOString()}\n`;
    const content = header + "const DATA = " + JSON.stringify(DATA, null, 2) + ";";
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    // Try to read file metadata; fall back to now
    try {
      if (typeof fileHandle.getFile === "function") {
        const file = await fileHandle.getFile();
        const lastModified = file && file.lastModified ? file.lastModified : Date.now();
        localStorage.setItem(LS_KEY + "_ts", String(lastModified));
        updateGitHubTimestampDisplay(lastModified);
      } else {
        const now = Date.now();
        localStorage.setItem(LS_KEY + "_ts", String(now));
        updateGitHubTimestampDisplay(now);
      }
    } catch (metaErr) {
      const now = Date.now();
      localStorage.setItem(LS_KEY + "_ts", String(now));
      updateGitHubTimestampDisplay(now);
    }

    updateStorageStatus("linked");
    return true;
  } catch(e) {
    console.error("File write failed:", e);
    fileHandle = null;
    updateStorageStatus("saved");
    return false;
  }
}

// Master save: localStorage + linked file (if any)
async function masterSave() {
  autoSaveToLocalStorage();
  if (fileHandle) {
    await writeToLinkedFile();
  }
  // syncToGitHub(); // keep existing behavior if you have this function elsewhere
}

/* =========================
   RESET / CLEAR
========================= */

// Clear localStorage (reset to data.js original)
function clearLocalStorage() {
  const confirmed = confirm(
    "هل تريد مسح التغييرات المحفوظة في المتصفح والرجوع إلى data.js الأصلي؟\n\nملاحظة: سيتم إعادة تحميل الصفحة."
  );
  if (!confirmed) return;
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem("mutashabihat_file_linked");
  fileHandle = null;
  location.reload();
}

/* =========================
   TEXT / DISPLAY HELPERS
========================= */

function highlightText(text) {
  const input = document.getElementById("searchInput");
  const q = input ? input.value.trim() : "";

  text = safeText(text);

  if (!q) return text;

  // Simple safe highlight: escape q and perform case-insensitive replace on text nodes only.
  // For simplicity here we do a case-insensitive replace on the string (works for plain text).
  try {
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(esc, "gi");
    return escapeHtml(text).replace(re, match => `<span class="highlight">${escapeHtml(match)}</span>`);
  } catch (e) {
    return escapeHtml(text);
  }
}

function cleanNoteLabel(txt) {
  txt = safeText(txt);

  return txt
    .replace(/^ملاحظة\s*/, "")
    .replace(/^فريدة في القرآن\s*/, "");
}

function getGroupColor(g) {
  return g.color || g.headerColor || "#1A4A7E";
}

function getTags(g) {
  let arr = Array.isArray(g.surahs) ? g.surahs.filter(Boolean) : [];

  if (!arr.length && Array.isArray(g.verses)) {
    arr = [...new Set(g.verses.map(v => v.surah).filter(Boolean))];
  }

  return arr;
}

function escapeHtml(value) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* =========================
   MAIN RENDER
========================= */
/* =========================
   RICH TEXT NOTES HELPERS
========================= */

function isRichHtml(value) {
  return /<\/?(br|b|strong|u|span|ul|ol|li|div|p)\b/i.test(safeText(value));
}

function plainTextToHtml(value) {
  return escapeHtml(cleanNoteLabel(value)).replace(/\n/g, "<br>");
}

// Hardened sanitizer: whitelist tags and only allow safe color on SPAN
function sanitizeRichHtml(input) {
  const allowedTags = new Set(["B", "STRONG", "U", "SPAN", "UL", "OL", "LI", "BR", "DIV", "P"]);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = safeText(input || "");

  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === 3) return; // text node ok
      const tag = child.tagName;
      if (!allowedTags.has(tag)) {
        const textNode = document.createTextNode(child.textContent || "");
        child.replaceWith(textNode);
        return;
      }

      // Remove all attributes first
      [...child.attributes].forEach(attr => child.removeAttribute(attr.name));

      // Allow only color style on SPAN with safe value
      if (tag === "SPAN") {
        const color = child.style && child.style.color ? child.style.color.trim() : "";
        if (color && (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) || /^[a-zA-Z]+$/.test(color))) {
          child.setAttribute("style", "color:" + color);
        }
      }

      walk(child);
    });
  };

  walk(wrapper);
  return wrapper.innerHTML.trim();
}

function renderRichText(value) {
  const cleaned = cleanNoteLabel(value);

  if (!cleaned) return "";

  if (isRichHtml(cleaned)) {
    return sanitizeRichHtml(cleaned);
  }

  return plainTextToHtml(cleaned);
}

function setRichEditorHtml(id, value) {
  const editor = document.getElementById(id);
  if (!editor) return;

  editor.innerHTML = renderRichText(value);
}

function getRichEditorHtml(id) {
  const editor = document.getElementById(id);
  if (!editor) return "";

  return sanitizeRichHtml(editor.innerHTML.trim());
}

function richCommand(command, value = null) {
  document.execCommand(command, false, value);
}

function richColor(color) {
  document.execCommand("foreColor", false, color);
}

/* =========================
   RENDERING
========================= */

function render(data) {
  const app = document.getElementById("app");
  const counter = document.getElementById("counter");

  if (!app) return;

  if (counter) {
    counter.textContent = "عدد النتائج: " + data.length;
  }

  if (!Array.isArray(data) || !data.length) {
    app.innerHTML = '<div class="no-results">لا توجد نتائج</div>';
    return;
  }

  // Build DOM using DocumentFragment for better performance
  const frag = document.createDocumentFragment();

  data.forEach(g => {
    const tags = getTags(g);
    const color = getGroupColor(g);

    const article = document.createElement("article");
    article.className = "group";

    const header = document.createElement("div");
    header.className = "group-header";
    header.style.background = color;
    header.onclick = function() { toggleGroup(this); };

    const num = document.createElement("div");
    num.className = "group-num";
    num.textContent = safeText(g.id);

    const titleWrap = document.createElement("div");
    titleWrap.className = "group-title-wrap";

    const tagsDiv = document.createElement("div");
    tagsDiv.className = "group-tags";
    tags.forEach(t => {
      const span = document.createElement("span");
      span.className = "tag";
      span.innerHTML = "#" + safeText(t);
      tagsDiv.appendChild(span);
    });

    const title = document.createElement("div");
    title.className = "group-title";
    title.textContent = safeText(g.title);

    titleWrap.appendChild(tagsDiv);
    titleWrap.appendChild(title);

    const side = document.createElement("div");
    side.className = "group-side";

    const editBtn = document.createElement("button");
    editBtn.className = "mini-edit-btn";
    editBtn.textContent = "✏️";
    editBtn.onclick = function(e) { e.stopPropagation(); openEditGroup(Number(g.id)); };

    const iconSpan = document.createElement("span");
    iconSpan.textContent = "☷";

    side.appendChild(editBtn);
    side.appendChild(iconSpan);

    header.appendChild(num);
    header.appendChild(titleWrap);
    header.appendChild(side);

    const body = document.createElement("div");
    body.className = "group-body";

    (g.verses || []).forEach(v => {
      const isUnique =
        (v.parts || []).some(p => p.type === "unique") || v.unique;

      const card = document.createElement("div");
      card.className = "verse-card" + (isUnique ? " uniq-row" : "");

      const ref = document.createElement("div");
      ref.className = "verse-ref";

      const sname = document.createElement("span");
      sname.className = "surah-name";
      sname.style.color = color;
      sname.textContent = safeText(v.surah);

      const ayahNum = document.createElement("span");
      ayahNum.className = "ayah-num";
      ayahNum.textContent = safeText(v.ayah);

      ref.appendChild(sname);
      ref.appendChild(ayahNum);

      if (v.label) {
        const lbl = document.createElement("span");
        lbl.className = "verse-lbl";
        lbl.textContent = safeText(v.label);
        ref.appendChild(lbl);
      }

      const textDiv = document.createElement("div");
      textDiv.className = "verse-text";

      (v.parts || []).forEach(p => {
        const span = document.createElement("span");
        span.className = safeText(p.type || "normal");
        // highlightText returns HTML; to avoid injecting HTML into DOM nodes, we set innerHTML only for small fragments
        span.innerHTML = highlightText(p.text);
        textDiv.appendChild(span);
      });

      card.appendChild(ref);
      card.appendChild(textDiv);
      body.appendChild(card);
    });

    if (g.note) {
      const noteDiv = document.createElement("div");
      noteDiv.className = "note rich-note";
      noteDiv.innerHTML = renderRichText(g.note);
      body.appendChild(noteDiv);
    }

    if (g.unote) {
      const unoteDiv = document.createElement("div");
      unoteDiv.className = "unote rich-note";
      unoteDiv.innerHTML = renderRichText(g.unote);
      body.appendChild(unoteDiv);
    }

    article.appendChild(header);
    article.appendChild(body);
    frag.appendChild(article);
  });

  app.replaceChildren(frag);
}

/* =========================
   GROUP ACTIONS
========================= */

function toggleGroup(header) {
  header.parentElement.classList.toggle("open");
}

function expandAll() {
  document.querySelectorAll(".group").forEach(g => {
    g.classList.add("open");
  });
}

function collapseAll() {
  document.querySelectorAll(".group").forEach(g => {
    g.classList.remove("open");
  });
}

/* =========================
   SURAH FILTER BAR
========================= */

function getDefaultSurahNames() {
  return {
    1:"الفاتحة",2:"البقرة",3:"آل عمران",4:"النساء",5:"المائدة",6:"الأنعام",7:"الأعراف",8:"الأنفال",9:"التوبة",10:"يونس",
    11:"هود",12:"يوسف",13:"الرعد",14:"إبراهيم",15:"الحجر",16:"النحل",17:"الإسراء",18:"الكهف",19:"مريم",20:"طه",
    21:"الأنبياء",22:"الحج",23:"المؤمنون",24:"النور",25:"الفرقان",26:"الشعراء",27:"النمل",28:"القصص",29:"العنكبوت",30:"الروم",
    31:"لقمان",32:"السجدة",33:"الأحزاب",34:"سبأ",35:"فاطر",36:"يس",37:"الصافات",38:"ص",39:"الزمر",40:"غافر",
    41:"فصلت",42:"الشورى",43:"الزخرف",44:"الدخان",45:"الجاثية",46:"الأحقاف",47:"محمد",48:"الفتح",49:"الحجرات",50:"ق",
    51:"الذاريات",52:"الطور",53:"النجم",54:"القمر",55:"الرحمن",56:"الواقعة",57:"الحديد",58:"المجادلة",59:"الحشر",60:"الممتحنة",
    61:"الصف",62:"الجمعة",63:"المنافقون",64:"التغابن",65:"الطلاق",66:"التحريم",67:"الملك",68:"القلم",69:"الحاقة",70:"المعارج",
    71:"نوح",72:"الجن",73:"المزمل",74:"المدثر",75:"القيامة",76:"الإنسان",77:"المرسلات",78:"النبأ",79:"النازعات",80:"عبس",
    81:"التكوير",82:"الانفطار",83:"المطففين",84:"الانشقاق",85:"البروج",86:"الطارق",87:"الأعلى",88:"الغاشية",89:"الفجر",90:"البلد",
    91:"الشمس",92:"الليل",93:"الضحى",94:"الشرح",95:"التين",96:"العلق",97:"القدر",98:"البينة",99:"الزلزلة",100:"العاديات",
    101:"القارعة",102:"التكاثر",103:"العصر",104:"الهمزة",105:"الفيل",106:"قريش",107:"الماعون",108:"الكوثر",109:"الكافرون",110:"النصر",
    111:"المسد",112:"الإخلاص",113:"الفلق",114:"الناس"
  };
}

function getSurahGroupCounts(sourceData) {
  const counts = {};

  if (!Array.isArray(sourceData)) return counts;

  sourceData.forEach(g => {
    const surahs = getTags(g);

    surahs.forEach(surah => {
      if (!counts[surah]) {
        counts[surah] = 0;
      }

      counts[surah]++;
    });
  });

  return counts;
}

function buildSurahFilterBar() {
  const grid = document.getElementById("surahFilterGrid");
  if (!grid) return;

  const names =
    typeof SURAH_NAMES !== "undefined"
      ? SURAH_NAMES
      : getDefaultSurahNames();

  const surahCounts = getSurahGroupCounts(DATA);

  grid.innerHTML = Object.keys(names).map(no => {
    const surahName = names[no];
    const count = surahCounts[surahName] || 0;

   return `
  <button
    class="nav-pill"
    data-surah="${surahName}"
    onclick="filterBySurah('${surahName}')"
    title="عدد المتشابهات: ${count}"
  >
    <span class="pill-num">${no}</span>
    <span class="pill-name">${surahName}</span>
    <span class="pill-count">(${count})</span>
  </button>
`;
  }).join("");

  updateSurahButtonAvailability(DATA);
}

function filterBySurah(surahName) {
  selectedSurahFilter = surahName;

  document.querySelectorAll(".nav-pill").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.surah === surahName);
  });

  const clearBtn = document.getElementById("clearSurahBtn");
  if (clearBtn) clearBtn.classList.add("active");

  const status = document.getElementById("filterStatus");
  if (status) status.textContent = "المعروض الآن: " + surahName;

  applyAllFilters();
}

function clearSurahFilter() {
  selectedSurahFilter = null;

  document.querySelectorAll(".nav-pill").forEach(btn => {
    btn.classList.remove("active");
  });

  const clearBtn = document.getElementById("clearSurahBtn");
  if (clearBtn) clearBtn.classList.remove("active");

  const status = document.getElementById("filterStatus");
  if (status) status.textContent = "اختر سورة لعرض متشابهاتها فقط";

  applyAllFilters();
}

function getSearchOnlyFilteredData() {
  const input = document.getElementById("searchInput");
  const q = input ? input.value.trim() : "";

  if (!q) return DATA;

  return DATA.filter(g => {
    const groupSurahs = getTags(g);

    return (
      safeText(g.title).includes(q) ||
      safeText(g.note).includes(q) ||
      safeText(g.unote).includes(q) ||
      groupSurahs.some(s => safeText(s).includes(q)) ||
      (g.verses || []).some(v =>
        safeText(v.surah).includes(q) ||
        safeText(v.ayah).includes(q) ||
        safeText(v.label).includes(q) ||
        (v.parts || []).some(p => safeText(p.text).includes(q))
      )
    );
  });
}

function applyAllFilters() {
  const input = document.getElementById("searchInput");
  const q = input ? input.value.trim() : "";

  const filtered = DATA.filter(g => {
    const groupSurahs = getTags(g);

    const surahMatch =
      !selectedSurahFilter || groupSurahs.includes(selectedSurahFilter);

    const searchMatch =
      !q ||
      safeText(g.title).includes(q) ||
      safeText(g.note).includes(q) ||
      safeText(g.unote).includes(q) ||
      groupSurahs.some(s => safeText(s).includes(q)) ||
      (g.verses || []).some(v =>
        safeText(v.surah).includes(q) ||
        safeText(v.ayah).includes(q) ||
        safeText(v.label).includes(q) ||
        (v.parts || []).some(p => safeText(p.text).includes(q))
      );

    return surahMatch && searchMatch;
  });

  render(filtered);

  updateSurahButtonAvailability(getSearchOnlyFilteredData());
}

function updateSurahButtonAvailability(currentData) {
  const available = new Set();

  if (!Array.isArray(currentData)) currentData = [];

  currentData.forEach(g => {
    getTags(g).forEach(s => available.add(s));
  });

  document.querySelectorAll(".nav-pill").forEach(btn => {
    const s = btn.dataset.surah;

    if (available.has(s) || selectedSurahFilter === s) {
      btn.classList.remove("no-match");
    } else {
      btn.classList.add("no-match");
    }
  });
}

/* =========================
   SEARCH
   (debounced wiring recommended in HTML init)
========================= */

function runSearch() {
  applyAllFilters();
}

function clearSearch() {
  const input = document.getElementById("searchInput");
  if (input) input.value = "";

  applyAllFilters();
}

/* =========================
   ADD NEW ITEM MODAL
========================= */

function openAddModal() {
  document.getElementById("addModal").classList.add("open");
  populateSurahDropdown();
  onSurahChange();
}

function closeAddModal() {
  document.getElementById("addModal").classList.remove("open");
}

function populateSurahDropdown() {
  const sel = document.getElementById("newSurah");

  if (!sel || sel.options.length > 0) return;

  const names =
    typeof SURAH_NAMES !== "undefined"
      ? SURAH_NAMES
      : getDefaultSurahNames();

  sel.innerHTML = Object.keys(names).map(no => `
    <option value="${no}">
      ${no} - ${names[no]}
    </option>
  `).join("");
}

function onSurahChange() {
  const sel = document.getElementById("newSurah");
  if (!sel) return;
  const surahNo = sel.value;
  const ayahSel = document.getElementById("newAyah");

  if (typeof getSurahAyahs === "undefined") {
    if (ayahSel) ayahSel.innerHTML = '<option value="">quran-reference.js غير موجود</option>';
    return;
  }

  const ayahs = getSurahAyahs(surahNo);

  if (ayahSel) {
    ayahSel.innerHTML = ayahs.map(a => `
      <option value="${a.ayahNo}">
        ${a.ayahNo}
      </option>
    `).join("");
  }

  previewSelectedAyah();
}

function previewSelectedAyah() {
  const surahNoEl = document.getElementById("newSurah");
  const ayahNoEl = document.getElementById("newAyah");
  const preview = document.getElementById("ayahPreview");
  if (!surahNoEl || !ayahNoEl || !preview) return;

  const surahNo = surahNoEl.value;
  const ayahNo = ayahNoEl.value;

  const a =
    typeof getAyah !== "undefined"
      ? getAyah(surahNo, ayahNo)
      : null;

  preview.value = a ? a.text : "لم يتم العثور على الآية";
}

function addVerseToDraft() {
  const surahNo = document.getElementById("newSurah").value;
  const ayahNo = document.getElementById("newAyah").value;
  const type = document.getElementById("newType").value || "normal";
  const selectedPart = document.getElementById("selectedPart").value.trim();
  const label = document.getElementById("newLabel").value.trim();

  const a = getAyah(surahNo, ayahNo);

  if (!a) {
    alert("لم يتم العثور على الآية في quran-reference.js");
    return;
  }

  draftVerses.push({
    surah: a.surah,
    ayah: a.ayahNo,
    label: label,
    parts: [
      {
        type: type,
        text: selectedPart || a.text
      }
    ]
  });

  document.getElementById("selectedPart").value = "";
  document.getElementById("newLabel").value = "";

  renderDraftVerses();
}

function renderDraftVerses() {
  const box = document.getElementById("draftVerses");

  if (!draftVerses.length) {
    if (box) box.innerHTML = "لا توجد آيات مضافة بعد.";
    return;
  }

  if (!box) return;

  box.innerHTML = draftVerses.map((v, i) => `
    <div class="draft-item">
      <button class="remove-small" onclick="removeDraftVerse(${i})">
        حذف
      </button>

      <b>${safeText(v.surah)} - ${safeText(v.ayah)}</b>

      ${
        v.label
          ? `<span class="verse-lbl">${safeText(v.label)}</span>`
          : ""
      }

      <br>

      <span class="${safeText(v.parts[0].type)}">
        ${safeText(v.parts[0].text)}
      </span>
    </div>
  `).join("");
}

function removeDraftVerse(i) {
  draftVerses.splice(i, 1);
  renderDraftVerses();
}

function clearDraftVerses() {
  draftVerses = [];
  renderDraftVerses();
}

function createNewGroup() {
  const title = document.getElementById("newTitle").value.trim();
  const note = document.getElementById("newNote").value.trim();
  const unote = document.getElementById("newUnote").value.trim();

  if (!title) {
    alert("اكتب عنوان المتشابه أولًا");
    return;
  }

  if (!draftVerses.length) {
    alert("أضف آية واحدة على الأقل");
    return;
  }

  const surahs = [...new Set(draftVerses.map(v => v.surah))];

  const nextId =
    Math.max(0, ...DATA.map(g => Number(g.id) || 0)) + 1;

  const newGroup = {
    id: nextId,
    title,
    surahs,
    verses: draftVerses,
    note,
    unote
  };

  DATA.push(newGroup);

  clearDraftVerses();

  document.getElementById("newTitle").value = "";
  document.getElementById("newNote").value = "";
  document.getElementById("newUnote").value = "";

  closeAddModal();
  masterSave();
  buildSurahFilterBar();
  applyAllFilters();

  alert("تمت الإضافة وحُفظت تلقائياً.\nاضغط تحميل data.js لحفظها في Files/iCloud.");
}

/* =========================
   DOWNLOAD DATA.JS
   (updated to include header timestamp)
========================= */

function downloadDataJS() {
  const ts = Date.now();
  const header = `// data.js — lastUpdated: ${new Date(ts).toISOString()}\n`;
  const content = header + "const DATA = " + JSON.stringify(DATA, null, 2) + ";";
  const blob = new Blob([content], { type: "application/javascript;charset=utf-8" });

  // persist timestamp locally as fallback
  try {
    localStorage.setItem(LS_KEY + "_ts", String(ts));
  } catch (e) {
    console.warn("Could not persist timestamp to localStorage:", e);
  }
  updateGitHubTimestampDisplay(ts);

  // iOS Safari: use Web Share API (shows Files / iCloud / AirDrop)
  if (navigator.canShare && navigator.share) {
    const file = new File([blob], "data.js", { type: "application/javascript" });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({
        files: [file],
        title: "data.js — متشابهات القرآن"
      })
      .then(function() {
        updateStorageStatus("saved");
      })
      .catch(function(e) {
        if (e.name !== "AbortError") showDataExportFallback(content);
      });
      return;
    }
  }

  // PC Chrome / other browsers: direct download
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data.js";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { showDataExportFallback(content); }, 800);
  } catch(e) {
    showDataExportFallback(content);
  }
}

function showDataExportFallback(content) {
  if (document.getElementById("exportDataModal")) return;

  const modal = document.createElement("div");
  modal.id = "exportDataModal";
  modal.className = "modal-backdrop open";

  modal.innerHTML = `
    <div class="modal edit-modal">
      <div class="modal-header">
        <h2>تصدير data.js</h2>
        <button class="close-btn" onclick="closeDataExportModal()">×</button>
      </div>

      <div class="modal-body">
        <p style="margin-bottom:10px;color:#3A4A60">
          إذا لم يتم تحميل الملف تلقائيًا في Documents، انسخ النص التالي واحفظه باسم:
          <b>data.js</b>
        </p>

        <textarea id="exportDataText" class="ayah-preview" style="min-height:300px; direction:ltr; text-align:left; font-family:monospace;"></textarea>

        <div class="modal-actions">
          <button class="primary-btn" onclick="copyExportData()">Copy data.js</button>
          <button onclick="selectExportData()">Select All</button>
          <button onclick="closeDataExportModal()">إغلاق</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const txt = document.getElementById("exportDataText");
  txt.value = content;
}

function copyExportData() {
  const txt = document.getElementById("exportDataText");
  if (!txt) return;

  txt.focus();
  txt.select();

  try {
    document.execCommand("copy");
    alert("تم نسخ محتوى data.js");
  } catch (e) {
    alert("لم يتم النسخ تلقائيًا. استخدم Select All ثم Copy يدويًا.");
  }
}

function selectExportData() {
  const txt = document.getElementById("exportDataText");
  if (!txt) return;

  txt.focus();
  txt.select();
}

function closeDataExportModal() {
  const modal = document.getElementById("exportDataModal");
  if (modal) modal.remove();
}

/* =========================
   EDIT EXISTING GROUP - DROPDOWN + SORT
========================= */

function toEnglishDigits(value) {
  return safeText(value)
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}

function getSurahNoByName(surahName) {
  const names =
    typeof SURAH_NAMES !== "undefined"
      ? SURAH_NAMES
      : {};

  const target = safeText(surahName).trim();

  for (const no in names) {
    if (names[no] === target) {
      return Number(no);
    }
  }

  return 9999;
}

function getAyahNoValue(value) {
  const n = Number(toEnglishDigits(value));
  return isNaN(n) ? 9999 : n;
}

function buildEditSurahOptions(selectedSurah) {
  const names =
    typeof SURAH_NAMES !== "undefined"
      ? SURAH_NAMES
      : {};

  let html = "";

  Object.keys(names).forEach(no => {
    const name = names[no];
    const selected = name === selectedSurah ? "selected" : "";

    html += `
      <option value="${escapeAttr(name)}" data-surah-no="${no}" ${selected}>
        ${no} - ${name}
      </option>
    `;
  });

  // If old data contains a surah name not found in SURAH_NAMES
  if (selectedSurah && !Object.values(names).includes(selectedSurah)) {
    html =
      `<option value="${escapeAttr(selectedSurah)}" selected>${selectedSurah}</option>` +
      html;
  }

  return html;
}

function buildEditAyahOptions(selectedSurah, selectedAyah) {
  const surahNo = getSurahNoByName(selectedSurah);
  const selectedAyahNo = getAyahNoValue(selectedAyah);

  if (typeof getSurahAyahs === "undefined") {
    return `<option value="${escapeAttr(selectedAyah)}">${escapeHtml(selectedAyah)}</option>`;
  }

  const ayahs = getSurahAyahs(surahNo);

  if (!ayahs || !ayahs.length) {
    return `<option value="${escapeAttr(selectedAyah)}">${escapeHtml(selectedAyah)}</option>`;
  }

  return ayahs.map(a => {
    const selected =
      Number(a.ayahNo) === Number(selectedAyahNo)
        ? "selected"
        : "";

    return `
      <option value="${a.ayahNo}" ${selected}>
        ${a.ayahNo}
      </option>
    `;
  }).join("");
}

function ensureEditModal() {
  if (document.getElementById("editModal")) return;

  const modal = document.createElement("div");
  modal.id = "editModal";
  modal.className = "modal-backdrop";

  modal.innerHTML = `
    <div class="modal edit-modal">
      <div class="modal-header">
        <h2>تعديل المتشابه</h2>
        <button class="close-btn" onclick="closeEditModal()">×</button>
      </div>

      <div class="modal-body">
        <label>عنوان المتشابه</label>
        <input id="editTitle" class="full-input">

        <label>الآيات</label>

        <div class="modal-actions">
          <button class="primary-btn" onclick="addBlankEditVerse()">+ إضافة آية</button>
          <button onclick="sortEditVersesByMushaf()">ترتيب حسب المصحف</button>
        </div>

        <div id="editVersesBox"></div>

        <label>ملاحظة</label>

<div class="rich-toolbar">
  <button type="button" onmousedown="event.preventDefault(); richCommand('bold')">B</button>
  <button type="button" onmousedown="event.preventDefault(); richCommand('underline')">U</button>
  <button type="button" onmousedown="event.preventDefault(); richCommand('insertUnorderedList')">• List</button>
  <button type="button" class="color-green" onmousedown="event.preventDefault(); richColor('#1B5E30')">أخضر</button>
  <button type="button" class="color-blue" onmousedown="event.preventDefault(); richColor('#0D47A1')">أزرق</button>
  <button type="button" class="color-red" onmousedown="event.preventDefault(); richColor('#B00000')">أحمر</button>
  <button type="button" class="color-orange" onmousedown="event.preventDefault(); richColor('#B45309')">برتقالي</button>
</div>

<div id="editNote" class="rich-editor" contenteditable="true"></div>

<label>فائدة فريدة / إضافية</label>

<div class="rich-toolbar">
  <button type="button" onmousedown="event.preventDefault(); richCommand('bold')">B</button>
  <button type="button" onmousedown="event.preventDefault(); richCommand('underline')">U</button>
  <button type="button" onmousedown="event.preventDefault(); richCommand('insertUnorderedList')">• List</button>
  <button type="button" class="color-green" onmousedown="event.preventDefault(); richColor('#1B5E30')">أخضر</button>
  <button type="button" class="color-blue" onmousedown="event.preventDefault(); richColor('#0D47A1')">أزرق</button>
  <button type="button" class="color-red" onmousedown="event.preventDefault(); richColor('#B00000')">أحمر</button>
  <button type="button" class="color-orange" onmousedown="event.preventDefault(); richColor('#B45309')">برتقالي</button>
</div>

<div id="editUnote" class="rich-editor" contenteditable="true"></div>
      </div>

      <div class="modal-footer">
        <button class="primary-btn" onclick="saveEditGroup()">حفظ التعديل</button>
        <button onclick="closeEditModal()">إغلاق</button>
        <button onclick="downloadDataJS()">تحميل data.js</button>
        <button class="remove-small" onclick="deleteEditGroup()" style="margin-right:auto">🗑 حذف المجموعة</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function openEditGroup(groupId) {
  ensureEditModal();

  editGroupIndex = DATA.findIndex(g => Number(g.id) === Number(groupId));

  if (editGroupIndex === -1) {
    alert("لم يتم العثور على المجموعة");
    return;
  }

  const g = DATA[editGroupIndex];

  document.getElementById("editTitle").value = safeText(g.title);
  setRichEditorHtml("editNote", g.note);
  setRichEditorHtml("editUnote", g.unote);

  renderEditVerses(g.verses || []);

  document.getElementById("editModal").classList.add("open");
}

function closeEditModal() {
  const modal = document.getElementById("editModal");
  if (modal) modal.classList.remove("open");
}

function renderEditVerses(verses) {
  const box = document.getElementById("editVersesBox");
  if (!box) return;

  box.innerHTML = verses.map((v, vi) => `
    <div class="edit-verse-card" data-verse-index="${vi}">

      <div 
`).join("");
}

/* =========================
   TIMESTAMP / GITHUB UPDATE DISPLAY HELPERS
   (new functions inserted)
========================= */

function formatTimestamp(ms) {
  if (!ms) return "—";
  const d = new Date(Number(ms));
  if (isNaN(d.getTime())) return "—";
  const pad = n => String(n).padStart(2, "0");
  // Format: YYYY-MM-DD HH:MM (local time)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateGitHubTimestampDisplay(ms) {
  const target = document.getElementById("githubUpdate");
  const text = ms ? "آخر تحديث: " + formatTimestamp(ms) : "آخر تحديث: —";
  if (target) {
    target.textContent = text;
    target.title = ms ? `data.js آخر تعديل: ${new Date(Number(ms)).toString()}` : "آخر تحديث غير متوفر";
    return;
  }
  // Fallback: append to storageBadge if githubUpdate element not present
  const badge = document.getElementById("storageBadge");
  if (badge) {
    badge.dataset.ts = ms ? String(ms) : "";
    const existing = document.getElementById("storageBadgeTs");
    if (existing) {
      existing.textContent = text;
    } else {
      const span = document.createElement("span");
      span.id = "storageBadgeTs";
      span.className = "storage-update";
      span.textContent = text;
      badge.insertAdjacentElement("afterend", span);
    }
  }
}

function showSavedTimestampOnLoad() {
  // Prefer localStorage timestamp
  try {
    const tsStr = localStorage.getItem(LS_KEY + "_ts");
    if (tsStr) {
      const ms = Number(tsStr);
      if (!isNaN(ms)) {
        updateGitHubTimestampDisplay(ms);
        return;
      }
    }
  } catch (e) {
    console.warn("Error reading timestamp from localStorage:", e);
  }

  // If fileHandle exists, try to read file metadata
  if (fileHandle && typeof fileHandle.getFile === "function") {
    fileHandle.getFile().then(f => {
      const lm = f && f.lastModified ? f.lastModified : Date.now();
      try { localStorage.setItem(LS_KEY + "_ts", String(lm)); } catch (e) {}
      updateGitHubTimestampDisplay(lm);
    }).catch(() => {
      updateGitHubTimestampDisplay(null);
    });
    return;
  }

  updateGitHubTimestampDisplay(null);
}

/* =========================
   INIT / STARTUP
   Call showSavedTimestampOnLoad after UI built
========================= */

// Basic init: load localStorage (if any), build UI and show timestamp
window.addEventListener("load", function() {
  // If you have a custom init sequence, ensure these calls are placed appropriately
  try {
    const loaded = loadFromLocalStorage();
    if (!loaded) {
      // DATA should be defined in data.js; if not, ensure it's available
    }
  } catch (e) {
    console.warn("Error loading from localStorage:", e);
  }

  // Build UI components if present
  try {
    buildSurahFilterBar();
  } catch (e) {}

  try {
    applyAllFilters();
  } catch (e) {}

  // Show timestamp (reads localStorage or file metadata)
  try {
    showSavedTimestampOnLoad();
  } catch (e) {}
});
