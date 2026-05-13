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

// Auto-save DATA to localStorage
function autoSaveToLocalStorage() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(DATA));
    updateStorageStatus("saved");
  } catch(e) {
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
  if (state === "loading") { badge.textContent = "⏳ جاري التحميل من GitHub..."; badge.style.color = "#B45309"; }
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

// Write directly to linked file
async function writeToLinkedFile() {
  if (!fileHandle) return false;
  try {
    updateStorageStatus("writing");
    const content = "const DATA = " + JSON.stringify(DATA, null, 2) + ";";
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
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
  syncToGitHub(); // fire-and-forget to GitHub
}

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

  return text.split(q).join('<span class="highlight">' + q + '</span>');
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

  app.innerHTML = data.map(g => {
    const tags = getTags(g);
    const color = getGroupColor(g);

    return `
      <article class="group">

        <div class="group-header" style="background:${color}" onclick="toggleGroup(this)">

          <div class="group-num">
            ${safeText(g.id)}
          </div>

          <div class="group-title-wrap">
            <div class="group-tags">
              ${tags.map(t => `<span class="tag">#${safeText(t)}</span>`).join("")}
            </div>

            <div class="group-title">
              ${safeText(g.title)}
            </div>
          </div>

          <div class="group-side">
            <button class="mini-edit-btn" onclick="event.stopPropagation(); openEditGroup(${Number(g.id)})">✏️</button>
            <span>☷</span>
          </div>

        </div>

        <div class="group-body">

          ${(g.verses || []).map(v => {
            const isUnique =
              (v.parts || []).some(p => p.type === "unique") || v.unique;

            return `
              <div class="verse-card ${isUnique ? "uniq-row" : ""}">

                <div class="verse-ref">
                  <span class="surah-name" style="color:${color}">
                    ${safeText(v.surah)}
                  </span>

                  <span class="ayah-num">
                    ${safeText(v.ayah)}
                  </span>

                  ${
                    v.label
                      ? `<span class="verse-lbl">${safeText(v.label)}</span>`
                      : ""
                  }
                </div>

                <div class="verse-text">
                  ${(v.parts || []).map(p => `
                    <span class="${safeText(p.type || "normal")}">
                      ${highlightText(p.text)}
                    </span>
                  `).join("")}
                </div>

              </div>
            `;
          }).join("")}

          ${
            g.note
              ? `<div class="note">${typeof rtNormalizeStored==="function"?rtNormalizeStored(g.note):cleanNoteLabel(g.note)}</div>`
              : ""
          }

          ${
            g.unote
              ? `<div class="unote">${typeof rtNormalizeStored==="function"?rtNormalizeStored(g.unote):cleanNoteLabel(g.unote)}</div>`
              : ""
          }

        </div>

      </article>
    `;
  }).join("");
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
 updateToggleAllButton();
}

function collapseAll() {
  document.querySelectorAll(".group").forEach(g => {
    g.classList.remove("open");
  });
 updateToggleAllButton();
}

/* =========================
 TOGGLE OPEN/CLOSE (single button)
 - Normal modes: toggle all groups open/closed
 - Group by Surah mode: toggle all Surah sections open/closed
========================= */
function isGroupBySurahMode() {
  try {
    return (typeof gbGetMode === 'function') && gbGetMode() === 'group-surah';
  } catch (e) {
    return false;
  }
}

function updateToggleAllButton() {
  const btn = document.getElementById('toggleAllBtn');
  if (!btn) return;

  if (isGroupBySurahMode()) {
    const sections = Array.from(document.querySelectorAll('.surah-section'));
    if (!sections.length) {
      btn.textContent = 'فتح الكل';
      return;
    }
    const allExpanded = sections.every(s => !s.classList.contains('collapsed'));
    btn.textContent = allExpanded ? 'طي الكل' : 'فتح الكل';
    return;
  }

  const groups = Array.from(document.querySelectorAll('.group'));
  if (!groups.length) {
    btn.textContent = 'فتح الكل';
    return;
  }
  const allOpen = groups.every(g => g.classList.contains('open'));
  btn.textContent = allOpen ? 'طي الكل' : 'فتح الكل';
}

function expandAllSurahSections() {
  const sections = Array.from(document.querySelectorAll('.surah-section'));
  if (!sections.length) return;
  sections.forEach(s => s.classList.remove('collapsed'));
  if (typeof gbSaveCollapsed === 'function') {
    gbSaveCollapsed(new Set());
  }
}

function collapseAllSurahSections() {
  const sections = Array.from(document.querySelectorAll('.surah-section'));
  if (!sections.length) return;
  sections.forEach(s => s.classList.add('collapsed'));
  if (typeof gbSaveCollapsed === 'function') {
    const set = new Set(sections.map(s => String(s.id)).filter(Boolean));
    gbSaveCollapsed(set);
  }
}

function toggleAllSurahSections() {
  const sections = Array.from(document.querySelectorAll('.surah-section'));
  if (!sections.length) return;
  const anyExpanded = sections.some(s => !s.classList.contains('collapsed'));
  if (anyExpanded) {
    collapseAllSurahSections();
  } else {
    expandAllSurahSections();
  }
}

function toggleAll() {
  if (isGroupBySurahMode()) {
    toggleAllSurahSections();
  } else {
    const groups = Array.from(document.querySelectorAll('.group'));
    const allOpen = groups.length && groups.every(g => g.classList.contains('open'));
    if (allOpen) {
      collapseAll();
    } else {
      expandAll();
    }
  }
  updateToggleAllButton();
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
  const surahNo = document.getElementById("newSurah").value;
  const ayahSel = document.getElementById("newAyah");

  if (typeof getSurahAyahs === "undefined") {
    ayahSel.innerHTML = '<option value="">quran-reference.js غير موجود</option>';
    return;
  }

  const ayahs = getSurahAyahs(surahNo);

  ayahSel.innerHTML = ayahs.map(a => `
    <option value="${a.ayahNo}">
      ${a.ayahNo}
    </option>
  `).join("");

  previewSelectedAyah();
}

function previewSelectedAyah() {
  const surahNo = document.getElementById("newSurah").value;
  const ayahNo = document.getElementById("newAyah").value;
  const preview = document.getElementById("ayahPreview");

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
    box.innerHTML = "لا توجد آيات مضافة بعد.";
    return;
  }

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
========================= */

function downloadDataJS() {
  const content = "const DATA = " + JSON.stringify(DATA, null, 2) + ";";
  const blob = new Blob([content], { type: "application/javascript;charset=utf-8" });

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


/* ========================= RICH TEXT NOTES ========================= */
let __rtActiveEditorId=null;
function rtSetActive(id){__rtActiveEditorId=id}
function rtExec(cmd,value){try{const id=__rtActiveEditorId;const el=id?document.getElementById(id):null;if(el)el.focus();document.execCommand(cmd,false,value||null)}catch(e){}}
function rtApplyColor(color){rtExec('foreColor',color)}
function rtLooksLikeHtml(s){s=safeText(s);return /<\s*\/?\s*(b|strong|u|span|br|div|p|ul|ol|li|font)\b/i.test(s)}
function rtTextToHtml(s){return escapeHtml(s).replace(/\r\n/g,'\n').replace(/\n/g,'<br>')}
function sanitizeRichText(html){html=safeText(html);if(!html)return'';html=html.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,'');html=html.replace(/\son\w+\s*=\s*(['"]).*?\1/gi,'');return html}
function rtNormalizeStored(val){val=safeText(val);val=cleanNoteLabel(val);if(!val)return'';if(rtLooksLikeHtml(val))return sanitizeRichText(val);return rtTextToHtml(val)}

function ensureEditModal() {
  if (document.getElementById("editModal")) return;

  const modal = document.createElement("div");
  modal.id = "editModal";
  modal.className = "modal-backdrop";

  modal.innerHTML = `
    <div class="modal edit-modal">
      <div class="modal-header">
        <h2>تعديل المتشابه</h2>
        <div class="header-actions"><button class="hdr-btn hdr-primary" onclick="saveEditGroup()">💾 حفظ</button><button class="hdr-btn" onclick="closeEditModal()">✕ إغلاق</button></div>
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
        <div class="rt-box"><div class="rt-toolbar"><button class="rt-btn" onclick="rtExec('bold')"><b>B</b></button><button class="rt-btn" onclick="rtExec('underline')"><u>U</u></button><button class="rt-btn" onclick="rtExec('insertUnorderedList')">• قائمة</button><span class="rt-sep"></span><input class="rt-color" type="color" value="#0D47A1" onchange="rtApplyColor(this.value)" title="لون الخط"><button class="rt-btn" onclick="rtExec('removeFormat')">مسح تنسيق</button></div><div id="editNoteEditor" class="rt-editor" contenteditable="true" onfocus="rtSetActive('editNoteEditor')"></div></div>

        <label>فائدة فريدة / إضافية</label>
        <div class="rt-box"><div class="rt-toolbar"><button class="rt-btn" onclick="rtExec('bold')"><b>B</b></button><button class="rt-btn" onclick="rtExec('underline')"><u>U</u></button><button class="rt-btn" onclick="rtExec('insertUnorderedList')">• قائمة</button><span class="rt-sep"></span><input class="rt-color" type="color" value="#B00000" onchange="rtApplyColor(this.value)" title="لون الخط"><button class="rt-btn" onclick="rtExec('removeFormat')">مسح تنسيق</button></div><div id="editUnoteEditor" class="rt-editor" contenteditable="true" onfocus="rtSetActive('editUnoteEditor')"></div></div>
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
  var _nEd=document.getElementById('editNoteEditor');if(_nEd)_nEd.innerHTML=rtNormalizeStored(g.note);
  var _uEd=document.getElementById('editUnoteEditor');if(_uEd)_uEd.innerHTML=rtNormalizeStored(g.unote);

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

      <div class="edit-verse-header">
        <b>آية ${vi + 1}</b>

        <div class="edit-verse-actions">
          <button onclick="moveEditVerseUp(${vi})">↑</button>
          <button onclick="moveEditVerseDown(${vi})">↓</button>
          <button class="remove-small" onclick="removeEditVerse(${vi})">حذف الآية</button>
        </div>
      </div>

      <div class="grid-3">
        <div>
          <label>السورة</label>
          <select class="edit-surah full-input" onchange="onEditSurahChange(${vi})">
            ${buildEditSurahOptions(v.surah)}
          </select>
        </div>

        <div>
          <label>رقم الآية</label>
          <select class="edit-ayah full-input" onchange="fillEditAyahFromReference(${vi})">
            ${buildEditAyahOptions(v.surah, v.ayah)}
          </select>
        </div>

        <div>
          <label>Label</label>
          <input class="edit-label full-input" value="${escapeAttr(v.label)}">
        </div>
      </div>

      <div class="ayah-fill-actions">
        <button onclick="fillEditAyahFromReference(${vi})">ملء نص الآية من المرجع</button>
      </div>

      <label>أجزاء النص</label>

      <div class="edit-parts-box">
        ${(v.parts || []).map((p, pi) => renderEditPart(p, vi, pi)).join("")}
      </div>

      <button onclick="addEditPart(${vi})">+ إضافة جزء نص</button>

    </div>
  `).join("");
}

function renderEditPart(p, vi, pi) {
  const type = safeText(p.type || "normal");

  return `
    <div class="edit-part-row" data-part-index="${pi}">
      <select class="edit-part-type">
        <option value="normal" ${type === "normal" ? "selected" : ""}>normal</option>
        <option value="shared" ${type === "shared" ? "selected" : ""}>shared</option>
        <option value="diff" ${type === "diff" ? "selected" : ""}>diff</option>
        <option value="addition" ${type === "addition" ? "selected" : ""}>addition</option>
        <option value="unique" ${type === "unique" ? "selected" : ""}>unique</option>
      </select>

      <textarea class="edit-part-text">${escapeHtml(p.text)}</textarea>

      <button class="remove-small" onclick="removeEditPart(${vi}, ${pi})">حذف</button>
    </div>
  `;
}

function onEditSurahChange(verseIndex) {
  const verses = collectEditVersesFromDOM();

  const card = document.querySelectorAll("#editVersesBox .edit-verse-card")[verseIndex];
  if (!card) return;

  const surah = card.querySelector(".edit-surah")?.value || "";
  const ayahSelect = card.querySelector(".edit-ayah");

  const ayahs = getSurahAyahs(getSurahNoByName(surah));

  ayahSelect.innerHTML = ayahs.map(a => `
    <option value="${a.ayahNo}">
      ${a.ayahNo}
    </option>
  `).join("");

  // Update collected verses with new surah and first ayah
  verses[verseIndex].surah = surah;
  verses[verseIndex].ayah = ayahSelect.value;

  renderEditVerses(verses);

  // Fill ayah text after changing surah
  fillEditAyahFromReference(verseIndex);
}

function fillEditAyahFromReference(verseIndex) {
  const verses = collectEditVersesFromDOM();

  if (!verses[verseIndex]) return;

  const surah = verses[verseIndex].surah;
  const ayah = verses[verseIndex].ayah;

  const a = getAyah(getSurahNoByName(surah), getAyahNoValue(ayah));

  if (!a) {
    alert("لم يتم العثور على الآية في quran-reference.js");
    return;
  }

  // Keep the first selected type if exists
  const currentType =
    verses[verseIndex].parts &&
    verses[verseIndex].parts[0] &&
    verses[verseIndex].parts[0].type
      ? verses[verseIndex].parts[0].type
      : "normal";

  verses[verseIndex].surah = a.surah;
  verses[verseIndex].ayah = a.ayahNo;
  verses[verseIndex].parts = [
    {
      type: currentType,
      text: a.text
    }
  ];

  renderEditVerses(verses);
}

function collectEditVersesFromDOM() {
  const verseCards = document.querySelectorAll("#editVersesBox .edit-verse-card");
  const verses = [];

  verseCards.forEach(card => {
    const surah = card.querySelector(".edit-surah")?.value.trim() || "";
    const ayah = card.querySelector(".edit-ayah")?.value.trim() || "";
    const label = card.querySelector(".edit-label")?.value.trim() || "";

    const parts = [];

    card.querySelectorAll(".edit-part-row").forEach(row => {
      const type = row.querySelector(".edit-part-type")?.value || "normal";
      const text = row.querySelector(".edit-part-text")?.value || "";

      if (text.trim()) {
        parts.push({
          type,
          text
        });
      }
    });

    if (surah || ayah || parts.length) {
      verses.push({
        surah,
        ayah,
        label,
        parts
      });
    }
  });

  return verses;
}

function saveEditGroup() {
  if (editGroupIndex === null || editGroupIndex < 0) {
    alert("لا توجد مجموعة مفتوحة للتعديل");
    return;
  }

  const title = document.getElementById("editTitle").value.trim();
  const note = sanitizeRichText(document.getElementById('editNoteEditor')?.innerHTML||'').trim();
  const unote = sanitizeRichText(document.getElementById('editUnoteEditor')?.innerHTML||'').trim();
  const verses = collectEditVersesFromDOM();

  if (!title) {
    alert("عنوان المتشابه لا يمكن أن يكون فارغًا");
    return;
  }

  if (!verses.length) {
    alert("يجب وجود آية واحدة على الأقل");
    return;
  }

  const oldGroup = DATA[editGroupIndex];

  DATA[editGroupIndex] = {
    ...oldGroup,
    title,
    surahs: [...new Set(verses.map(v => v.surah).filter(Boolean))],
    verses,
    note,
    unote
  };

  closeEditModal();
  masterSave();
  buildSurahFilterBar();
  applyAllFilters();

  alert("تم التعديل وحُفظ تلقائياً.\nاضغط تحميل data.js لحفظ في Files/iCloud.");
}

function removeEditVerse(verseIndex) {
  const verses = collectEditVersesFromDOM();
  verses.splice(verseIndex, 1);
  renderEditVerses(verses);
}

function addBlankEditVerse() {
  const verses = collectEditVersesFromDOM();

  const firstSurahNo = 1;
  const firstSurahName = SURAH_NAMES[firstSurahNo];
  const firstAyah = getAyah(firstSurahNo, 1);

  verses.push({
    surah: firstSurahName,
    ayah: 1,
    label: "",
    parts: [
      {
        type: "normal",
        text: firstAyah ? firstAyah.text : ""
      }
    ]
  });

  renderEditVerses(verses);
}

function addEditPart(verseIndex) {
  const verses = collectEditVersesFromDOM();

  if (!verses[verseIndex]) return;

  if (!Array.isArray(verses[verseIndex].parts)) {
    verses[verseIndex].parts = [];
  }

  verses[verseIndex].parts.push({
    type: "normal",
    text: ""
  });

  renderEditVerses(verses);
}

function removeEditPart(verseIndex, partIndex) {
  const verses = collectEditVersesFromDOM();

  if (!verses[verseIndex]) return;

  verses[verseIndex].parts.splice(partIndex, 1);

  if (!verses[verseIndex].parts.length) {
    verses[verseIndex].parts.push({
      type: "normal",
      text: ""
    });
  }

  renderEditVerses(verses);
}

function moveEditVerseUp(index) {
  const verses = collectEditVersesFromDOM();

  if (index <= 0) return;

  const temp = verses[index - 1];
  verses[index - 1] = verses[index];
  verses[index] = temp;

  renderEditVerses(verses);
}

function moveEditVerseDown(index) {
  const verses = collectEditVersesFromDOM();

  if (index >= verses.length - 1) return;

  const temp = verses[index + 1];
  verses[index + 1] = verses[index];
  verses[index] = temp;

  renderEditVerses(verses);
}

function sortEditVersesByMushaf() {
  const verses = collectEditVersesFromDOM();

  verses.sort((a, b) => {
    const surahA = getSurahNoByName(a.surah);
    const surahB = getSurahNoByName(b.surah);

    if (surahA !== surahB) {
      return surahA - surahB;
    }

    return getAyahNoValue(a.ayah) - getAyahNoValue(b.ayah);
  });

  renderEditVerses(verses);
}



/* =========================
   DELETE GROUP
========================= */

function deleteEditGroup() {
  if (editGroupIndex === null || editGroupIndex < 0) {
    alert("لا توجد مجموعة مفتوحة للحذف");
    return;
  }
  const g = DATA[editGroupIndex];
  const confirmed = confirm(
    'هل أنت متأكد من حذف المجموعة:\n"' + safeText(g.title) + '"\n\nسيتم الحفظ التلقائي بعد الحذف.'
  );
  if (!confirmed) return;
  DATA.splice(editGroupIndex, 1);
  DATA.forEach(function(group, i) { group.id = i + 1; });
  closeEditModal();
  masterSave();
  buildSurahFilterBar();
  applyAllFilters();
  alert("تم الحذف وإعادة الترقيم وحُفظ تلقائياً.\nاضغط تحميل data.js لحفظ في Files/iCloud.");
}


/* =========================
   GITHUB API — AUTO SYNC
========================= */

const GH_SETTINGS_KEY = "mutashabihat_github";
let ghSyncing = false;

function loadGHSettings() {
  try {
    return JSON.parse(localStorage.getItem(GH_SETTINGS_KEY) || "{}");
  } catch(e) { return {}; }
}

function saveGHSettings(s) {
  localStorage.setItem(GH_SETTINGS_KEY, JSON.stringify(s));
}

function openGHSettings() {
  ensureGHModal();
  const s = loadGHSettings();
  document.getElementById("ghToken").value  = s.token  || "";
  document.getElementById("ghOwner").value  = s.owner  || "";
  document.getElementById("ghRepo").value   = s.repo   || "";
  document.getElementById("ghBranch").value = s.branch || "main";
  document.getElementById("ghPath").value   = s.path   || "data.js";
  document.getElementById("ghModal").classList.add("open");
}

function closeGHModal() {
  document.getElementById("ghModal").classList.remove("open");
}

function saveGHSettingsFromForm() {
  const s = {
    token:  document.getElementById("ghToken").value.trim(),
    owner:  document.getElementById("ghOwner").value.trim(),
    repo:   document.getElementById("ghRepo").value.trim(),
    branch: document.getElementById("ghBranch").value.trim() || "main",
    path:   document.getElementById("ghPath").value.trim()   || "data.js"
  };
  if (!s.token || !s.owner || !s.repo) {
    alert("Token, Username, and Repo are required.");
    return;
  }
  saveGHSettings(s);
  closeGHModal();
  updateGHBadge("ready");
  alert("GitHub settings saved. Next edit will auto-sync ✓");
}

function updateGHBadge(state, msg) {
  const badge = document.getElementById("ghBadge");
  if (!badge) return;
  if (state === "ready")    { badge.textContent = "☁ GitHub ready";  badge.style.color = "#1B5E30"; }
  if (state === "syncing")  { badge.textContent = "⏳ Syncing...";    badge.style.color = "#B45309"; }
  if (state === "ok")       { badge.textContent = "✓ Synced";         badge.style.color = "#1B5E30"; }
  if (state === "error")    { badge.textContent = "❌ " + (msg||"Sync failed"); badge.style.color = "#B00000"; }
  if (state === "none")     { badge.textContent = "☁ GitHub: not set"; badge.style.color = "#6B7A90"; }
}

async function fetchDataFromGitHub(s) {
  // Fetch raw data.js from GitHub and update DATA in memory + localStorage
  try {
    const rawUrl = "https://raw.githubusercontent.com/" +
                   s.owner + "/" + s.repo + "/" +
                   (s.branch || "main") + "/" +
                   (s.path || "data.js") +
                   "?nocache=" + Date.now();

    const res = await fetch(rawUrl);
    if (!res.ok) return false;

    const text = await res.text();

    // Extract the array from "const DATA = [...];"
    const match = text.match(/const\s+DATA\s*=\s*(\[[\s\S]*\])\s*;/);
    if (!match) return false;

    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed) || !parsed.length) return false;

    // Update DATA in memory
    DATA.length = 0;
    parsed.forEach(function(g) { DATA.push(g); });

    // Also update localStorage so offline works correctly
    autoSaveToLocalStorage();

    return true;
  } catch(e) {
    console.warn("fetchDataFromGitHub failed:", e);
    return false;
  }
}

async function syncToGitHub() {
  if (ghSyncing) return;
  const s = loadGHSettings();
  if (!s.token || !s.owner || !s.repo) return; // silently skip if not configured

  ghSyncing = true;
  updateGHBadge("syncing");

  const content = "const DATA = " + JSON.stringify(DATA, null, 2) + ";";
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const url = "https://api.github.com/repos/" + s.owner + "/" + s.repo +
              "/contents/" + (s.path || "data.js");
  const headers = {
    "Authorization": "token " + s.token,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json"
  };

  try {
    // Step 1: get current SHA
    const getRes = await fetch(url + "?ref=" + (s.branch || "main"), { headers });
    let sha = null;
    if (getRes.ok) {
      const json = await getRes.json();
      sha = json.sha;
    }

    // Step 2: push updated file
    const body = {
      message: "تحديث data.js — " + new Date().toLocaleString("ar"),
      content: encoded,
      branch: s.branch || "main"
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body)
    });

    if (putRes.ok) {
      updateGHBadge("ok");
    } else {
      const err = await putRes.json();
      updateGHBadge("error", err.message || putRes.status);
    }
  } catch(e) {
    updateGHBadge("error", "Network error");
  } finally {
    ghSyncing = false;
  }
}

function ensureGHModal() {
  if (document.getElementById("ghModal")) return;
  const m = document.createElement("div");
  m.id = "ghModal";
  m.className = "modal-backdrop";
  m.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h2>GitHub Settings</h2>
        <button class="close-btn" onclick="closeGHModal()">×</button>
      </div>
      <div class="modal-body">
        <p style="font-size:.85rem;color:#3A4A60;margin-bottom:12px;line-height:1.7">
          Every save will auto-commit <b>data.js</b> to your repo.<br>
          GitHub Pages updates within ~60 seconds.
        </p>

        <label>GitHub Personal Access Token</label>
        <input id="ghToken" class="full-input" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx">
        <p style="font-size:.75rem;color:#6B7A90;margin:4px 0 10px">
          Settings → Developer settings → Personal access tokens → Tokens (classic) → repo scope
        </p>

        <label>GitHub Username</label>
        <input id="ghOwner" class="full-input" placeholder="your-username">

        <label>Repository Name</label>
        <input id="ghRepo" class="full-input" placeholder="mutashabihat">

        <div class="grid-3" style="margin-top:10px">
          <div>
            <label>Branch</label>
            <input id="ghBranch" class="full-input" placeholder="main">
          </div>
          <div>
            <label>File path</label>
            <input id="ghPath" class="full-input" placeholder="data.js">
          </div>
          <div></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="primary-btn" onclick="saveGHSettingsFromForm()">حفظ الإعدادات</button>
        <button onclick="syncToGitHub()">مزامنة الآن</button>
        <button onclick="closeGHModal()">إغلاق</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);
}



/* =========================
   FINAL FIX: AYAH NUMBERS + CLEAN FONT SETTINGS + NO SAVE POPUP
========================= */
const THEME_STORAGE_KEY="mutashabihat_ui_theme";const THEME_NAMES={"quran-classic":"Quran Classic","apple-health":"Apple Health Clean","bevel-night":"Bevel Night Metrics","serene-reader":"Serene Reader","memorization-contrast":"Memorization Contrast","manuscript-premium":"Manuscript Premium","pro-dashboard":"Professional Dashboard"};function applyTheme(t){const theme=THEME_NAMES[t]?t:"quran-classic";document.body.setAttribute("data-theme",theme);localStorage.setItem(THEME_STORAGE_KEY,theme);const s=document.getElementById("settingsThemeSelect");if(s)s.value=theme}function changeTheme(t){applyTheme(t)}function initializeTheme(){applyTheme(localStorage.getItem(THEME_STORAGE_KEY)||"quran-classic")}
const FONT_STORAGE_KEY="mutashabihat_font_preset";const FONT_PRESET_NAMES={"classic-quran":"Classic Quran — Amiri Quran + Cairo","modern-reader":"Modern Reader — Scheherazade + Tajawal","mobile-clear":"Mobile Clear — Noto Naskh + Readex Pro","dashboard-pro":"Dashboard Pro — Noto Naskh + IBM Plex","manuscript-style":"Manuscript Style — Amiri + Aref Ruqaa","qpc-nastaleeq":"QPC Nastaleeq — KFGQPCNastaleeq-Regular","surah-display":"Surah Display — surah-name-v4"};function applyFontPreset(p){const preset=FONT_PRESET_NAMES[p]?p:"classic-quran";document.body.setAttribute("data-font-preset",preset);localStorage.setItem(FONT_STORAGE_KEY,preset);const s=document.getElementById("settingsFontPresetSelect");if(s)s.value=preset}function changeFontPreset(p){applyFontPreset(p)}function initializeFontPreset(){applyFontPreset(localStorage.getItem(FONT_STORAGE_KEY)||"classic-quran")}
function openAppSettings(){ensureAppSettingsModal();fillAppSettingsForm();document.getElementById("appSettingsModal").classList.add("open")}function closeAppSettings(){document.getElementById("appSettingsModal")?.classList.remove("open")}
function ensureAppSettingsModal(){if(document.getElementById("appSettingsModal"))return;const m=document.createElement("div");m.id="appSettingsModal";m.className="modal-backdrop";m.innerHTML=`<div class="modal edit-modal"><div class="modal-header"><h2>⚙ إعدادات التطبيق</h2><button class="close-btn" onclick="closeAppSettings()">×</button></div><div class="modal-body"><div class="settings-section"><h3>🎨 Theme / شكل الواجهة</h3><select id="settingsThemeSelect" class="theme-select-large" onchange="changeTheme(this.value)">${Object.keys(THEME_NAMES).map(k=>`<option value="${k}">${THEME_NAMES[k]}</option>`).join("")}</select></div><div class="settings-section"><h3>🔤 Font Style / نوع الخط</h3><select id="settingsFontPresetSelect" class="theme-select-large" onchange="changeFontPreset(this.value)">${Object.keys(FONT_PRESET_NAMES).map(k=>`<option value="${k}">${FONT_PRESET_NAMES[k]}</option>`).join("")}</select><div class="font-preview-box"><div class="font-preview-title">معاينة العنوان: متشابهات القرآن</div><div class="font-preview-surah">اسم السورة: البقرة</div><div class="font-preview-ayah">ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ</div><div class="font-preview-note">معاينة الملاحظات</div></div></div><div class="settings-section"><h3>☁ GitHub Auto Sync</h3><label>Token</label><input id="settingsGhToken" class="full-input" type="password"><div class="settings-grid"><div><label>Owner</label><input id="settingsGhOwner" class="full-input"></div><div><label>Repo</label><input id="settingsGhRepo" class="full-input"></div></div><div class="settings-grid"><div><label>Branch</label><input id="settingsGhBranch" class="full-input" placeholder="main"></div><div><label>Path</label><input id="settingsGhPath" class="full-input" placeholder="data.js"></div></div><div class="settings-action-row"><button class="primary-btn" onclick="saveAppSettings()">حفظ</button><button onclick="syncToGitHub()">مزامنة الآن</button></div></div><div class="settings-section"><h3>💾 التخزين والنسخ الاحتياطي</h3><div class="settings-action-row"><button onclick="downloadDataJS()">📤 Export data.js</button><button onclick="linkDataFile()">🔗 Link data.js</button><button class="settings-warning" onclick="clearLocalStorage()">↺ Reset</button></div></div></div><div class="modal-footer"><button class="primary-btn" onclick="saveAppSettings()">حفظ</button><button onclick="closeAppSettings()">إغلاق</button></div></div>`;document.body.appendChild(m)}
function fillAppSettingsForm(){const gh=typeof loadGHSettings==="function"?loadGHSettings():{};const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v||""};set("settingsThemeSelect",localStorage.getItem(THEME_STORAGE_KEY)||"quran-classic");set("settingsFontPresetSelect",localStorage.getItem(FONT_STORAGE_KEY)||"classic-quran");set("settingsGhToken",gh.token);set("settingsGhOwner",gh.owner);set("settingsGhRepo",gh.repo);set("settingsGhBranch",gh.branch||"main");set("settingsGhPath",gh.path||"data.js")}
function saveAppSettings(){applyTheme(document.getElementById("settingsThemeSelect")?.value||"quran-classic");applyFontPreset(document.getElementById("settingsFontPresetSelect")?.value||"classic-quran");const token=document.getElementById("settingsGhToken")?.value.trim()||"",owner=document.getElementById("settingsGhOwner")?.value.trim()||"",repo=document.getElementById("settingsGhRepo")?.value.trim()||"",branch=document.getElementById("settingsGhBranch")?.value.trim()||"main",path=document.getElementById("settingsGhPath")?.value.trim()||"data.js";if(token||owner||repo){if(!token||!owner||!repo){closeAppSettings();return}saveGHSettings({token,owner,repo,branch,path});updateGHBadge("ready")}closeAppSettings()}
let surahFilterPanelOpen=false,showOnlySurahsWithResults=true,activeSurahRange="all",surahFilterSearchText="";function getCountBadgeClass(c){if(!c)return"zero";if(c>=10)return"high";if(c>=4)return"medium";return"low"}function getRangeBounds(r){if(r==="1-30")return[1,30];if(r==="31-60")return[31,60];if(r==="61-90")return[61,90];if(r==="91-114")return[91,114];return[1,114]}function toggleSurahFilterPanel(){surahFilterPanelOpen=!surahFilterPanelOpen;document.getElementById("surahFilterPanel")?.classList.toggle("collapsed",!surahFilterPanelOpen);const b=document.getElementById("surahFilterToggleBtn");if(b)b.textContent=surahFilterPanelOpen?"إغلاق الفلتر ▴":"فتح الفلتر ▾"}function toggleOnlyWithResults(){showOnlySurahsWithResults=!showOnlySurahsWithResults;document.getElementById("onlyResultsBtn")?.classList.toggle("active",showOnlySurahsWithResults);renderSurahFilterButtons()}function runSurahFilterSearch(){surahFilterSearchText=document.getElementById("surahFilterSearch")?.value.trim()||"";renderSurahFilterButtons()}function setSurahRange(r){activeSurahRange=r||"all";document.querySelectorAll(".range-tab").forEach(b=>b.classList.toggle("active",b.dataset.range===activeSurahRange));renderSurahFilterButtons()}function buildSurahFilterBar(){renderSurahFilterButtons();updateSelectedSurahChip()}function renderSurahPill(no,name,count,cls){const active=selectedSurahFilter===name?"active":"",zero=count?"":"zero-count",bc=getCountBadgeClass(count);return`<button class="${cls||"pro-surah-pill"} ${active} ${zero}" data-surah="${escapeAttr(name)}" data-count="${count}" onclick="filterBySurah('${escapeAttr(name)}')"><span class="surah-no-badge">${Number(no).toLocaleString('en-US')}</span><span class="surah-name-text">${safeText(name)}</span><span class="surah-count-badge ${bc}">${Number(count).toLocaleString('en-US')}</span></button>`}function renderSurahFilterButtons(){const grid=document.getElementById("surahFilterGrid"),top=document.getElementById("topSurahGrid"),cnt=document.getElementById("surahFilterCount");if(!grid)return;const names=typeof SURAH_NAMES!=="undefined"?SURAH_NAMES:getDefaultSurahNames(),counts=getSurahGroupCounts(DATA),q=safeText(surahFilterSearchText).toLowerCase(),b=getRangeBounds(activeSurahRange);const items=Object.keys(names).map(no=>({no:+no,name:names[no],count:counts[names[no]]||0}));const topItems=items.filter(i=>i.count>0).sort((a,b)=>b.count-a.count||a.no-b.no).slice(0,8);if(top)top.innerHTML=topItems.map(i=>renderSurahPill(i.no,i.name,i.count,"top-surah-pill")).join("");const vis=items.filter(i=>i.no>=b[0]&&i.no<=b[1]&&(!showOnlySurahsWithResults||i.count>0||selectedSurahFilter===i.name)&&(!q||String(i.no).includes(q)||safeText(i.name).toLowerCase().includes(q)));grid.innerHTML=vis.length?vis.map(i=>renderSurahPill(i.no,i.name,i.count,"pro-surah-pill")).join(""):`<div class="no-results" style="padding:18px">لا توجد سور مطابقة</div>`;if(cnt)cnt.textContent="المعروض: "+vis.length+" من 114 سورة";updateSurahButtonAvailability(getSearchOnlyFilteredData())}function updateSelectedSurahChip(){const chip=document.getElementById("selectedSurahChip"),st=document.getElementById("filterStatus");if(!chip)return;if(!selectedSurahFilter){chip.classList.add("hidden");chip.innerHTML="";if(st)st.textContent="المعروض الآن: كل السور";return}const c=getSurahGroupCounts(DATA)[selectedSurahFilter]||0;chip.classList.remove("hidden");chip.innerHTML=`<span>السورة المختارة: ${safeText(selectedSurahFilter)}</span><span class="surah-count-badge ${getCountBadgeClass(c)}">${Number(c).toLocaleString('en-US')}</span><button onclick="clearSurahFilter()">×</button>`;if(st)st.textContent="المعروض الآن: "+selectedSurahFilter}function filterBySurah(s){selectedSurahFilter=s;updateSelectedSurahChip();renderSurahFilterButtons();applyAllFilters()}function clearSurahFilter(){selectedSurahFilter=null;updateSelectedSurahChip();renderSurahFilterButtons();applyAllFilters()}function updateSurahButtonAvailability(d){const a=new Set();(Array.isArray(d)?d:[]).forEach(g=>getTags(g).forEach(s=>a.add(s)));document.querySelectorAll(".pro-surah-pill,.top-surah-pill").forEach(btn=>btn.classList.toggle("no-match",!(a.has(btn.dataset.surah)||selectedSurahFilter===btn.dataset.surah)))}
function renderEditPart(p,vi,pi){const type=safeText((p&&p.type)||"normal"),text=p&&p.text!==undefined?p.text:"";return`<div class="edit-part-row" data-part-index="${pi}"><select class="edit-part-type"><option value="normal" ${type==="normal"?"selected":""}>normal</option><option value="shared" ${type==="shared"?"selected":""}>shared</option><option value="diff" ${type==="diff"?"selected":""}>diff</option><option value="addition" ${type==="addition"?"selected":""}>addition</option><option value="unique" ${type==="unique"?"selected":""}>unique</option></select><textarea class="edit-part-text" placeholder="اكتب جزء الآية هنا...">${escapeHtml(text)}</textarea><div class="part-action-bar"><button class="move-part-btn" onclick="moveEditPartUp(${vi},${pi})">↑ أعلى</button><button class="move-part-btn" onclick="moveEditPartDown(${vi},${pi})">↓ أسفل</button><button class="insert-part-btn" onclick="insertEditPartAbove(${vi},${pi})">+ فوق</button><button class="insert-part-btn" onclick="insertEditPartBelow(${vi},${pi})">+ تحت</button><button class="remove-small" onclick="removeEditPart(${vi},${pi})">حذف</button></div></div>`}function collectEditVersesFromDOM(){const cards=document.querySelectorAll("#editVersesBox .edit-verse-card"),verses=[];cards.forEach(card=>{const surah=(card.querySelector(".edit-surah")?.value||"").trim(),ayah=(card.querySelector(".edit-ayah")?.value||"").trim(),label=(card.querySelector(".edit-label")?.value||"").trim(),parts=[];card.querySelectorAll(".edit-part-row").forEach(row=>parts.push({type:row.querySelector(".edit-part-type")?.value||"normal",text:row.querySelector(".edit-part-text")?.value||""}));if(!parts.length)parts.push({type:"normal",text:""});if(surah&&ayah)verses.push({surah,ayah,label,parts})});return verses}function cleanEmptyEditPartsBeforeSave(vs){return vs.map(v=>{const parts=(v.parts||[]).filter(p=>safeText(p.text).trim()!=="");return{...v,parts:parts.length?parts:[{type:"normal",text:""}]}}).filter(v=>v.surah&&v.ayah&&(v.parts||[]).some(p=>safeText(p.text).trim()!==""))}function moveEditPartUp(vi,pi){const vs=collectEditVersesFromDOM();if(!vs[vi]||pi<=0)return;[vs[vi].parts[pi-1],vs[vi].parts[pi]]=[vs[vi].parts[pi],vs[vi].parts[pi-1]];renderEditVerses(vs)}function moveEditPartDown(vi,pi){const vs=collectEditVersesFromDOM();if(!vs[vi]||pi>=vs[vi].parts.length-1)return;[vs[vi].parts[pi+1],vs[vi].parts[pi]]=[vs[vi].parts[pi],vs[vi].parts[pi+1]];renderEditVerses(vs)}function insertEditPartAbove(vi,pi){const vs=collectEditVersesFromDOM();if(!vs[vi])return;vs[vi].parts.splice(pi,0,{type:"normal",text:""});renderEditVerses(vs)}function insertEditPartBelow(vi,pi){const vs=collectEditVersesFromDOM();if(!vs[vi])return;vs[vi].parts.splice(pi+1,0,{type:"normal",text:""});renderEditVerses(vs)}function addEditPart(vi){const vs=collectEditVersesFromDOM();if(!vs[vi])return;vs[vi].parts.push({type:"normal",text:""});renderEditVerses(vs)}function removeEditPart(vi,pi){const vs=collectEditVersesFromDOM();if(!vs[vi])return;vs[vi].parts.splice(pi,1);if(!vs[vi].parts.length)vs[vi].parts.push({type:"normal",text:""});renderEditVerses(vs)}function saveEditGroup(){if(editGroupIndex===null||editGroupIndex<0){return}const title=document.getElementById("editTitle").value.trim(),note=sanitizeRichText(document.getElementById('editNoteEditor')?.innerHTML||'').trim(),unote=sanitizeRichText(document.getElementById('editUnoteEditor')?.innerHTML||'').trim(),verses=cleanEmptyEditPartsBeforeSave(collectEditVersesFromDOM());if(!title||!verses.length)return;const oldGroup=DATA[editGroupIndex];DATA[editGroupIndex]={...oldGroup,title,surahs:[...new Set(verses.map(v=>v.surah).filter(Boolean))],verses,note,unote};closeEditModal();masterSave();buildSurahFilterBar();applyAllFilters()}

/* =========================
   INITIAL LOAD
========================= */

window.addEventListener("DOMContentLoaded", async function () {
  initializeTheme();
  initializeFontPreset();
  if (typeof DATA === "undefined") {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = '<div class="group"><div class="group-body" style="display:block;color:red">خطأ: ملف data.js غير مقروء.</div></div>';
    }
    return;
  }

  const ghS = loadGHSettings();
  const hasGH = ghS.token && ghS.owner && ghS.repo;

  if (hasGH) {
    // GitHub configured — fetch latest data.js from GitHub (source of truth)
    updateGHBadge("syncing");
    updateStorageStatus("loading");
    const loaded = await fetchDataFromGitHub(ghS);
    if (loaded) {
      updateGHBadge("ok");
      updateStorageStatus("saved");
    } else {
      // GitHub fetch failed — fall back to localStorage
      loadFromLocalStorage();
      updateGHBadge("error", "Could not fetch — using local data");
      updateStorageStatus("saved");
    }
  } else {
    // No GitHub — load from localStorage
    const fromLS = loadFromLocalStorage();
    if (fromLS) {
      updateStorageStatus("saved");
    }
    updateGHBadge("none");
  }

  buildSurahFilterBar();
  render(DATA);
  updateSurahButtonAvailability(DATA);
});

/* =========================
   ADDON: GROUP BY SURAH + FLOATING TOP BUTTON
   Version: groupby-surah-floating-top-20260509-01
========================= */
var GB_SURAH_MODE_KEY = "mutashabihat_group_display_mode";
var GB_COLLAPSED_KEY = "mutashabihat_collapsed_surah_sections_v4";
var GB_MODES = {
  "original": "Original Order — الترتيب الأصلي",
  "sort-surah": "Sort by Surah — ترتيب حسب السورة",
  "group-surah": "Group by Surah — تجميع حسب السورة",
  "newest": "Newest First — الأحدث أولاً",
  "most-verses": "Most Verses First — الأكثر آيات"
};

function gbText(v){ return (v === undefined || v === null) ? "" : String(v); }
function gbEsc(v){ return gbText(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;"); }
function gbSurahNames(){
  if (typeof SURAH_NAMES !== "undefined") return SURAH_NAMES;
  if (typeof getDefaultSurahNames === "function") return getDefaultSurahNames();
  return {};
}
function gbSurahNo(name){
  const names = gbSurahNames();
  const target = gbText(name).trim();
  for (const no in names) {
    if (gbText(names[no]).trim() === target) return Number(no);
  }
  return 9999;
}
function gbTags(g){
  if (typeof getTags === "function") return getTags(g);
  let arr = Array.isArray(g.surahs) ? g.surahs.filter(Boolean) : [];
  if (!arr.length && Array.isArray(g.verses)) arr = [...new Set(g.verses.map(v => v.surah).filter(Boolean))];
  return arr;
}
function gbAllSurahs(g){
  return gbTags(g).slice().sort((a,b) => gbSurahNo(a) - gbSurahNo(b));
}
function gbPrimaryNo(g){
  const arr = gbAllSurahs(g);
  return arr.length ? gbSurahNo(arr[0]) : 9999;
}
function gbFirstAyahNo(g){
  const nums = (g.verses || []).map(v => parseInt(v.ayah, 10)).filter(n => !isNaN(n));
  return nums.length ? Math.min(...nums) : 9999;
}
function gbGetMode(){
  return localStorage.getItem(GB_SURAH_MODE_KEY) || "group-surah";
}
function setGroupDisplayMode(mode){
  const value = GB_MODES[mode] ? mode : "group-surah";
  localStorage.setItem(GB_SURAH_MODE_KEY, value);
  const sel = document.getElementById("groupDisplaySelect");
  if (sel) sel.value = value;
  if (typeof applyAllFilters === "function") applyAllFilters();
  else if (typeof DATA !== "undefined") render(DATA);
  updateToggleAllButton();
}
function gbSort(data, mode){
  const arr = (Array.isArray(data) ? data : []).slice();
  if (mode === "sort-surah" || mode === "group-surah") {
    arr.sort((a,b) => gbPrimaryNo(a) - gbPrimaryNo(b) || gbFirstAyahNo(a) - gbFirstAyahNo(b) || (Number(a.id)||0) - (Number(b.id)||0));
  } else if (mode === "newest") {
    arr.sort((a,b) => (Number(b.id)||0) - (Number(a.id)||0));
  } else if (mode === "most-verses") {
    arr.sort((a,b) => ((b.verses||[]).length) - ((a.verses||[]).length) || gbPrimaryNo(a) - gbPrimaryNo(b));
  }
  return arr;
}
function gbGroupedByAllSurahs(data){
  const map = new Map();
  (data || []).forEach(g => {
    const surahs = gbAllSurahs(g);
    (surahs.length ? surahs : ["غير محدد"]).forEach(name => {
      const no = gbSurahNo(name);
      const key = String(no).padStart(3,"0") + "-" + name;
      if (!map.has(key)) map.set(key, { name, no, items: [], anchor: "surah-section-" + no });
      map.get(key).items.push(g);
    });
  });
  return Array.from(map.values()).sort((a,b) => a.no - b.no);
}
function gbCollapsedSet(){
  try { return new Set(JSON.parse(localStorage.getItem(GB_COLLAPSED_KEY) || "[]").map(String)); }
  catch(e){ return new Set(); }
}
function gbSaveCollapsed(set){
  localStorage.setItem(GB_COLLAPSED_KEY, JSON.stringify(Array.from(set)));
}
function toggleSurahSection(anchor, event){
  if (event) event.stopPropagation();
  const section = document.getElementById(anchor);
  if (!section) return;
  section.classList.toggle("collapsed");
  const set = gbCollapsedSet();
  if (section.classList.contains("collapsed")) set.add(String(anchor));
  else set.delete(String(anchor));
  gbSaveCollapsed(set);
  updateToggleAllButton();
}
function ensureGroupDisplayToolbar(data){
  const appEl = document.getElementById("app");
  if (!appEl) return;
  let toolbar = document.getElementById("groupDisplayToolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = "groupDisplayToolbar";
    toolbar.className = "group-display-toolbar";
    toolbar.innerHTML = '<label>طريقة عرض المجموعات</label><select id="groupDisplaySelect" class="group-display-select"></select><div id="surahIndexBar" class="surah-index-bar"></div>';
    appEl.parentNode.insertBefore(toolbar, appEl);
    const select = toolbar.querySelector("#groupDisplaySelect");
    Object.keys(GB_MODES).forEach(k => {
      const option = document.createElement("option");
      option.value = k;
      option.textContent = GB_MODES[k];
      select.appendChild(option);
    });
    select.addEventListener("change", function(){ setGroupDisplayMode(this.value); });
  }
  const select = document.getElementById("groupDisplaySelect");
  if (select) select.value = gbGetMode();
  const indexBar = document.getElementById("surahIndexBar");
  if (!indexBar) return;
  if (gbGetMode() === "group-surah") {
    const sections = gbGroupedByAllSurahs(gbSort(data, "group-surah"));
    indexBar.innerHTML = sections.map(s => `<button type="button" class="surah-index-link" onclick="document.getElementById('${s.anchor}').scrollIntoView({behavior:'smooth',block:'start'})"><span>${gbEsc(s.name)}</span><span class="idx-count">(${s.items.length})</span></button>`).join("");
  } else {
    indexBar.innerHTML = "";
  }
}
function gbGroupCard(g){
  const tags = gbTags(g);
  const color = (typeof getGroupColor === "function") ? getGroupColor(g) : (g.color || g.headerColor || "#1A4A7E");
  return `
    <article class="group" data-group-id="${gbEsc(g.id)}">
      <div class="group-header" style="background:${color}" onclick="toggleGroup(this)">
        <div class="group-num">${gbEsc(g.id)}</div>
        <div class="group-title-wrap">
          <div class="group-tags">${tags.map(t => `<span class="tag">#${gbEsc(t)}</span>`).join("")}</div>
          <div class="group-title">${gbEsc(g.title)}</div>
        </div>
        <div class="group-side">
          <button class="mini-edit-btn" onclick="event.stopPropagation(); openEditGroup(${Number(g.id)})">✏️</button>
          <span>☷</span>
        </div>
      </div>
      <div class="group-body">
        ${(g.verses || []).map(v => {
          const isUnique = (v.parts || []).some(p => p.type === "unique") || v.unique;
          return `<div class="verse-card ${isUnique ? "uniq-row" : ""}">
            <div class="verse-ref">
              <span class="surah-name" style="color:${color}">${gbEsc(v.surah)}</span>
              <span class="ayah-num">${gbEsc(v.ayah)}</span>
              ${v.label ? `<span class="verse-lbl">${gbEsc(v.label)}</span>` : ""}
            </div>
            <div class="verse-text">${(v.parts || []).map(p => `<span class="${gbEsc(p.type || "normal")}">${typeof highlightText === "function" ? highlightText(p.text) : gbEsc(p.text)}</span>`).join("")}</div>
          </div>`;
        }).join("")}
        ${g.note ? `<div class="note">${typeof rtNormalizeStored === "function" ? rtNormalizeStored(g.note) : gbEsc(g.note)}</div>` : ""}
        ${g.unote ? `<div class="unote">${typeof rtNormalizeStored === "function" ? rtNormalizeStored(g.unote) : gbEsc(g.unote)}</div>` : ""}
      </div>
    </article>`;
}
function render(data){
  const app = document.getElementById("app");
  const counter = document.getElementById("counter");
  if (!app) return;
  const list = Array.isArray(data) ? data : [];
  if (counter) counter.textContent = "عدد النتائج: " + list.length;
  if (!list.length) {
    app.innerHTML = '<div class="no-results">لا توجد نتائج</div>';
    ensureGroupDisplayToolbar([]);
    return;
  }
  const mode = gbGetMode();
  const sorted = gbSort(list, mode);
  ensureGroupDisplayToolbar(sorted);
  if (mode === "group-surah") {
    const collapsed = gbCollapsedSet();
    const sections = gbGroupedByAllSurahs(sorted);
    app.innerHTML = sections.map(section => {
      const isCollapsed = collapsed.has(String(section.anchor));
      return `<section class="surah-section ${isCollapsed ? "collapsed" : ""}" id="${section.anchor}">
        <div class="surah-section-header" onclick="toggleSurahSection('${section.anchor}', event)">
          <div class="surah-section-title">📖 سورة ${gbEsc(section.name)}</div>
          <div class="surah-section-count">${section.items.length} مجموعة</div>
        </div>
        <div class="surah-section-groups">${section.items.map(g => gbGroupCard(g)).join("")}</div>
      </section>`;
    }).join("");
  } else {
    app.innerHTML = sorted.map(g => gbGroupCard(g)).join("");
  }
  updateToggleAllButton();
}

/* =========================================================
 ADDON: FAVORITE + COMPLETED ICONS FOR EACH GROUP
 Version: favorite-completed-20260511-01
========================================================= */
function groupFlagBool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}
function findGroupById(groupId) {
  if (typeof DATA === "undefined" || !Array.isArray(DATA)) return null;
  return DATA.find(g => Number(g.id) === Number(groupId)) || null;
}
function toggleGroupFavorite(groupId) {
  const g = findGroupById(groupId);
  if (!g) return;
  g.favorite = !groupFlagBool(g.favorite);
  if (typeof masterSave === "function") masterSave();
  if (typeof buildSurahFilterBar === "function") buildSurahFilterBar();
  if (typeof applyAllFilters === "function") applyAllFilters();
  else if (typeof render === "function") render(DATA);
}
function toggleGroupCompleted(groupId) {
  const g = findGroupById(groupId);
  if (!g) return;
  g.completed = !groupFlagBool(g.completed);
  if (typeof masterSave === "function") masterSave();
  if (typeof buildSurahFilterBar === "function") buildSurahFilterBar();
  if (typeof applyAllFilters === "function") applyAllFilters();
  else if (typeof render === "function") render(DATA);
}
function getGroupStatusClasses(g) {
  const fav = groupFlagBool(g.favorite);
  const done = groupFlagBool(g.completed);
  return (fav ? " is-favorite" : "") + (done ? " is-completed" : "");
}
function renderGroupActionIcons(g) {
  const id = Number(g.id);
  const fav = groupFlagBool(g.favorite);
  const done = groupFlagBool(g.completed);
  return `
    <button class="group-status-btn favorite-btn ${fav ? "active" : ""}"
      type="button"
      onclick="event.stopPropagation(); toggleGroupFavorite(${id})"
      title="${fav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}"
      aria-label="${fav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}"
      aria-pressed="${fav ? "true" : "false"}">★</button>
    <button class="group-status-btn completed-btn ${done ? "active" : ""}"
      type="button"
      onclick="event.stopPropagation(); toggleGroupCompleted(${id})"
      title="${done ? "إلغاء علامة مكتمل" : "وضع علامة مكتمل"}"
      aria-label="${done ? "إلغاء علامة مكتمل" : "وضع علامة مكتمل"}"
      aria-pressed="${done ? "true" : "false"}">✓</button>
  `;
}

/* Override the latest group-card renderer so icons appear in all display modes */
function gbGroupCard(g){
 const tags = gbTags(g);
 const color = (typeof getGroupColor === "function") ? getGroupColor(g) : (g.color || g.headerColor || "#1A4A7E");
 const statusClasses = getGroupStatusClasses(g);
 return `
 <article class="group${statusClasses}" data-group-id="${gbEsc(g.id)}">
 <div class="group-header" style="background:${color}" onclick="toggleGroup(this)">
 <div class="group-num">${gbEsc(g.id)}</div>
 <div class="group-title-wrap">
 <div class="group-tags">${tags.map(t => `<span class="tag">#${gbEsc(t)}</span>`).join("")}</div>
 <div class="group-title">${gbEsc(g.title)}</div>
 </div>
 <div class="group-side">
 ${renderGroupActionIcons(g)}
 <button class="mini-edit-btn" onclick="event.stopPropagation(); openEditGroup(${Number(g.id)})">✏️</button>
 <span>☷</span>
 </div>
 </div>
 <div class="group-body">
 ${(g.verses || []).map(v => {
 const isUnique = (v.parts || []).some(p => p.type === "unique") || v.unique;
 return `<div class="verse-card ${isUnique ? "uniq-row" : ""}">
 <div class="verse-ref">
 <span class="surah-name" style="color:${color}">${gbEsc(v.surah)}</span>
 <span class="ayah-num">${gbEsc(v.ayah)}</span>
 ${v.label ? `<span class="verse-lbl">${gbEsc(v.label)}</span>` : ""}
 </div>
 <div class="verse-text">${(v.parts || []).map(p => `<span class="${gbEsc(p.type || "normal")}">${typeof highlightText === "function" ? highlightText(p.text) : gbEsc(p.text)}</span>`).join("")}</div>
 </div>`;
 }).join("")}
 ${g.note ? `<div class="note">${typeof rtNormalizeStored === "function" ? rtNormalizeStored(g.note) : gbEsc(g.note)}</div>` : ""}
 ${g.unote ? `<div class="unote">${typeof rtNormalizeStored === "function" ? rtNormalizeStored(g.unote) : gbEsc(g.unote)}</div>` : ""}
 </div>
 </article>`;
}

/* =========================================================
 ADDON: V34 SEARCH UI FINALIZATION PACK
 Features:
 - Ayah count badge beside each group title.
 - Advanced search moved to separate modal window.
 - Advanced search icon/button added beside main search bar.
 - Search/filter control card width aligned with below group/sort sections.
 - Hide old inline advanced search inside page.
 - Keep quran-reference search always at top of Add/Edit windows.
 Version: v34-search-ui-finalization-20260512-01
========================================================= */
(function(){
  if(window.__V34_SEARCH_UI_FINAL__) return;
  window.__V34_SEARCH_UI_FINAL__ = true;

  const V34 = {filters:{scope:'all',status:'all',difficulty:'all',review:'all'}};

  function t(v){return v===undefined||v===null?'':String(v)}
  function esc(v){return t(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function bool(v){return v===true||v==='true'||v===1||v==='1'}
  function norm(v){return t(v).replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'').replace(/\s+/g,' ').trim()}
  function allGroups(){return typeof DATA!=='undefined'&&Array.isArray(DATA)?DATA:[]}
  function stripHtml(v){const d=document.createElement('div');d.innerHTML=t(v);return d.textContent||d.innerText||''}
  function todayISO(){return new Date().toISOString().slice(0,10)}
  function ayahCount(g){return Array.isArray(g.verses)?g.verses.length:0}

  /* ---------- Ayah count badge beside each title ---------- */
  function injectAyahCountIntoCard(html,g){
    if(!html || html.includes('v34-ayah-count-badge')) return html;
    const count=ayahCount(g);
    const badge=`<span class="v34-ayah-count-badge" title="عدد الآيات في المجموعة">${count} آية</span>`;
    return html.replace(/(<div class="group-title"[^>]*>\s*[\s\S]*?)(<\/div>)/, `$1 ${badge}$2`);
  }
  if(typeof gbGroupCard==='function' && !window.__v34BaseGbGroupCard){
    window.__v34BaseGbGroupCard=gbGroupCard;
    window.gbGroupCard=function(g){return injectAyahCountIntoCard(window.__v34BaseGbGroupCard(g),g)};
  }

  /* ---------- Advanced search as separate modal ---------- */
  function ensureAdvModal(){
    if(document.getElementById('v34AdvancedSearchModal')) return;
    const m=document.createElement('div');
    m.id='v34AdvancedSearchModal';
    m.className='modal-backdrop v34-adv-backdrop';
    m.innerHTML=`
      <div class="modal v34-adv-modal">
        <div class="modal-header">
          <h2>بحث متقدم</h2>
          <button class="close-btn" onclick="v34CloseAdvancedSearch()">×</button>
        </div>
        <div class="modal-body">
          <div class="v34-adv-description">اختر نطاق البحث والفلاتر ثم اضغط تطبيق. البحث الرئيسي في الصفحة سيستخدم هذه الخيارات.</div>
          <div class="v34-adv-grid">
            <label>النطاق
              <select id="v34AdvScope">
                <option value="all">الكل</option>
                <option value="title">العنوان فقط</option>
                <option value="ayah">نص الآيات فقط</option>
                <option value="notes">الملاحظات فقط</option>
                <option value="surah">السورة فقط</option>
                <option value="ayahNo">رقم الآية فقط</option>
              </select>
            </label>
            <label>الحالة
              <select id="v34AdvStatus">
                <option value="all">الكل</option>
                <option value="favorite">المفضلة</option>
                <option value="completed">مكتمل</option>
                <option value="notCompleted">غير مكتمل</option>
                <option value="locked">مقفلة</option>
              </select>
            </label>
            <label>الصعوبة
              <select id="v34AdvDifficulty">
                <option value="all">الكل</option>
                <option>سهل</option>
                <option>متوسط</option>
                <option>صعب</option>
                <option>صعب جدًا</option>
              </select>
            </label>
            <label>المراجعة
              <select id="v34AdvReview">
                <option value="all">الكل</option>
                <option value="today">اليوم أو متأخر</option>
                <option value="none">بدون تاريخ</option>
              </select>
            </label>
          </div>
          <div class="v34-active-filter-preview" id="v34ActiveFilterPreview"></div>
        </div>
        <div class="modal-footer">
          <button class="primary-btn" onclick="v34ApplyAdvancedSearch()">تطبيق البحث المتقدم</button>
          <button onclick="v34ResetAdvancedSearch()">إعادة ضبط</button>
          <button onclick="v34CloseAdvancedSearch()">إغلاق</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m) v34CloseAdvancedSearch();});
  }
  window.v34OpenAdvancedSearch=function(){
    ensureAdvModal();
    document.getElementById('v34AdvScope').value=V34.filters.scope;
    document.getElementById('v34AdvStatus').value=V34.filters.status;
    document.getElementById('v34AdvDifficulty').value=V34.filters.difficulty;
    document.getElementById('v34AdvReview').value=V34.filters.review;
    document.getElementById('v34AdvancedSearchModal').classList.add('open');
    v34UpdateFilterPreview();
  };
  window.v34CloseAdvancedSearch=function(){
    const m=document.getElementById('v34AdvancedSearchModal');
    if(!m) return;
    const modal=m.querySelector('.modal');
    if(modal) modal.classList.add('v34-closing');
    setTimeout(()=>{m.classList.remove('open'); if(modal) modal.classList.remove('v34-closing');},160);
  };
  window.v34ApplyAdvancedSearch=function(){
    V34.filters={
      scope:document.getElementById('v34AdvScope')?.value||'all',
      status:document.getElementById('v34AdvStatus')?.value||'all',
      difficulty:document.getElementById('v34AdvDifficulty')?.value||'all',
      review:document.getElementById('v34AdvReview')?.value||'all'
    };
    updateAdvButtonState();
    if(typeof applyAllFilters==='function') applyAllFilters();
    v34CloseAdvancedSearch();
  };
  window.v34ResetAdvancedSearch=function(){
    V34.filters={scope:'all',status:'all',difficulty:'all',review:'all'};
    ['v34AdvScope','v34AdvStatus','v34AdvDifficulty','v34AdvReview'].forEach(id=>{const e=document.getElementById(id); if(e)e.value='all';});
    updateAdvButtonState();
    if(typeof applyAllFilters==='function') applyAllFilters();
    v34UpdateFilterPreview();
  };
  window.v34UpdateFilterPreview=function(){
    const p=document.getElementById('v34ActiveFilterPreview'); if(!p)return;
    const scope=document.getElementById('v34AdvScope')?.value||V34.filters.scope;
    const status=document.getElementById('v34AdvStatus')?.value||V34.filters.status;
    const difficulty=document.getElementById('v34AdvDifficulty')?.value||V34.filters.difficulty;
    const review=document.getElementById('v34AdvReview')?.value||V34.filters.review;
    p.innerHTML=`<span>النطاق: ${esc(scope)}</span><span>الحالة: ${esc(status)}</span><span>الصعوبة: ${esc(difficulty)}</span><span>المراجعة: ${esc(review)}</span>`;
  };

  function isAdvActive(){return Object.values(V34.filters).some(v=>v && v!=='all')}
  function updateAdvButtonState(){
    const btn=document.getElementById('v34AdvancedSearchBtn');
    if(btn) btn.classList.toggle('active',isAdvActive());
  }
  function ensureAdvButtonBesideSearch(){
    const input=document.getElementById('searchInput');
    if(!input || document.getElementById('v34AdvancedSearchBtn')) return;
    const btn=document.createElement('button');
    btn.id='v34AdvancedSearchBtn';
    btn.type='button';
    btn.className='v34-advanced-search-btn';
    btn.innerHTML='⚙ بحث متقدم';
    btn.onclick=v34OpenAdvancedSearch;
    input.insertAdjacentElement('afterend',btn);
  }

  /* ---------- Hide old embedded advanced panels ---------- */
  function hideOldAdvancedPanels(){
    ['v31AdvancedSearch','v32AdvancedSearch','v33AdvancedInline'].forEach(id=>{const e=document.getElementById(id); if(e) e.classList.add('v34-hidden-old-advanced');});
    document.querySelectorAll('.v33-hub-advanced').forEach(e=>e.classList.add('v34-hidden-old-advanced'));
  }

  /* ---------- Professional hub boundary alignment ---------- */
  function refineHubBoundaries(){
    const hub=document.getElementById('v33SearchHub');
    if(hub){hub.classList.add('v34-aligned-hub');}
    const toolbar=document.getElementById('groupDisplayToolbar');
    if(toolbar) toolbar.classList.add('v34-aligned-toolbar');
  }

  /* ---------- Filtering engine for modal advanced search ---------- */
  function passAdv(g,q){
    const f=V34.filters;
    if(f.status==='favorite'&&!bool(g.favorite))return false;
    if(f.status==='completed'&&!bool(g.completed))return false;
    if(f.status==='notCompleted'&&bool(g.completed))return false;
    if(f.status==='locked'&&!bool(g.locked))return false;
    if(f.difficulty!=='all' && t(g.difficulty)!==f.difficulty)return false;
    if(f.review==='today' && (!g.reviewDate || t(g.reviewDate)>todayISO()))return false;
    if(f.review==='none' && g.reviewDate)return false;
    if(!q)return true;
    const fields={
      title:t(g.title),
      notes:[stripHtml(g.note),stripHtml(g.unote)].join(' '),
      surah:typeof getTags==='function'?getTags(g).join(' '):'',
      ayahNo:(g.verses||[]).map(v=>v.ayah).join(' '),
      ayah:(g.verses||[]).map(v=>(v.parts||[]).map(p=>p.text).join(' ')).join(' ')
    };
    const hay=f.scope==='all'?Object.values(fields).join(' '):(fields[f.scope]||'');
    return t(hay).includes(q)||norm(hay).includes(norm(q));
  }
  if(typeof applyAllFilters==='function' && !window.__v34ApplyAllFilters){
    window.__v34ApplyAllFilters=applyAllFilters;
    window.applyAllFilters=function(){
      const q=document.getElementById('searchInput')?.value.trim()||'';
      const filtered=allGroups().filter(g=>{
        const surahMatch=!window.selectedSurahFilter || (typeof getTags==='function' && getTags(g).includes(window.selectedSurahFilter));
        return surahMatch && passAdv(g,q);
      });
      if(typeof render==='function') render(filtered);
      if(typeof updateSurahButtonAvailability==='function') updateSurahButtonAvailability(filtered);
      const c=document.getElementById('counter'); if(c)c.textContent='عدد النتائج: '+filtered.length;
      if(typeof v33UpdateHubStatus==='function') v33UpdateHubStatus();
    };
  }

  /* ---------- Ensure Quran top search remains top in Add/Edit windows ---------- */
  function ensureModalSearchTop(){
    const add=document.getElementById('v33AddTopSearch');
    const addBody=document.querySelector('#addModal .modal-body');
    if(add&&addBody&&addBody.firstElementChild!==add) addBody.insertBefore(add,addBody.firstElementChild);
    const edit=document.getElementById('v33EditTopSearch');
    const editBody=document.querySelector('#editModal .modal-body');
    if(edit&&editBody&&editBody.firstElementChild!==edit) editBody.insertBefore(edit,editBody.firstElementChild);
  }
  if(typeof openAddModal==='function' && !window.__v34OpenAdd){
    window.__v34OpenAdd=openAddModal;
    window.openAddModal=function(){const r=window.__v34OpenAdd.apply(this,arguments); setTimeout(ensureModalSearchTop,80); return r;};
  }
  if(typeof openEditGroup==='function' && !window.__v34OpenEdit){
    window.__v34OpenEdit=openEditGroup;
    window.openEditGroup=function(){const r=window.__v34OpenEdit.apply(this,arguments); setTimeout(ensureModalSearchTop,100); return r;};
  }

  function initV34(){
    ensureAdvModal();
    ensureAdvButtonBesideSearch();
    hideOldAdvancedPanels();
    refineHubBoundaries();
    ensureModalSearchTop();
    updateAdvButtonState();
  }
  window.addEventListener('DOMContentLoaded',()=>setTimeout(initV34,650));
  setTimeout(initV34,1200);
})();
/* END ADDON: V34 SEARCH UI FINALIZATION PACK */



/* =========================================================
   ADDON V36: RELEASE NOTE IN SETTINGS
========================================================= */
(function(){
 if(window.__V36_RELEASE_NOTES__) return; window.__V36_RELEASE_NOTES__=true;
 const FALLBACK_RELEASE_NOTE = "Below is the **complete feature list from V35**, organized by **window / screen / modal**.\n\nSource files used: **Mutashabihat\\_v35.zip**, containing updated `index.html`, `styles.css`, and `app.js`. \n\n***\n\n# 1. Main Page / Home Screen\n\n## Header Area\n\n*   Arabic RTL interface.\n*   App title: **متشابهات القرآن الكريم**.\n*   Subtitle describing core functions:\n    *   Search\n    *   Filter\n    *   Add\n    *   Edit\n    *   Delete\n    *   Auto-save\n    *   GitHub Sync \n\n## Legend Bar\n\nShows color meaning for ayah text types:\n\n*   **فريدة في القرآن** — Unique\n*   **اختلاف في اللفظ** — Difference\n*   **زيادة في الآية** — Addition\n*   **لفظ مشترك** — Shared wording \n\n## Storage / Sync Toolbar\n\n*   Storage status badge:\n    *   loading\n    *   saved\n    *   linked file\n    *   writing\n*   GitHub status badge:\n    *   not set\n    *   ready\n    *   syncing\n    *   synced\n    *   error\n*   Settings button to open app settings.\n*   Hidden theme/font badges retained in structure. \n\n***\n\n# 2. Main Search Window / Search Panel\n\n## Basic Search\n\n*   Main search input searches across:\n    *   group title\n    *   notes\n    *   unique/additional notes\n    *   surah names\n    *   ayah numbers\n    *   ayah labels\n    *   ayah text parts\n*   Clear search button.\n*   Result counter.\n*   Search highlighting in ayah text.\n*   Search works together with selected Surah filter. \n\n## Action Buttons in Search Panel\n\n*   **+ إضافة متشابه** — opens Add New Group window.\n*   **فتح الكل / طي الكل** — opens or collapses all groups / all Surah sections.\n*   **Export data.js** — exports current data.\n*   **دمج المجموعات** — opens Merge Groups window.\n*   **كشف التكرار** — opens Duplicate Detection window. \n\n## Advanced Search Modal\n\n*   Advanced search moved to a separate popup window.\n*   Search scope options:\n    *   all\n    *   title only\n    *   ayah text only\n    *   notes only\n    *   surah only\n    *   ayah number only\n*   Status filters:\n    *   all\n    *   favorite\n    *   completed\n    *   not completed\n    *   locked\n*   Difficulty filters:\n    *   سهل\n    *   متوسط\n    *   صعب\n    *   صعب جدًا\n*   Review filters:\n    *   today / overdue\n    *   without review date\n*   Shows active filter preview chips.\n*   Can apply filters or reset them. \n\n***\n\n# 3. Surah Filter Window / Surah Filter Panel\n\n## Compact Filter Bar\n\n*   Shows selected Surah status.\n*   “Only with results” toggle.\n*   Clear Surah filter button.\n*   Open / close Surah filter panel. \n\n## Surah Search\n\n*   Search Surah by:\n    *   name\n    *   number\n*   Range tabs:\n    *   all\n    *   1–30\n    *   31–60\n    *   61–90\n    *   91–114 \n\n## Surah Count Badges\n\n*   Each Surah button shows number of groups.\n*   Count badge changes style according to count level:\n    *   zero\n    *   low\n    *   medium\n    *   high\n*   Surah number displayed on the right side of Surah name in RTL layout.\n*   Top Surahs section shows most-used Surahs. \n\n## Selected Surah Chip\n\n*   Shows selected Surah.\n*   Shows group count for that Surah.\n*   Includes close button to clear selection. \n\n***\n\n# 4. Group Display / Sorting Toolbar\n\n## Display Modes\n\nGroups can be displayed as:\n\n*   Original order\n*   Sort by Surah\n*   Group by Surah\n*   Newest first\n*   Most verses first \n\n## Group by Surah Mode\n\n*   Groups are organized under Surah sections.\n*   Each Surah section has:\n    *   Surah title\n    *   group count\n    *   collapsible header\n*   Surah index bar appears for quick navigation.\n*   Collapsed Surah sections are saved in localStorage.\n*   Open all / collapse all works for Surah sections. \n\n***\n\n# 5. Group Card Window\n\nEach group card includes the following:\n\n## Group Header\n\n*   Group number on the right.\n*   Group title.\n*   Surah tags.\n*   Custom group header color.\n*   Ayah count badge beside title.\n*   Expand/collapse by clicking header. \n\n## Group Action Icons\n\n*   Favorite icon:\n    *   inactive / active state\n    *   active favorite shows star visual effect.\n*   Completed icon:\n    *   inactive / active state\n    *   completed group shows green tick and “مكتمل” label.\n*   Lock icon:\n    *   🔓 unlocked\n    *   🔒 locked\n    *   locked group has visual locked label.\n*   Edit icon.\n*   Compare icon for inline visual comparison. \n\n## Group Body\n\nDisplays all ayahs in the group with:\n\n*   Surah name.\n*   Ayah number badge.\n*   Optional label.\n*   Ayah text split into colored parts:\n    *   normal\n    *   shared\n    *   diff\n    *   addition\n    *   unique\n*   Unique ayah card styling.\n*   Notes section.\n*   Unique/additional notes section.\n*   Rich text notes are rendered as HTML if stored. \n\n***\n\n# 6. Add New Group Window\n\n## Basic Fields\n\n*   Group title.\n*   Surah dropdown.\n*   Ayah number dropdown.\n*   Text color type:\n    *   shared\n    *   diff\n    *   addition\n    *   unique\n    *   normal\n*   Label field.\n*   Ayah preview from `quran-reference.js`.\n*   Selected part field.\n*   Note field.\n*   Unique/additional note field. \n\n## Restored V35 Features in Add Window\n\n*   **Live ayah preview**:\n    *   shows selected ayah live.\n    *   applies selected text color type.\n*   **Color preview**:\n    *   group color picker.\n    *   visual preview of selected color.\n*   **Auto-generate group title**:\n    *   creates title based on selected draft ayahs and Surahs.\n*   **Smart Quran search from `quran-reference.js`**:\n    *   appears at top of Add window.\n    *   searches ayah text.\n    *   ignores tashkeel.\n    *   ignores hamza differences.\n    *   ignores common Arabic letter variations.\n    *   exact matches shown first.\n    *   normalized matches shown after. \n\n## Quran Search Result Actions in Add Window\n\nEach search result includes:\n\n*   checkbox\n*   Surah name\n*   Ayah number\n*   ayah text\n*   exact/normalized match label\n*   Add full ayah button\n*   Add selected text button\n\nBehavior:\n\n*   selecting checkbox adds the ayah automatically to draft.\n*   deselecting checkbox removes the ayah from draft.\n*   Add full ayah inserts full ayah.\n*   Add selected text inserts selected browser text if highlighted, otherwise full ayah. \n\n## Draft Ayahs\n\n*   Added ayahs appear in temporary draft box.\n*   Each draft ayah shows:\n    *   Surah\n    *   Ayah number\n    *   label if available\n    *   colored text\n*   Remove individual draft ayah.\n*   Clear all draft ayahs.\n*   Save group into page.\n*   Export data.js.\n*   Close window. \n\n***\n\n# 7. Modification / Edit Group Window\n\n## Basic Edit Features\n\n*   Edit group title.\n*   Edit Surah using dropdown.\n*   Edit Ayah number using dropdown.\n*   Edit label.\n*   Fill ayah text from `quran-reference.js`.\n*   Add new ayah.\n*   Delete ayah.\n*   Move ayah up/down.\n*   Sort ayahs by Mushaf order.\n*   Edit ayah text parts.\n*   Add text part.\n*   Delete text part.\n*   Move text part up/down.\n*   Insert text part above.\n*   Insert text part below.\n*   Save edit.\n*   Delete group.\n*   Export data.js. \n\n## Restored V35 Features in Edit Window\n\n*   **Live ayah preview** for each edited ayah.\n*   **Color preview**:\n    *   group color picker.\n    *   visual preview of selected group color.\n*   **Auto-generate group title** based on current ayahs.\n*   **Smart Quran search from `quran-reference.js`** at top of Edit window.\n*   Search ignores:\n    *   tashkeel\n    *   hamza differences\n    *   common Arabic letter variations.\n*   Search results ordered:\n    *   exact first\n    *   normalized after.\n*   Checkbox add/remove behavior works in Edit window also. \n\n## Rich Text Notes Editor\n\nFor both normal note and unique/additional note:\n\n*   Bold.\n*   Underline.\n*   Bullet list.\n*   Text color.\n*   Remove formatting.\n*   Contenteditable rich text field.\n*   HTML sanitization before save. \n\n## Lock Protection in Edit Window\n\n*   If group is locked:\n    *   save is blocked.\n    *   delete is blocked.\n    *   alert tells user to unlock first.\n*   Lock/unlock is controlled from group card icon. \n\n***\n\n# 8. Inline Compare Window / Compare Panel\n\n## Visual Inline Comparison\n\n*   Opens inside the group body, not as popup.\n*   Uses first ayah as base comparison.\n*   Shows each ayah line with Surah and Ayah number.\n*   Same/common words highlighted in green.\n*   Different words highlighted in red.\n*   Base ayah highlighted in blue.\n*   Clicking compare again removes the compare panel. \n\n***\n\n# 9. Merge Groups Window\n\n## Merge Function\n\n*   Opens from main search panel.\n*   Select primary group.\n*   Select group to merge into primary.\n*   Moves all ayahs from second group into primary group.\n*   Combines Surah list.\n*   Combines notes and unique/additional notes.\n*   Deletes merged group.\n*   Re-numbers all groups after merge.\n*   Saves and refreshes data.\n*   Blocks merge if either group is locked. \n\n***\n\n# 10. Duplicate Detection Window\n\n## Duplicate Detection\n\n*   Opens from main search panel.\n*   Detects duplicates based on:\n    *   normalized group title\n    *   same set of ayah references\n*   Shows duplicate groups in blocks.\n*   Each duplicate item shows:\n    *   group ID\n    *   group title\n    *   edit button\n*   Shows message if no duplicates found. \n\n***\n\n# 11. Settings Window\n\n## Theme Settings\n\nAvailable themes include:\n\n*   Quran Classic\n*   Apple Health Clean\n*   Bevel Night Metrics\n*   Serene Reader\n*   Memorization Contrast\n*   Manuscript Premium\n*   Professional Dashboard \n\n## Font Settings\n\nAvailable font presets include:\n\n*   Classic Quran — Amiri Quran + Cairo\n*   Modern Reader — Scheherazade + Tajawal\n*   Mobile Clear — Noto Naskh + Readex Pro\n*   Dashboard Pro — Noto Naskh + IBM Plex\n*   Manuscript Style — Amiri + Aref Ruqaa\n*   QPC Nastaleeq — KFGQPCNastaleeq-Regular\n*   Surah Display — surah-name-v4 \n\n## Font Preview\n\nSettings window includes preview for:\n\n*   title font\n*   Surah name font\n*   Quran ayah font\n*   notes font \n\n## GitHub Auto Sync Settings\n\nFields:\n\n*   token\n*   owner\n*   repo\n*   branch\n*   file path\n\nActions:\n\n*   save settings\n*   sync now \n\n## Storage / Backup Settings\n\nActions:\n\n*   Export data.js\n*   Link data.js file\n*   Reset localStorage \n\n***\n\n# 12. Export data.js Window\n\n## Export Function\n\n*   Creates `data.js` from current DATA.\n*   Supports direct download.\n*   Supports iOS Safari Web Share API where available.\n*   Fallback modal shows full `data.js` content.\n*   Fallback actions:\n    *   Copy data.js\n    *   Select All\n    *   Close \n\n***\n\n# 13. GitHub Settings Window\n\n## GitHub Modal\n\n*   Separate GitHub settings modal still exists.\n*   Fields:\n    *   GitHub Personal Access Token\n    *   GitHub Username\n    *   Repository Name\n    *   Branch\n    *   File path\n*   Actions:\n    *   save settings\n    *   sync now\n    *   close \n\n## GitHub Sync Behavior\n\n*   On save, app can auto-sync `data.js` to GitHub.\n*   On startup, if GitHub settings exist, app tries to fetch latest `data.js` from GitHub.\n*   If GitHub fetch fails, app falls back to localStorage. \n\n***\n\n# 14. Floating / Draggable Windows\n\nAll modal windows are enhanced to be draggable by their header, including:\n\n*   Add New Group\n*   Edit Group\n*   Settings\n*   Advanced Search\n*   Merge Groups\n*   Duplicate Detection\n*   GitHub Settings\n*   Export fallback modal\n\nBehavior:\n\n*   drag from modal header.\n*   works with mouse and touch.\n*   modal position is constrained inside viewport.\n*   includes open/close animation. \n\n***\n\n# 15. Floating Top Button\n\n*   Fixed button at bottom-right.\n*   Scrolls smoothly to top.\n*   Styled according to current theme.\n*   Responsive size on mobile. \n\n***\n\n# 16. Storage / Persistence Features\n\n## Local Storage\n\n*   DATA saved automatically to localStorage.\n*   On startup, app loads saved localStorage data if available.\n*   Reset option removes saved localStorage and reloads original `data.js`. \n\n## File System Access API\n\n*   Allows linking local `data.js` file in supported browsers.\n*   Auto-writes changes directly to linked file.\n*   Mainly for PC Chrome-supported environments. \n\n***\n\n# 17. Mobile / Responsive Features\n\n*   RTL layout maintained.\n*   Modal windows adjust to mobile height.\n*   Search panel wraps controls.\n*   Surah grid becomes mobile-friendly.\n*   Group side icons reduce size.\n*   Edit part rows become single-column.\n*   Floating top button becomes smaller.\n*   Quran search result area has mobile max height.\n*   Toolbar buttons expand on small screens. \n\n***\n\n# 18. Important File Structure Note\n\nV35 package contains:\n\n*   `index.html`\n*   `styles.css`\n*   `app.js`\n\nBut the app still depends on external project files:\n\n*   `data.js`\n*   `quran-reference.js`\n*   optional `fonts/` folder for custom fonts\n\nThese are referenced by `index.html` and must remain in the same folder when running the app. \n";
 function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
 function md(txt){let html='',list=false;function close(){if(list){html+='</ul>';list=false}};String(txt||'').split(/\r?\n/).forEach(line=>{const s=line.trim();if(!s){close();html+='<div class="v36-rn-space"></div>';return}if(s.startsWith('### ')){close();html+='<h4>'+esc(s.slice(4))+'</h4>';return}if(s.startsWith('## ')){close();html+='<h3>'+esc(s.slice(3))+'</h3>';return}if(s.startsWith('# ')){close();html+='<h2>'+esc(s.slice(2))+'</h2>';return}if(s.startsWith('- ')){if(!list){html+='<ul>';list=true}html+='<li>'+esc(s.slice(2))+'</li>';return}close();html+='<p>'+esc(s)+'</p>'});close();return html.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}
 function ensureModal(){if(document.getElementById('v36ReleaseNoteModal'))return;const m=document.createElement('div');m.id='v36ReleaseNoteModal';m.className='modal-backdrop';m.innerHTML=`<div class="modal edit-modal v36-release-note-modal"><div class="modal-header"><h2>📋 Release Note / ملاحظات الإصدار</h2><button class="close-btn" onclick="v36CloseReleaseNotes()">×</button></div><div class="modal-body"><div class="v36-release-note-toolbar"><span>Release Note</span><button onclick="v36CopyReleaseNotes()">Copy</button></div><div id="v36ReleaseNoteContent" class="v36-release-note-content"></div><textarea id="v36ReleaseNoteRaw" style="display:none"></textarea></div><div class="modal-footer"><button class="primary-btn" onclick="v36CloseReleaseNotes()">إغلاق</button></div></div>`;document.body.appendChild(m)}
 async function loadNote(){try{const r=await fetch('release note.txt?v=mutashabihat-v37-20260512-01',{cache:'no-store'});if(r.ok){const x=await r.text();if(x.trim())return x}}catch(e){}return FALLBACK_RELEASE_NOTE}
 window.v36OpenReleaseNotes=async function(){ensureModal();const m=document.getElementById('v36ReleaseNoteModal'),c=document.getElementById('v36ReleaseNoteContent'),raw=document.getElementById('v36ReleaseNoteRaw');m.classList.add('open');c.innerHTML='جاري فتح ملاحظات الإصدار...';const txt=await loadNote();raw.value=txt;c.innerHTML=md(txt)};
 window.v36CloseReleaseNotes=function(){document.getElementById('v36ReleaseNoteModal')?.classList.remove('open')};
 window.v36CopyReleaseNotes=function(){const r=document.getElementById('v36ReleaseNoteRaw');if(!r)return;r.style.display='block';r.select();document.execCommand('copy');r.style.display='none';alert('تم نسخ Release Note')};
 function inject(){const b=document.querySelector('#appSettingsModal .modal-body');if(!b||document.getElementById('v36ReleaseNoteSettingsBtn'))return;const s=document.createElement('div');s.className='settings-section v36-release-note-settings-section';s.innerHTML='<h3>📋 Release Note</h3><p class="v36-settings-note">فتح القائمة الكاملة لملاحظات الإصدار والميزات الحالية.</p><button id="v36ReleaseNoteSettingsBtn" class="v36-release-note-btn" onclick="v36OpenReleaseNotes()">📋 عرض Release Note</button>';b.insertBefore(s,b.firstChild)}
 const old=window.openAppSettings;window.openAppSettings=function(){const r=old?old.apply(this,arguments):undefined;setTimeout(inject,80);return r};window.addEventListener('DOMContentLoaded',()=>setTimeout(inject,1200));setTimeout(inject,1600);
})();
/* END ADDON V36 */


/* =========================================================
   ADDON V37: EDIT/MODIFICATION SEARCH COUNTS + HIGHLIGHT
   - Shows exact and close/normalized counts while typing
   - Highlights matched words inside ayah search results
   - Removes the old list/handle icon from group cards by CSS
   Version: mutashabihat-v37-20260512-01
========================================================= */
(function(){
 if(window.__V37_EDIT_SEARCH__) return; window.__V37_EDIT_SEARCH__=true;
 function t(v){return v==null?'':String(v)}
 function esc(v){return t(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
 function norm(v){return t(v).replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'').replace(/[إأآٱا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'').replace(/\s+/g,' ').trim()}
 function names(){return typeof SURAH_NAMES!='undefined'?SURAH_NAMES:(typeof getDefaultSurahNames==='function'?getDefaultSurahNames():{})}
 function allAyahs(){const out=[],ns=names();if(typeof getSurahAyahs!=='function')return out;Object.keys(ns).forEach(no=>(getSurahAyahs(no)||[]).forEach(a=>out.push({surahNo:+no,surah:a.surah||ns[no],ayahNo:a.ayahNo,text:a.text||''})));return out}
 function regexEscape(s){return t(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
 function highlight(text,q,exact){
   text=t(text); q=t(q).trim(); if(!q) return esc(text);
   if(exact){try{return esc(text).replace(new RegExp(regexEscape(esc(q)),'g'),'<mark class="v37-exact-mark">'+esc(q)+'</mark>')}catch(e){}}
   const nq=norm(q);
   return text.split(/(\s+)/).map(w=>{if(/^\s+$/.test(w))return esc(w);const nw=norm(w);return (nw.includes(nq)||nq.includes(nw))?'<mark class="v37-close-mark">'+esc(w)+'</mark>':esc(w)}).join('')
 }
 function search(q){const exact=t(q).trim(),nq=norm(q);if(!exact)return[];return allAyahs().map(a=>{const ex=t(a.text).includes(exact),cl=!ex&&norm(a.text).includes(nq);return {...a,exact:ex,close:cl}}).filter(a=>a.exact||a.close).sort((a,b)=>(b.exact-a.exact)||a.surahNo-b.surahNo||Number(a.ayahNo)-Number(b.ayahNo)).slice(0,100)}
 function addVerse(mode,no,ay,selected){const a=typeof getAyah==='function'?getAyah(no,ay):null;if(!a)return;const s=selected&&window.getSelection?window.getSelection().toString().trim():'';const v={surah:a.surah,ayah:a.ayahNo,label:'',parts:[{type:'normal',text:s||a.text}]};if(mode==='edit'){const vs=typeof collectEditVersesFromDOM==='function'?collectEditVersesFromDOM():[];vs.push(v);if(typeof renderEditVerses==='function')renderEditVerses(vs)}else{if(typeof draftVerses!=='undefined'){draftVerses.push(v);if(typeof renderDraftVerses==='function')renderDraftVerses()}}}
 function removeVerse(mode,no,ay){const a=typeof getAyah==='function'?getAyah(no,ay):null;if(!a)return;if(mode==='edit'&&typeof collectEditVersesFromDOM==='function'){const vs=collectEditVersesFromDOM().filter(v=>!(t(v.surah)===t(a.surah)&&Number(v.ayah)===Number(a.ayahNo)));if(typeof renderEditVerses==='function')renderEditVerses(vs)}else if(typeof draftVerses!=='undefined'){const i=draftVerses.findIndex(v=>t(v.surah)===t(a.surah)&&Number(v.ayah)===Number(a.ayahNo));if(i>-1)draftVerses.splice(i,1);if(typeof renderDraftVerses==='function')renderDraftVerses()}}
 window.v37ToggleSearchAyah=function(mode,chk,no,ay){if(chk.checked)addVerse(mode,no,ay,false);else removeVerse(mode,no,ay)}
 window.v37AddSearchAyah=function(mode,no,ay,selected){addVerse(mode,no,ay,selected)}
 window.v37RunEditSearch=function(value){
   const q=t(value).trim(),res=document.getElementById('v37EditSearchResults'),exactEl=document.getElementById('v37ExactCount'),closeEl=document.getElementById('v37CloseCount'),totalEl=document.getElementById('v37TotalCount'); if(!res)return;
   const rows=search(q), exactCount=rows.filter(r=>r.exact).length, closeCount=rows.filter(r=>r.close).length;
   if(exactEl)exactEl.textContent=exactCount; if(closeEl)closeEl.textContent=closeCount; if(totalEl)totalEl.textContent=rows.length;
   res.innerHTML = q ? (rows.length?rows.map(a=>`<div class="v37-result-row ${a.exact?'is-exact':'is-close'}"><label class="v37-check"><input type="checkbox" onchange="v37ToggleSearchAyah('edit',this,${a.surahNo},${a.ayahNo})"> إضافة/إزالة</label><div class="v37-result-meta"><b>${esc(a.surah)}</b><span>${esc(a.ayahNo)}</span><em>${a.exact?'مطابق حرفيًا':'قريب / بدون تشكيل وهمزات'}</em></div><div class="v37-result-text">${highlight(a.text,q,a.exact)}</div><div class="v37-result-actions"><button type="button" onclick="v37AddSearchAyah('edit',${a.surahNo},${a.ayahNo},false)">Add full ayah</button><button type="button" onclick="v37AddSearchAyah('edit',${a.surahNo},${a.ayahNo},true)">Add selected text</button></div></div>`).join(''):'<div class="v37-no-results">لا توجد نتائج</div>') : '<div class="v37-search-placeholder">اكتب كلمة لعرض النتائج وعدد المطابقات.</div>';
 }
 function injectEditSearch(){
   const body=document.querySelector('#editModal .modal-body'); if(!body)return;
   const old=document.getElementById('v35Search_edit')||document.getElementById('v35EditQuranSearch')||document.getElementById('v33EditTopSearch'); if(old)old.style.display='none';
   if(document.getElementById('v37EditSearchBox'))return;
   const box=document.createElement('div'); box.id='v37EditSearchBox'; box.className='v37-edit-search-box';
   box.innerHTML=`<div class="v37-search-head"><div><b>بحث في quran-reference.js</b><div class="v37-search-sub">يعرض عدد المطابقات الحرفية والقريبة ويظلل الكلمة داخل الآية.</div></div><div class="v37-counts"><span>Exact: <b id="v37ExactCount">0</b></span><span>Close: <b id="v37CloseCount">0</b></span><span>Total: <b id="v37TotalCount">0</b></span></div></div><input id="v37EditSearchInput" class="full-input" placeholder="اكتب كلمة للبحث داخل القرآن..." oninput="v37RunEditSearch(this.value)"><div id="v37EditSearchResults" class="v37-results"><div class="v37-search-placeholder">اكتب كلمة لعرض النتائج وعدد المطابقات.</div></div>`;
   body.insertBefore(box,body.firstChild);
 }
 const oldOpen=window.openEditGroup; window.openEditGroup=function(){const r=oldOpen?oldOpen.apply(this,arguments):undefined;setTimeout(injectEditSearch,120);return r};
 window.addEventListener('DOMContentLoaded',()=>setTimeout(injectEditSearch,1500));setTimeout(injectEditSearch,1800);
})();
/* END ADDON V37 */


/* =========================================================
   ADDON V38: FULL RESTORE OF FEATURES REMOVED AFTER V34
   - Live ayah preview in Add + Modification
   - Group color preview in Add + Modification
   - Visual inline compare
   - Improved lock icon/protection
   - Floating / draggable windows
   - Merge Groups
   - Duplicate Detection
   - Auto-generate Group Title
   - Add + Modification smart search from quran-reference.js
   Version: mutashabihat-v38-restore-v34-features-20260512-01
========================================================= */
(function(){
  if (window.__V38_RESTORE_V34_FEATURES__) return;
  window.__V38_RESTORE_V34_FEATURES__ = true;

  const V38_COLORS = ['#1A4A7E','#0D47A1','#2563EB','#007AFF','#1B5E30','#34C759','#4CAF50','#C9A84C','#B45309','#FF9500','#B00000','#E60000','#FF3B30','#6D28D9','#7C3AED','#0F766E','#32D3C8','#17212B','#3A4A60','#8A5C00'];
  const TYPE_OPTIONS = ['normal','shared','diff','addition','unique'];

  function text(v){ return v === undefined || v === null ? '' : String(v); }
  function esc(v){ return text(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function bool(v){ return v === true || v === 'true' || v === 1 || v === '1'; }
  function data(){ return (typeof DATA !== 'undefined' && Array.isArray(DATA)) ? DATA : []; }
  function saveRefresh(){
    if (typeof masterSave === 'function') masterSave();
    if (typeof buildSurahFilterBar === 'function') buildSurahFilterBar();
    if (typeof applyAllFilters === 'function') applyAllFilters();
    else if (typeof render === 'function') render(data());
  }
  function normalizeArabic(v){
    return text(v)
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
      .replace(/[إأآٱا]/g,'ا')
      .replace(/ى/g,'ي')
      .replace(/ة/g,'ه')
      .replace(/ؤ/g,'و')
      .replace(/ئ/g,'ي')
      .replace(/ـ/g,'')
      .replace(/\s+/g,' ')
      .trim();
  }
  function surahNames(){
    if (typeof SURAH_NAMES !== 'undefined') return SURAH_NAMES;
    if (typeof getDefaultSurahNames === 'function') return getDefaultSurahNames();
    return {};
  }
  function allAyahsFromReference(){
    const out = [];
    const names = surahNames();
    if (typeof getSurahAyahs !== 'function') return out;
    Object.keys(names).forEach(function(no){
      const list = getSurahAyahs(no) || [];
      list.forEach(function(a){
        out.push({ surahNo:Number(no), surah:a.surah || names[no], ayahNo:a.ayahNo, text:a.text || '' });
      });
    });
    return out;
  }
  function selectedTextFallback(defaultText){
    const s = (window.getSelection && window.getSelection().toString().trim()) || '';
    return s || defaultText;
  }
  function buildVerseFromRef(surahNo, ayahNo, customText){
    const a = (typeof getAyah === 'function') ? getAyah(surahNo, ayahNo) : null;
    if (!a) return null;
    return { surah:a.surah, ayah:a.ayahNo, label:'', parts:[{ type:'normal', text:customText || a.text }] };
  }
  function getGroupById(id){ return data().find(function(g){ return Number(g.id) === Number(id); }) || null; }

  /* ---------- Floating / Draggable Windows ---------- */
  function makeModalDraggable(modal){
    if (!modal || modal.dataset.v38Draggable === '1') return;
    const header = modal.querySelector('.modal-header');
    if (!header) return;
    modal.dataset.v38Draggable = '1';
    header.classList.add('v38-drag-handle');
    let dragging=false, sx=0, sy=0, sl=0, st=0;
    function pt(e){ const p = e.touches ? e.touches[0] : e; return {x:p.clientX, y:p.clientY}; }
    function down(e){
      if (e.target.closest('button,input,select,textarea,[contenteditable="true"]')) return;
      const p=pt(e), r=modal.getBoundingClientRect();
      dragging=true; sx=p.x; sy=p.y; sl=r.left; st=r.top;
      modal.classList.add('v38-floating-modal');
      modal.style.left=sl+'px'; modal.style.top=st+'px'; modal.style.right='auto'; modal.style.margin='0'; modal.style.transform='none';
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      document.addEventListener('touchmove', move, {passive:false});
      document.addEventListener('touchend', up);
    }
    function move(e){
      if (!dragging) return;
      if (e.cancelable) e.preventDefault();
      const p=pt(e), r=modal.getBoundingClientRect();
      let left=sl+(p.x-sx), top=st+(p.y-sy);
      left=Math.max(8, Math.min(left, window.innerWidth-r.width-8));
      top=Math.max(8, Math.min(top, window.innerHeight-60));
      modal.style.left=left+'px'; modal.style.top=top+'px';
    }
    function up(){
      dragging=false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    }
    header.addEventListener('mousedown', down);
    header.addEventListener('touchstart', down, {passive:true});
  }
  function makeAllModalsDraggable(){ document.querySelectorAll('.modal').forEach(makeModalDraggable); }
  new MutationObserver(makeAllModalsDraggable).observe(document.body, {childList:true, subtree:true});

  /* ---------- Quran Reference Smart Search ---------- */
  function searchReference(q){
    const raw = text(q).trim();
    const nq = normalizeArabic(raw);
    if (!raw) return [];
    return allAyahsFromReference().map(function(a){
      const exact = text(a.text).includes(raw);
      const normalized = !exact && normalizeArabic(a.text).includes(nq);
      return Object.assign({}, a, { exact:exact, normalized:normalized });
    }).filter(function(a){ return a.exact || a.normalized; })
      .sort(function(a,b){
        if (a.exact !== b.exact) return a.exact ? -1 : 1;
        return (a.surahNo-b.surahNo) || (Number(a.ayahNo)-Number(b.ayahNo));
      }).slice(0,120);
  }
  function highlightSearch(textValue, query, isExact){
    const source = text(textValue);
    const q = text(query).trim();
    if (!q) return esc(source);
    if (isExact) {
      const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try { return esc(source).replace(new RegExp(safeQ, 'g'), '<mark class="v38-exact-mark">'+esc(q)+'</mark>'); } catch(e) {}
    }
    const nq = normalizeArabic(q);
    return source.split(/(\s+)/).map(function(w){
      if (/^\s+$/.test(w)) return esc(w);
      const nw = normalizeArabic(w);
      return (nw && nq && (nw.includes(nq) || nq.includes(nw))) ? '<mark class="v38-close-mark">'+esc(w)+'</mark>' : esc(w);
    }).join('');
  }
  function insertSearchBox(mode){
    const body = document.querySelector(mode === 'add' ? '#addModal .modal-body' : '#editModal .modal-body');
    if (!body) return;
    const id = 'v38SearchBox_' + mode;
    if (document.getElementById(id)) return;
    ['v33AddTopSearch','v33EditTopSearch','v35Search_add','v35Search_edit','v35AddQuranSearch','v35EditQuranSearch','v37EditSearchBox'].forEach(function(oldId){
      const old = document.getElementById(oldId);
      if (old && ((mode === 'add' && oldId.toLowerCase().includes('add')) || (mode === 'edit' && oldId.toLowerCase().includes('edit')))) old.style.display='none';
    });
    const box=document.createElement('div');
    box.id=id;
    box.className='v38-search-box';
    box.innerHTML = '<div class="v38-search-head"><div><b>بحث في quran-reference.js</b><div class="v38-search-sub">يتجاهل التشكيل والهمزات واختلافات الحروف. النتائج المطابقة حرفيًا أولًا ثم القريبة.</div></div><div class="v38-counts"><span>Exact: <b id="v38Exact_'+mode+'">0</b></span><span>Close: <b id="v38Close_'+mode+'">0</b></span><span>Total: <b id="v38Total_'+mode+'">0</b></span></div></div><input class="full-input" placeholder="اكتب كلمة أو جزء من آية..." oninput="v38RunSearch(\''+mode+'\', this.value)"><div id="v38Results_'+mode+'" class="v38-results"><div class="v38-placeholder">اكتب كلمة لعرض النتائج.</div></div>';
    body.insertBefore(box, body.firstChild);
  }
  window.v38RunSearch=function(mode, q){
    const rows = searchReference(q);
    const results = document.getElementById('v38Results_'+mode);
    const exact = rows.filter(function(r){ return r.exact; }).length;
    const close = rows.filter(function(r){ return r.normalized; }).length;
    const exactEl = document.getElementById('v38Exact_'+mode);
    const closeEl = document.getElementById('v38Close_'+mode);
    const totalEl = document.getElementById('v38Total_'+mode);
    if (exactEl) exactEl.textContent=exact;
    if (closeEl) closeEl.textContent=close;
    if (totalEl) totalEl.textContent=rows.length;
    if (!results) return;
    if (!text(q).trim()) { results.innerHTML='<div class="v38-placeholder">اكتب كلمة لعرض النتائج.</div>'; return; }
    results.innerHTML = rows.length ? rows.map(function(a){
      return '<div class="v38-result-row '+(a.exact?'is-exact':'is-close')+'"><label class="v38-check"><input type="checkbox" onchange="v38ToggleSearchAyah(\''+mode+'\', this, '+a.surahNo+', '+a.ayahNo+')"> إضافة/إزالة</label><div class="v38-result-meta"><b>'+esc(a.surah)+'</b><span>'+esc(a.ayahNo)+'</span><em>'+(a.exact?'مطابق حرفيًا':'قريب / بدون تشكيل وهمزات')+'</em></div><div class="v38-result-text">'+highlightSearch(a.text, q, a.exact)+'</div><div class="v38-result-actions"><button type="button" onclick="v38AddSearchAyah(\''+mode+'\', '+a.surahNo+', '+a.ayahNo+', false)">Add full ayah</button><button type="button" onclick="v38AddSearchAyah(\''+mode+'\', '+a.surahNo+', '+a.ayahNo+', true)">Add selected text</button></div></div>';
    }).join('') : '<div class="v38-no-results">لا توجد نتائج</div>';
  };
  window.v38AddSearchAyah=function(mode, surahNo, ayahNo, selectedOnly){
    const a = (typeof getAyah === 'function') ? getAyah(surahNo, ayahNo) : null;
    if (!a) return;
    const verse = buildVerseFromRef(surahNo, ayahNo, selectedOnly ? selectedTextFallback(a.text) : a.text);
    if (!verse) return;
    if (mode === 'add') {
      draftVerses.push(verse);
      if (typeof renderDraftVerses === 'function') renderDraftVerses();
      v38AutoTitleAdd();
    } else {
      const verses = (typeof collectEditVersesFromDOM === 'function') ? collectEditVersesFromDOM() : [];
      verses.push(verse);
      if (typeof renderEditVerses === 'function') renderEditVerses(verses);
      v38AutoTitleEdit();
    }
  };
  window.v38ToggleSearchAyah=function(mode, checkbox, surahNo, ayahNo){
    if (checkbox.checked) { v38AddSearchAyah(mode, surahNo, ayahNo, false); return; }
    const a = (typeof getAyah === 'function') ? getAyah(surahNo, ayahNo) : null;
    if (!a) return;
    if (mode === 'add') {
      const idx = draftVerses.findIndex(function(v){ return text(v.surah)===text(a.surah) && Number(v.ayah)===Number(a.ayahNo); });
      if (idx > -1) draftVerses.splice(idx,1);
      if (typeof renderDraftVerses === 'function') renderDraftVerses();
    } else {
      const verses = ((typeof collectEditVersesFromDOM === 'function') ? collectEditVersesFromDOM() : []).filter(function(v){ return !(text(v.surah)===text(a.surah) && Number(v.ayah)===Number(a.ayahNo)); });
      if (typeof renderEditVerses === 'function') renderEditVerses(verses);
    }
  };

  /* ---------- Add Group Enhancements ---------- */
  function addColorRow(id, value){
    const color = value || V38_COLORS[data().length % V38_COLORS.length];
    return '<div class="v38-color-row"><label>لون المجموعة</label><input id="'+id+'" class="v38-color-input" type="color" value="'+esc(color)+'" oninput="v38ColorPreview(\''+id+'\')"><span id="'+id+'Preview" class="v38-color-preview" style="background:'+esc(color)+'">معاينة اللون</span></div>';
  }
  window.v38ColorPreview=function(id){
    const inp=document.getElementById(id), p=document.getElementById(id+'Preview');
    if (inp && p) { p.style.background=inp.value; p.textContent='معاينة اللون '+inp.value; }
  };
  window.v38AutoTitleAdd=function(){
    const el=document.getElementById('newTitle'); if (!el) return;
    const surahs=[...new Set(draftVerses.map(function(v){ return v.surah; }).filter(Boolean))];
    const ayahs=draftVerses.map(function(v){ return v.ayah; }).filter(Boolean);
    el.value = draftVerses.length ? 'متشابه '+surahs.join(' / ')+' — '+ayahs.join('، ') : 'متشابه جديد';
  };
  window.v38LiveAddPreview=function(){
    const preview=document.getElementById('ayahPreview'), box=document.getElementById('v38AddLivePreview'), type=document.getElementById('newType')?.value || 'normal';
    const selected=document.getElementById('selectedPart')?.value.trim();
    if (preview && box) box.innerHTML='<b>معاينة مباشرة:</b><div class="verse-text"><span class="'+esc(type)+'">'+esc(selected || preview.value)+'</span></div>';
  };
  function enhanceAdd(){
    const title=document.getElementById('newTitle'); if (!title) return;
    if (!document.getElementById('v38AddAutoTitle')) title.insertAdjacentHTML('afterend','<button id="v38AddAutoTitle" type="button" class="v38-mini-btn" onclick="v38AutoTitleAdd()">توليد عنوان تلقائي</button>'+addColorRow('newColor', V38_COLORS[data().length % V38_COLORS.length]));
    const preview=document.getElementById('ayahPreview');
    if (preview && !document.getElementById('v38AddLivePreview')) preview.insertAdjacentHTML('afterend','<div id="v38AddLivePreview" class="v38-live-preview"></div>');
    insertSearchBox('add');
    v38LiveAddPreview();
  }
  const baseOpenAdd = window.openAddModal;
  window.openAddModal=function(){ const r=baseOpenAdd ? baseOpenAdd.apply(this,arguments) : undefined; setTimeout(enhanceAdd,80); return r; };
  const basePreview = window.previewSelectedAyah;
  window.previewSelectedAyah=function(){ if (basePreview) basePreview.apply(this,arguments); setTimeout(v38LiveAddPreview,20); };
  document.addEventListener('input', function(e){ if (e.target && (e.target.id==='selectedPart' || e.target.id==='newType')) setTimeout(v38LiveAddPreview,20); });
  const baseCreate = window.createNewGroup;
  window.createNewGroup=function(){
    const c=document.getElementById('newColor')?.value;
    const before=data().length;
    const r=baseCreate ? baseCreate.apply(this,arguments) : undefined;
    if (c && data().length > before) { const g=data()[data().length-1]; g.color=c; g.headerColor=c; saveRefresh(); }
    return r;
  };

  /* ---------- Edit / Modification Enhancements ---------- */
  function editColor(){ const g=data()[editGroupIndex] || {}; return g.color || g.headerColor || '#1A4A7E'; }
  window.v38AutoTitleEdit=function(){
    const el=document.getElementById('editTitle'); if (!el || typeof collectEditVersesFromDOM !== 'function') return;
    const verses=collectEditVersesFromDOM();
    const surahs=[...new Set(verses.map(function(v){return v.surah;}).filter(Boolean))];
    const ayahs=verses.map(function(v){return v.ayah;}).filter(Boolean);
    el.value = verses.length ? 'متشابه '+surahs.join(' / ')+' — '+ayahs.join('، ') : 'متشابه جديد';
  };
  function renderEditLivePreview(){
    if (typeof collectEditVersesFromDOM !== 'function') return;
    const verses=collectEditVersesFromDOM();
    document.querySelectorAll('#editVersesBox .edit-verse-card').forEach(function(card,i){
      if (!card.querySelector('.v38-edit-live-preview')) card.insertAdjacentHTML('beforeend','<div class="v38-edit-live-preview"></div>');
      const box=card.querySelector('.v38-edit-live-preview');
      const v=verses[i];
      if (box && v) box.innerHTML='<b>معاينة مباشرة:</b><div class="verse-text">'+(v.parts||[]).map(function(p){ return '<span class="'+esc(p.type||'normal')+'">'+esc(p.text)+'</span>'; }).join(' ')+'</div>';
    });
  }
  function enhanceEdit(){
    const title=document.getElementById('editTitle'); if (!title) return;
    if (!document.getElementById('v38EditAutoTitle')) title.insertAdjacentHTML('afterend','<button id="v38EditAutoTitle" type="button" class="v38-mini-btn" onclick="v38AutoTitleEdit()">توليد عنوان تلقائي</button>'+addColorRow('editColor', editColor()));
    insertSearchBox('edit');
    renderEditLivePreview();
  }
  const baseOpenEdit=window.openEditGroup;
  window.openEditGroup=function(){ const r=baseOpenEdit ? baseOpenEdit.apply(this,arguments) : undefined; setTimeout(enhanceEdit,120); return r; };
  const baseRenderEdit=window.renderEditVerses;
  window.renderEditVerses=function(){ const r=baseRenderEdit ? baseRenderEdit.apply(this,arguments) : undefined; setTimeout(renderEditLivePreview,30); return r; };
  document.addEventListener('input', function(e){ if (e.target && (e.target.classList.contains('edit-part-text') || e.target.classList.contains('edit-part-type'))) setTimeout(renderEditLivePreview,20); });
  const baseSaveEdit=window.saveEditGroup;
  window.saveEditGroup=function(){
    const g=data()[editGroupIndex];
    if (g && bool(g.locked)) { alert('هذه المجموعة مقفلة. افتح القفل قبل التعديل.'); return; }
    const color=document.getElementById('editColor')?.value;
    const idx=editGroupIndex;
    const r=baseSaveEdit ? baseSaveEdit.apply(this,arguments) : undefined;
    if (color && data()[idx]) { data()[idx].color=color; data()[idx].headerColor=color; saveRefresh(); }
    return r;
  };
  const baseDeleteEdit=window.deleteEditGroup;
  window.deleteEditGroup=function(){
    const g=data()[editGroupIndex];
    if (g && bool(g.locked)) { alert('هذه المجموعة مقفلة. افتح القفل قبل الحذف.'); return; }
    return baseDeleteEdit ? baseDeleteEdit.apply(this,arguments) : undefined;
  };

  /* ---------- Lock + Compare + Group Card Overrides ---------- */
  window.v38ToggleLock=function(groupId){ const g=getGroupById(groupId); if (!g) return; g.locked=!bool(g.locked); saveRefresh(); };
  function verseText(v){ return (v.parts||[]).map(function(p){return text(p.text);}).join(' '); }
  window.v38CompareGroupInline=function(groupId){
    const card=document.querySelector('.group[data-group-id="'+groupId+'"]');
    const g=getGroupById(groupId);
    if (!card || !g) return;
    const old=card.querySelector('.v38-compare-panel');
    if (old) { old.remove(); return; }
    const verses=g.verses||[];
    const base=verseText(verses[0]||{});
    const baseSet=new Set(normalizeArabic(base).split(/\s+/).filter(Boolean));
    const panel=document.createElement('div');
    panel.className='v38-compare-panel';
    panel.innerHTML='<div class="v38-compare-title">مقارنة مرئية داخلية <span class="v38-same">مشترك</span><span class="v38-diff">مختلف</span></div>' + verses.map(function(v,i){
      const txt=verseText(v);
      const body = i===0 ? '<span class="v38-base">'+esc(txt)+'</span>' : txt.split(/(\s+)/).map(function(w){
        if (/^\s+$/.test(w)) return esc(w);
        return baseSet.has(normalizeArabic(w)) ? '<span class="v38-same">'+esc(w)+'</span>' : '<span class="v38-diff">'+esc(w)+'</span>';
      }).join('');
      return '<div class="v38-compare-line"><b>'+esc(v.surah)+' '+esc(v.ayah)+'</b><div>'+body+'</div></div>';
    }).join('');
    (card.querySelector('.group-body') || card).appendChild(panel);
    card.classList.add('open');
  };
  const baseGbGroupCard = window.gbGroupCard;
  if (typeof baseGbGroupCard === 'function') {
    window.gbGroupCard=function(g){
      let html=baseGbGroupCard(g);
      html=html.replace('<article class="group', '<article class="group'+(bool(g.locked)?' is-locked':'') );
      const lock='<button class="group-status-btn lock-btn '+(bool(g.locked)?'active':'')+'" type="button" onclick="event.stopPropagation(); v38ToggleLock('+Number(g.id)+')" title="'+(bool(g.locked)?'مقفلة - اضغط لفتح القفل':'مفتوحة - اضغط للقفل')+'">'+(bool(g.locked)?'🔒':'🔓')+'</button>';
      const compare='<button class="group-status-btn compare-btn" type="button" onclick="event.stopPropagation(); v38CompareGroupInline('+Number(g.id)+')" title="مقارنة مرئية">≋</button>';
      html=html.replace('<div class="group-side">','<div class="group-side">'+lock+compare);
      return html;
    };
  }

  /* ---------- Merge Groups + Duplicate Detection ---------- */
  function groupOptions(){ return data().map(function(g){ return '<option value="'+Number(g.id)+'">'+esc(g.id)+' - '+esc(g.title)+'</option>'; }).join(''); }
  window.v38OpenMergeModal=function(){
    let m=document.getElementById('v38MergeModal');
    if (!m) { m=document.createElement('div'); m.id='v38MergeModal'; m.className='modal-backdrop'; document.body.appendChild(m); }
    const opts=groupOptions();
    m.innerHTML='<div class="modal"><div class="modal-header"><h2>دمج المجموعات</h2><button class="close-btn" onclick="v38CloseMergeModal()">×</button></div><div class="modal-body"><p class="v38-hint">اختر المجموعة الأساسية ثم المجموعة التي سيتم دمجها داخلها.</p><label>المجموعة الأساسية</label><select id="v38MergeA" class="full-input">'+opts+'</select><label>المجموعة المراد دمجها</label><select id="v38MergeB" class="full-input">'+opts+'</select></div><div class="modal-footer"><button class="primary-btn" onclick="v38DoMergeGroups()">دمج الآن</button><button onclick="v38CloseMergeModal()">إغلاق</button></div></div>';
    m.classList.add('open'); setTimeout(makeAllModalsDraggable,20);
  };
  window.v38CloseMergeModal=function(){ document.getElementById('v38MergeModal')?.classList.remove('open'); };
  window.v38DoMergeGroups=function(){
    const a=getGroupById(document.getElementById('v38MergeA')?.value), b=getGroupById(document.getElementById('v38MergeB')?.value);
    if (!a || !b || a===b) { alert('اختر مجموعتين مختلفتين'); return; }
    if (bool(a.locked) || bool(b.locked)) { alert('لا يمكن دمج مجموعة مقفلة. افتح القفل أولًا.'); return; }
    a.verses=[...(a.verses||[]), ...(b.verses||[])];
    a.surahs=[...new Set([...(a.surahs||[]), ...(b.surahs||[])])];
    if (b.note) a.note=[a.note,b.note].filter(Boolean).join('<br>');
    if (b.unote) a.unote=[a.unote,b.unote].filter(Boolean).join('<br>');
    const idx=data().indexOf(b); if (idx>-1) data().splice(idx,1);
    data().forEach(function(g,i){ g.id=i+1; });
    v38CloseMergeModal(); saveRefresh();
  };
  function groupKey(g){ return (g.verses||[]).map(function(v){ return text(v.surah)+':'+text(v.ayah); }).sort().join('|'); }
  window.v38OpenDuplicates=function(){
    const buckets={};
    data().forEach(function(g){ [normalizeArabic(g.title), groupKey(g)].filter(Boolean).forEach(function(k){ (buckets[k]=buckets[k]||[]).push(g); }); });
    const dups=Object.values(buckets).filter(function(arr){ return arr.length>1; });
    let m=document.getElementById('v38DupModal');
    if (!m) { m=document.createElement('div'); m.id='v38DupModal'; m.className='modal-backdrop'; document.body.appendChild(m); }
    m.innerHTML='<div class="modal edit-modal"><div class="modal-header"><h2>كشف التكرار</h2><button class="close-btn" onclick="document.getElementById(\'v38DupModal\').classList.remove(\'open\')">×</button></div><div class="modal-body">'+(dups.length?dups.map(function(arr){ return '<div class="v38-dup-block">'+arr.map(function(g){ return '<div><b>'+esc(g.id)+'</b> - '+esc(g.title)+' <button onclick="openEditGroup('+Number(g.id)+')">تعديل</button></div>'; }).join('')+'</div>'; }).join(''):'<div class="v38-no-results">لا توجد مجموعات مكررة حسب العنوان أو نفس الآيات.</div>')+'</div><div class="modal-footer"><button onclick="document.getElementById(\'v38DupModal\').classList.remove(\'open\')">إغلاق</button></div></div>';
    m.classList.add('open'); setTimeout(makeAllModalsDraggable,20);
  };
  function addToolbarButtons(){
    const panel=document.querySelector('.search-panel');
    if (!panel || document.getElementById('v38MergeBtn')) return;
    panel.insertAdjacentHTML('beforeend','<span class="v38-toolbar-buttons"><button id="v38MergeBtn" type="button" onclick="v38OpenMergeModal()">دمج المجموعات</button><button id="v38DupBtn" type="button" onclick="v38OpenDuplicates()">كشف التكرار</button></span>');
  }

  function init(){ addToolbarButtons(); enhanceAdd(); enhanceEdit(); makeAllModalsDraggable(); }
  window.addEventListener('DOMContentLoaded', function(){ setTimeout(init,1000); });
  setTimeout(init,1500);
})();
/* END ADDON V38 RESTORE */


/* =========================================================
   V49 Compatibility Wrappers — preserve V38 logic, expose V44 hooks
========================================================= */
(function(){
  function $(id){return document.getElementById(id)}
  function asArrayData(){return (typeof DATA !== 'undefined' && Array.isArray(DATA)) ? DATA : []}
  window.openAdd = window.openAdd || function(){ if (typeof openAddModal==='function') openAddModal(); };
  window.openEdit = window.openEdit || function(id){ if (typeof openEditGroup==='function') openEditGroup(id); };
  window.openSettings = window.openSettings || function(){ if (typeof openAppSettings==='function') openAppSettings(); };
  window.openAdvanced = window.openAdvanced || function(){ if (typeof v34OpenAdvancedSearch==='function') v34OpenAdvancedSearch(); };
  window.openMerge = window.openMerge || function(){ if (typeof v38OpenMergeModal==='function') v38OpenMergeModal(); };
  window.openDuplicates = window.openDuplicates || function(){ if (typeof v38OpenDuplicates==='function') v38OpenDuplicates(); };
  window.openRelease = window.openRelease || function(){ if (typeof v36OpenReleaseNotes==='function') v36OpenReleaseNotes(); };
  window.applyFilters = window.applyFilters || function(){ if (typeof runSearch==='function') runSearch(); };
  window.toggleTheme = window.toggleTheme || function(){
    const current = document.body.getAttribute('data-theme') || 'quran-classic';
    const next = current === 'apple-health' ? 'quran-classic' : 'apple-health';
    if (typeof applyTheme === 'function') applyTheme(next); else document.body.setAttribute('data-theme', next);
  };
  window.showBrowse = window.showBrowse || function(btn){
    document.querySelectorAll('.nav-tab').forEach(function(x){x.classList.remove('active')});
    if(btn) btn.classList.add('active');
    const app=$('app'); if(app) app.scrollIntoView({behavior:'smooth',block:'start'});
  };
  window.showDashboard = window.showDashboard || function(btn){
    document.querySelectorAll('.nav-tab').forEach(function(x){x.classList.remove('active')});
    if(btn) btn.classList.add('active');
    const data = asArrayData();
    const verses = data.reduce(function(s,g){ return s + ((g.verses||[]).length); },0);
    const surahs = new Set(); data.forEach(function(g){ (g.surahs||[]).forEach(function(s){surahs.add(s)}); (g.verses||[]).forEach(function(v){if(v.surah)surahs.add(v.surah)}); });
    const fav = data.filter(function(g){return !!g.favorite}).length;
    const done = data.filter(function(g){return !!g.completed}).length;
    const locked = data.filter(function(g){return !!g.locked}).length;
    let modal=$('v49DashboardModal');
    if(!modal){ modal=document.createElement('div'); modal.id='v49DashboardModal'; modal.className='modal-backdrop'; document.body.appendChild(modal); }
    const cards=[['المجموعات',data.length],['الآيات',verses],['السور',surahs.size],['المفضلة',fav],['المكتملة',done],['المقفلة',locked]];
    modal.innerHTML='<div class="modal edit-modal"><div class="modal-header v38-drag-handle"><h2>الإحصائيات</h2><button class="close-btn" onclick="document.getElementById(\'v49DashboardModal\').classList.remove(\'open\')">×</button></div><div class="modal-body"><div class="v49-dashboard-grid">'+cards.map(function(c){return '<div class="v49-dashboard-card"><div class="v49-dashboard-value">'+c[1]+'</div><div class="v49-dashboard-label">'+c[0]+'</div></div>'}).join('')+'</div></div><div class="modal-footer"><button onclick="document.getElementById(\'v49DashboardModal\').classList.remove(\'open\')">إغلاق</button></div></div>';
    modal.classList.add('open');
    if (typeof makeAllModalsDraggable==='function') setTimeout(makeAllModalsDraggable,20);
  };
  // Expose v38 compare through a generic name if any V44 button calls it
  window.compare = window.compare || function(id){ if (typeof v38CompareGroupInline==='function') v38CompareGroupInline(id); };
})();


/* =========================================================
   V50 FIXES — filter normalization, true dark mode, dashboard close reset
========================================================= */
(function(){
  function v50Text(v){return v===undefined||v===null?'':String(v)}
  function v50Norm(s){
    return v50Text(s).toLowerCase()
      .replace(/[\x00-\x1F]/g,' ')
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
      .replace(/[أإآٱ]/g,'ا')
      .replace(/ؤ/g,'و').replace(/ئ/g,'ي')
      .replace(/ة/g,'ه').replace(/ى/g,'ي')
      .replace(/[٠-٩]/g,function(d){return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d));})
      .replace(/[^\u0600-\u06ff\w\s]/g,' ')
      .replace(/\s+/g,' ').trim();
  }
  function v50OfficialSurahName(name){
    const raw=v50Text(name).trim(); if(!raw) return '';
    if(typeof SURAH_NAMES==='undefined') return raw;
    const n=v50Norm(raw);
    for(const no in SURAH_NAMES){ if(v50Norm(SURAH_NAMES[no])===n || String(no)===raw) return SURAH_NAMES[no]; }
    return raw;
  }
  function v50GroupSurahs(g){
    const arr=[];
    (g&&Array.isArray(g.surahs)?g.surahs:[]).forEach(function(s){if(s)arr.push(v50OfficialSurahName(s));});
    (g&&Array.isArray(g.verses)?g.verses:[]).forEach(function(v){if(v&&v.surah)arr.push(v50OfficialSurahName(v.surah));});
    return Array.from(new Set(arr.filter(Boolean)));
  }
  function v50GroupHasSurah(g,s){const target=v50Norm(s);return v50GroupSurahs(g).some(function(x){return v50Norm(x)===target;});}
  function v50SearchMatch(g,q){
    if(!q) return true;
    const text=[g.title,g.note,g.unote].concat(v50GroupSurahs(g)).concat((g.verses||[]).flatMap(function(v){return [v.surah,v.ayah,v.label].concat((v.parts||[]).map(function(p){return p.text;}));})).join(' ');
    return v50Norm(text).includes(v50Norm(q));
  }
  window.getSurahGroupCounts=function(sourceData){
    const counts={}; (Array.isArray(sourceData)?sourceData:[]).forEach(function(g){v50GroupSurahs(g).forEach(function(s){counts[s]=(counts[s]||0)+1;});}); return counts;
  };
  window.renderSurahPill=function(no,name,count,cls){
    const selected=(typeof selectedSurahFilter!=='undefined'?selectedSurahFilter:null);
    const active=(v50Norm(window.selectedSurahFilter||selected)===v50Norm(name))?'active':'';
    const bc=(typeof getCountBadgeClass==='function')?getCountBadgeClass(count):(count?'low':'zero');
    const safe=(typeof escapeAttr==='function')?escapeAttr(name):String(name).replace(/"/g,'&quot;');
    return '<button class="'+(cls||'pro-surah-pill')+' '+active+' '+(count?'':'zero-count')+'" data-surah="'+safe+'" data-count="'+count+'" onclick="filterBySurahFromButton(this)"><span class="surah-no-badge">'+Number(no).toLocaleString('en-US')+'</span><span class="surah-name-text">'+v50Text(name)+'</span><span class="surah-count-badge '+bc+'">'+Number(count).toLocaleString('en-US')+'</span></button>';
  };
  window.filterBySurahFromButton=function(btn){if(btn) window.filterBySurah(btn.getAttribute('data-surah')||'');};
  window.renderSurahFilterButtons=function(){
    const grid=document.getElementById('surahFilterGrid'), top=document.getElementById('topSurahGrid'), cnt=document.getElementById('surahFilterCount'); if(!grid) return;
    const names=typeof SURAH_NAMES!=='undefined'?SURAH_NAMES:getDefaultSurahNames();
    const counts=window.getSurahGroupCounts(typeof DATA!=='undefined'?DATA:[]);
    const q=v50Norm((typeof surahFilterSearchText!=='undefined'?surahFilterSearchText:'')||document.getElementById('surahFilterSearch')?.value||'');
    const range=(typeof activeSurahRange!=='undefined'?activeSurahRange:'all');
    const b=(typeof getRangeBounds==='function')?getRangeBounds(range):[1,114];
    const items=Object.keys(names).map(function(no){return{no:+no,name:names[no],count:counts[names[no]]||0};});
    const topItems=items.filter(function(i){return i.count>0;}).sort(function(a,b){return b.count-a.count||a.no-b.no;}).slice(0,8);
    if(top) top.innerHTML=topItems.map(function(i){return window.renderSurahPill(i.no,i.name,i.count,'top-surah-pill');}).join('');
    const only=(typeof showOnlySurahsWithResults!=='undefined')?showOnlySurahsWithResults:true;
    const selected=(typeof selectedSurahFilter!=='undefined'?selectedSurahFilter:null);
    const vis=items.filter(function(i){return i.no>=b[0]&&i.no<=b[1]&&(!only||i.count>0||v50Norm(selected)===v50Norm(i.name))&&(!q||String(i.no).includes(q)||v50Norm(i.name).includes(q));});
    grid.innerHTML=vis.length?vis.map(function(i){return window.renderSurahPill(i.no,i.name,i.count,'pro-surah-pill');}).join(''):'<div class="no-results" style="padding:18px">لا توجد سور مطابقة</div>';
    if(cnt) cnt.textContent='المعروض: '+vis.length+' من 114 سورة';
    if(typeof updateSurahButtonAvailability==='function') updateSurahButtonAvailability(window.getSearchOnlyFilteredData?window.getSearchOnlyFilteredData():DATA);
  };
  window.updateSelectedSurahChip=function(){
    const chip=document.getElementById('selectedSurahChip'), st=document.getElementById('filterStatus'); if(!chip)return;
    const selected=(typeof selectedSurahFilter!=='undefined'?selectedSurahFilter:null);
    if(!selected){chip.classList.add('hidden');chip.innerHTML='';if(st)st.textContent='المعروض الآن: كل السور';return;}
    const display=v50OfficialSurahName(selected), c=window.getSurahGroupCounts(typeof DATA!=='undefined'?DATA:[])[display]||0;
    chip.classList.remove('hidden'); chip.innerHTML='<span>السورة المختارة: '+display+'</span><span class="surah-count-badge '+((typeof getCountBadgeClass==='function')?getCountBadgeClass(c):'low')+'">'+Number(c).toLocaleString('en-US')+'</span><button onclick="clearSurahFilter()">×</button>';
    if(st) st.textContent='المعروض الآن: '+display;
  };
  window.filterBySurah=function(s){selectedSurahFilter=v50OfficialSurahName(s);window.selectedSurahFilter=selectedSurahFilter;window.updateSelectedSurahChip();window.renderSurahFilterButtons();window.applyAllFilters();};
  window.clearSurahFilter=function(){selectedSurahFilter=null;window.selectedSurahFilter=null;window.updateSelectedSurahChip();window.renderSurahFilterButtons();window.applyAllFilters();};
  window.getSearchOnlyFilteredData=function(){const q=document.getElementById('searchInput')?.value.trim()||'';const list=(typeof DATA!=='undefined'&&Array.isArray(DATA))?DATA:[];return list.filter(function(g){return v50SearchMatch(g,q);});};
  window.applyAllFilters=function(){
    const q=document.getElementById('searchInput')?.value.trim()||''; const selected=(typeof selectedSurahFilter!=='undefined'?selectedSurahFilter:null); const list=(typeof DATA!=='undefined'&&Array.isArray(DATA))?DATA:[];
    const filtered=list.filter(function(g){return (!selected||v50GroupHasSurah(g,selected))&&v50SearchMatch(g,q);});
    if(typeof render==='function') render(filtered); if(typeof updateSurahButtonAvailability==='function') updateSurahButtonAvailability(window.getSearchOnlyFilteredData()); window.updateSelectedSurahChip();
  };
  window.runSearch=function(){window.applyAllFilters();};
  window.toggleTheme=function(){
    const isDark=document.body.getAttribute('data-theme')==='bevel-night'||document.body.classList.contains('dark'); const next=isDark?'quran-classic':'bevel-night';
    if(typeof applyTheme==='function') applyTheme(next); else document.body.setAttribute('data-theme',next);
    document.body.classList.toggle('dark',next==='bevel-night'); try{localStorage.setItem('mutashabihat_ui_theme',next);}catch(e){}
  };
  window.closeV50Dashboard=function(){document.getElementById('v49DashboardModal')?.classList.remove('open');document.querySelectorAll('.nav-tab').forEach(function(x){x.classList.remove('active')});const first=document.querySelector('.nav-tab');if(first)first.classList.add('active');};
  window.showDashboard=function(btn){
    document.querySelectorAll('.nav-tab').forEach(function(x){x.classList.remove('active')}); if(btn)btn.classList.add('active');
    const data=(typeof DATA!=='undefined'&&Array.isArray(DATA))?DATA:[]; const verses=data.reduce(function(s,g){return s+((g.verses||[]).length);},0); const surahs=new Set(); data.forEach(function(g){v50GroupSurahs(g).forEach(function(s){surahs.add(s);});});
    const fav=data.filter(function(g){return !!g.favorite}).length, done=data.filter(function(g){return !!g.completed}).length, locked=data.filter(function(g){return !!g.locked}).length;
    let modal=document.getElementById('v49DashboardModal'); if(!modal){modal=document.createElement('div');modal.id='v49DashboardModal';modal.className='modal-backdrop';document.body.appendChild(modal);}
    const cards=[['المجموعات',data.length],['الآيات',verses],['السور',surahs.size],['المفضلة',fav],['المكتملة',done],['المقفلة',locked]];
    modal.innerHTML='<div class="modal edit-modal"><div class="modal-header v38-drag-handle"><h2>الإحصائيات</h2><button class="close-btn" onclick="closeV50Dashboard()">×</button></div><div class="modal-body"><div class="v49-dashboard-grid">'+cards.map(function(c){return '<div class="v49-dashboard-card"><div class="v49-dashboard-value">'+c[1]+'</div><div class="v49-dashboard-label">'+c[0]+'</div></div>';}).join('')+'</div></div><div class="modal-footer"><button onclick="closeV50Dashboard()">إغلاق</button></div></div>';
    modal.classList.add('open'); if(typeof makeAllModalsDraggable==='function') setTimeout(makeAllModalsDraggable,20);
  };
  window.getGroupColor=function(){return 'var(--group-accent)';};
  document.addEventListener('DOMContentLoaded',function(){const saved=localStorage.getItem('mutashabihat_ui_theme'); if(saved==='bevel-night') document.body.classList.add('dark'); setTimeout(function(){if(typeof buildSurahFilterBar==='function') buildSurahFilterBar(); if(window.applyAllFilters) window.applyAllFilters();},200);});
})();


/* =========================================================
   V51 Logic Refinements
   - remember last light theme
   - multi-select surah filter
   - comparison popup instead of inline panel
========================================================= */
(function(){
  const LIGHT_KEY='mutashabihat_last_light_theme';
  const MULTI_KEY='mutashabihat_selected_surahs_multi';
  let selectedSurahFilters=[];

  function txt(v){return v===undefined||v===null?'':String(v)}
  function norm(s){
    return txt(s).toLowerCase()
      .replace(/[\x00-\x1F]/g,' ')
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
      .replace(/[أإآٱ]/g,'ا')
      .replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ة/g,'ه').replace(/ى/g,'ي')
      .replace(/[٠-٩]/g,function(d){return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d));})
      .replace(/[^\u0600-\u06ff\w\s]/g,' ')
      .replace(/\s+/g,' ').trim();
  }
  function official(name){
    const raw=txt(name).trim(); if(!raw) return '';
    if(typeof SURAH_NAMES==='undefined') return raw;
    const n=norm(raw);
    for(const no in SURAH_NAMES){ if(String(no)===raw || norm(SURAH_NAMES[no])===n) return SURAH_NAMES[no]; }
    return raw;
  }
  function groupSurahs(g){
    const arr=[];
    (g&&Array.isArray(g.surahs)?g.surahs:[]).forEach(function(s){if(s)arr.push(official(s));});
    (g&&Array.isArray(g.verses)?g.verses:[]).forEach(function(v){if(v&&v.surah)arr.push(official(v.surah));});
    return Array.from(new Set(arr.filter(Boolean)));
  }
  function hasAnySelected(g){
    if(!selectedSurahFilters.length) return true;
    const gs=groupSurahs(g).map(norm);
    return selectedSurahFilters.map(norm).some(function(s){return gs.includes(s);});
  }
  function searchMatch(g,q){
    if(!q) return true;
    const text=[g.title,g.note,g.unote].concat(groupSurahs(g)).concat((g.verses||[]).flatMap(function(v){return [v.surah,v.ayah,v.label].concat((v.parts||[]).map(function(p){return p.text;}));})).join(' ');
    return norm(text).includes(norm(q));
  }
  function saveMulti(){try{localStorage.setItem(MULTI_KEY,JSON.stringify(selectedSurahFilters));}catch(e){}}
  function loadMulti(){try{const x=JSON.parse(localStorage.getItem(MULTI_KEY)||'[]');selectedSurahFilters=Array.isArray(x)?x.map(official).filter(Boolean):[];}catch(e){selectedSurahFilters=[];}}

  window.toggleTheme=function(){
    const current=document.body.getAttribute('data-theme')||'quran-classic';
    const isDark=current==='bevel-night'||document.body.classList.contains('dark');
    if(isDark){
      const last=localStorage.getItem(LIGHT_KEY)||'quran-classic';
      if(typeof applyTheme==='function') applyTheme(last); else document.body.setAttribute('data-theme',last);
      document.body.classList.remove('dark');
    }else{
      if(current && current!=='bevel-night') localStorage.setItem(LIGHT_KEY,current);
      if(typeof applyTheme==='function') applyTheme('bevel-night'); else document.body.setAttribute('data-theme','bevel-night');
      document.body.classList.add('dark');
    }
  };

  window.getSurahGroupCounts=function(sourceData){
    const counts={};
    (Array.isArray(sourceData)?sourceData:[]).forEach(function(g){groupSurahs(g).forEach(function(s){counts[s]=(counts[s]||0)+1;});});
    return counts;
  };
  window.renderSurahPill=function(no,name,count,cls){
    const active=selectedSurahFilters.map(norm).includes(norm(name))?'active':'';
    const bc=(typeof getCountBadgeClass==='function')?getCountBadgeClass(count):(count?'low':'zero');
    const safe=(typeof escapeAttr==='function')?escapeAttr(name):String(name).replace(/"/g,'&quot;');
    return '<button class="'+(cls||'pro-surah-pill')+' '+active+' '+(count?'':'zero-count')+'" data-surah="'+safe+'" data-count="'+count+'" onclick="filterBySurahFromButton(this)"><span class="surah-no-badge">'+Number(no).toLocaleString('en-US')+'</span><span class="surah-name-text">'+txt(name)+'</span><span class="surah-count-badge '+bc+'">'+Number(count).toLocaleString('en-US')+'</span></button>';
  };
  window.filterBySurahFromButton=function(btn){ if(btn) window.filterBySurah(btn.getAttribute('data-surah')||''); };
  window.filterBySurah=function(s){
    const name=official(s); if(!name) return;
    const idx=selectedSurahFilters.map(norm).indexOf(norm(name));
    if(idx>=0) selectedSurahFilters.splice(idx,1); else selectedSurahFilters.push(name);
    selectedSurahFilter=selectedSurahFilters[0]||null;
    window.selectedSurahFilter=selectedSurahFilter;
    saveMulti(); window.updateSelectedSurahChip(); window.renderSurahFilterButtons(); window.applyAllFilters();
  };
  window.clearSurahFilter=function(){selectedSurahFilters=[];selectedSurahFilter=null;window.selectedSurahFilter=null;saveMulti();window.updateSelectedSurahChip();window.renderSurahFilterButtons();window.applyAllFilters();};
  window.removeOneSurahFilter=function(s){selectedSurahFilters=selectedSurahFilters.filter(function(x){return norm(x)!==norm(s);});selectedSurahFilter=selectedSurahFilters[0]||null;window.selectedSurahFilter=selectedSurahFilter;saveMulti();window.updateSelectedSurahChip();window.renderSurahFilterButtons();window.applyAllFilters();};
  window.updateSelectedSurahChip=function(){
    const chip=document.getElementById('selectedSurahChip'), st=document.getElementById('filterStatus'); if(!chip)return;
    if(!selectedSurahFilters.length){chip.classList.add('hidden');chip.innerHTML='';if(st)st.textContent='المعروض الآن: كل السور';return;}
    chip.classList.remove('hidden');
    chip.innerHTML=selectedSurahFilters.map(function(s){return '<span class="multi-filter-chip">'+s+' <button onclick="removeOneSurahFilter(\''+String(s).replace(/'/g,'')+'\')">×</button></span>';}).join('');
    if(st) st.textContent='المعروض الآن: '+selectedSurahFilters.length+' سورة مختارة';
  };
  window.renderSurahFilterButtons=function(){
    const grid=document.getElementById('surahFilterGrid'), top=document.getElementById('topSurahGrid'), cnt=document.getElementById('surahFilterCount'); if(!grid)return;
    const names=typeof SURAH_NAMES!=='undefined'?SURAH_NAMES:getDefaultSurahNames();
    const counts=window.getSurahGroupCounts(typeof DATA!=='undefined'?DATA:[]);
    const q=norm((typeof surahFilterSearchText!=='undefined'?surahFilterSearchText:'')||document.getElementById('surahFilterSearch')?.value||'');
    const range=(typeof activeSurahRange!=='undefined'?activeSurahRange:'all');
    const b=(typeof getRangeBounds==='function')?getRangeBounds(range):[1,114];
    const items=Object.keys(names).map(function(no){return{no:+no,name:names[no],count:counts[names[no]]||0};});
    const topItems=items.filter(function(i){return i.count>0;}).sort(function(a,b){return b.count-a.count||a.no-b.no;}).slice(0,8);
    if(top) top.innerHTML=topItems.map(function(i){return window.renderSurahPill(i.no,i.name,i.count,'top-surah-pill');}).join('');
    const only=(typeof showOnlySurahsWithResults!=='undefined')?showOnlySurahsWithResults:true;
    const vis=items.filter(function(i){return i.no>=b[0]&&i.no<=b[1]&&(!only||i.count>0||selectedSurahFilters.map(norm).includes(norm(i.name)))&&(!q||String(i.no).includes(q)||norm(i.name).includes(q));});
    grid.innerHTML=vis.length?vis.map(function(i){return window.renderSurahPill(i.no,i.name,i.count,'pro-surah-pill');}).join(''):'<div class="no-results" style="padding:18px">لا توجد سور مطابقة</div>';
    if(cnt) cnt.textContent='المعروض: '+vis.length+' من 114 سورة';
    if(typeof updateSurahButtonAvailability==='function') updateSurahButtonAvailability(window.getSearchOnlyFilteredData?window.getSearchOnlyFilteredData():DATA);
  };
  window.getSearchOnlyFilteredData=function(){const q=document.getElementById('searchInput')?.value.trim()||'';const list=(typeof DATA!=='undefined'&&Array.isArray(DATA))?DATA:[];return list.filter(function(g){return searchMatch(g,q);});};
  window.applyAllFilters=function(){
    const q=document.getElementById('searchInput')?.value.trim()||''; const list=(typeof DATA!=='undefined'&&Array.isArray(DATA))?DATA:[];
    const filtered=list.filter(function(g){return hasAnySelected(g)&&searchMatch(g,q);});
    if(typeof render==='function') render(filtered);
    if(typeof updateSurahButtonAvailability==='function') updateSurahButtonAvailability(window.getSearchOnlyFilteredData());
    window.updateSelectedSurahChip();
  };
  window.runSearch=function(){window.applyAllFilters();};

  function esc(v){return txt(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function verseText(v){return (v.parts||[]).map(function(p){return p.text||'';}).join('') || v.text || '';}
  function words(s){return txt(s).split(/\s+/).filter(Boolean);}
  window.v38CompareGroupInline=function(groupId){
    const g=(typeof DATA!=='undefined'?DATA:[]).find(function(x){return Number(x.id)===Number(groupId);});
    if(!g) return;
    const baseWords=words(verseText((g.verses||[])[0]||{})).map(norm);
    let modal=document.getElementById('v51CompareModal');
    if(!modal){modal=document.createElement('div');modal.id='v51CompareModal';modal.className='modal-backdrop';document.body.appendChild(modal);}
    const body=(g.verses||[]).map(function(v,i){
      const html=words(verseText(v)).map(function(w){const cls=i===0?'v51-base':(baseWords.includes(norm(w))?'v51-same':'v51-diff');return '<span class="'+cls+'">'+esc(w)+'</span>';}).join(' ');
      return '<div class="v51-compare-card"><div class="v51-compare-ref"><span>'+esc(v.surah)+'</span><span>آية '+esc(v.ayah)+'</span>'+(v.label?'<span>'+esc(v.label)+'</span>':'')+'</div><div class="v51-compare-text">'+html+'</div></div>';
    }).join('');
    modal.innerHTML='<div class="modal edit-modal v51-compare-modal"><div class="modal-header v38-drag-handle"><h2>المقارنة البصرية — '+esc(g.title)+'</h2><button class="close-btn" onclick="document.getElementById(\'v51CompareModal\').classList.remove(\'open\')">×</button></div><div class="modal-body"><div class="v51-compare-body">'+body+'</div></div><div class="modal-footer"><button onclick="document.getElementById(\'v51CompareModal\').classList.remove(\'open\')">إغلاق</button></div></div>';
    modal.classList.add('open'); if(typeof makeAllModalsDraggable==='function') setTimeout(makeAllModalsDraggable,20);
  };
  window.compare=window.v38CompareGroupInline;

  document.addEventListener('DOMContentLoaded',function(){loadMulti();setTimeout(function(){window.updateSelectedSurahChip();window.renderSurahFilterButtons();window.applyAllFilters();},250);});
})();


/* =========================================================
 V55 MOBILE MENU + GROUP MODAL PACK
========================================================= */
(function(){
 if(window.__V55_MOBILE_UI__) return; window.__V55_MOBILE_UI__=true;
 function isMobileView(){return window.matchMedia && window.matchMedia('(max-width: 700px)').matches;}
 function closeIfMenu(){document.getElementById('v55MobileMenu')?.classList.remove('open');}
 window.v55CallAndClose=function(fnName){closeIfMenu();try{const fn=window[fnName];if(typeof fn==='function')fn();}catch(e){console.warn('Mobile menu action failed:',fnName,e);}};
 function ensureMobileMenu(){if(document.getElementById('v55MobileMenu'))return;const m=document.createElement('div');m.id='v55MobileMenu';m.className='mobile-menu-backdrop';m.innerHTML=`<aside class="mobile-menu-panel" role="dialog" aria-modal="true" aria-label="قائمة الخيارات"><div class="mobile-menu-head"><span>القائمة</span><button class="mobile-menu-close" type="button" onclick="closeMobileMenu()">×</button></div><div class="mobile-menu-grid"><button class="primary-mobile-action" type="button" onclick="v55CallAndClose('openAddModal')">+ إضافة متشابه</button><button type="button" onclick="v55CallAndClose('showBrowse')">المتشابهات</button><button type="button" onclick="v55CallAndClose('showDashboard')">الإحصائيات</button><button type="button" onclick="v55CallAndClose('openAppSettings')">الإعدادات</button><button type="button" onclick="v55CallAndClose('v34OpenAdvancedSearch')">بحث متقدم</button><button type="button" onclick="v55CallAndClose('v38OpenMergeModal')">دمج المجموعات</button><button type="button" onclick="v55CallAndClose('v38OpenDuplicates')">كشف التكرار</button><button type="button" onclick="v55CallAndClose('v36OpenReleaseNotes')">Release Note</button><button type="button" onclick="v55CallAndClose('downloadDataJS')">Export data.js</button><button type="button" onclick="v55CallAndClose('toggleTheme')">تبديل الوضع الليلي</button></div></aside>`;m.addEventListener('click',e=>{if(e.target===m)closeMobileMenu();});document.body.appendChild(m);}
 window.openMobileMenu=function(){ensureMobileMenu();document.getElementById('v55MobileMenu').classList.add('open');};
 window.closeMobileMenu=function(){document.getElementById('v55MobileMenu')?.classList.remove('open');};
 function ensureMobileGroupModal(){if(document.getElementById('v55MobileGroupModal'))return;const m=document.createElement('div');m.id='v55MobileGroupModal';m.className='modal-backdrop mobile-group-modal';m.innerHTML=`<div class="modal edit-modal"><div class="modal-header"><h2 id="v55MobileGroupTitle">تفاصيل المجموعة</h2><button class="close-btn" type="button" onclick="closeMobileGroupModal()">×</button></div><div id="v55MobileGroupBody" class="modal-body mobile-group-preview-body"></div></div>`;m.addEventListener('click',e=>{if(e.target===m)closeMobileGroupModal();});document.body.appendChild(m);}
 window.closeMobileGroupModal=function(){document.getElementById('v55MobileGroupModal')?.classList.remove('open');};
 window.openMobileGroupModalFromHeader=function(header){if(!header)return;const group=header.closest('.group');if(!group)return;ensureMobileGroupModal();const clone=group.cloneNode(true);clone.classList.add('open');clone.querySelectorAll('[onclick]').forEach(el=>{const oc=el.getAttribute('onclick')||'';if(oc.includes('toggleGroup'))el.removeAttribute('onclick');});const title=group.querySelector('.group-title')?.textContent?.trim()||'تفاصيل المجموعة';const titleEl=document.getElementById('v55MobileGroupTitle');const bodyEl=document.getElementById('v55MobileGroupBody');if(titleEl)titleEl.textContent=title;if(bodyEl){bodyEl.innerHTML='';bodyEl.appendChild(clone);}document.getElementById('v55MobileGroupModal').classList.add('open');};
 function wrapToggle(){const current=window.toggleGroup;if(current&&current.__v55Wrapped)return;const wrapped=function(header){if(isMobileView()){window.openMobileGroupModalFromHeader(header);return;}if(typeof current==='function')return current.apply(this,arguments);header?.parentElement?.classList.toggle('open');};wrapped.__v55Wrapped=true;window.toggleGroup=wrapped;}
 wrapToggle();window.addEventListener('DOMContentLoaded',function(){ensureMobileMenu();setTimeout(wrapToggle,900);});
})();


/* =========================================================
 V56 EDIT MODE + COMPACT TEXTAREA + DIFF2 PACK
========================================================= */
(function(){
  if(window.__V56_EDIT_MODE_PACK__) return;
  window.__V56_EDIT_MODE_PACK__ = true;
  const KEY='mutashabihat_edit_mode_enabled';
  function isEditMode(){ return localStorage.getItem(KEY)==='true'; }
  function setEditMode(on){
    localStorage.setItem(KEY,on?'true':'false');
    document.body.setAttribute('data-edit-mode',on?'on':'off');
    const cb=document.getElementById('v56EditModeToggle');
    if(cb) cb.checked=!!on;
  }
  window.v56SetEditMode=function(on){ setEditMode(!!on); };
  function initMode(){ setEditMode(isEditMode()); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initMode); else initMode();

  function injectEditModeSetting(){
    const body=document.querySelector('#appSettingsModal .modal-body');
    if(!body || document.getElementById('v56EditModeSection')) return;
    const sec=document.createElement('div');
    sec.id='v56EditModeSection';
    sec.className='settings-section';
    sec.innerHTML=`
      <h3>✏️ Edit Mode / وضع التعديل</h3>
      <p class="v36-settings-note">عند إيقاف وضع التعديل تظهر أيقونات المفضلة والمكتمل فقط، وتختفي أيقونات التعديل والمقارنة والقفل والدمج وكشف التكرار.</p>
      <label style="display:flex;align-items:center;gap:10px;font-weight:900;cursor:pointer">
        <input id="v56EditModeToggle" type="checkbox" onchange="v56SetEditMode(this.checked)" style="width:20px;height:20px">
        <span>تفعيل وضع التعديل</span>
      </label>`;
    body.insertBefore(sec, body.firstChild);
    const cb=document.getElementById('v56EditModeToggle');
    if(cb) cb.checked=isEditMode();
  }
  const oldOpenSettings=window.openAppSettings;
  window.openAppSettings=function(){
    const r=oldOpenSettings?oldOpenSettings.apply(this,arguments):undefined;
    setTimeout(injectEditModeSetting,80);
    return r;
  };
  window.addEventListener('DOMContentLoaded',()=>setTimeout(injectEditModeSetting,1200));

  /* Add diff2 to every edit part selector, including selectors created after render */
  function ensureDiff2Options(root){
    (root||document).querySelectorAll('select.edit-part-type, #newType').forEach(sel=>{
      if(!sel.querySelector('option[value="diff2"]')){
        const opt=document.createElement('option');
        opt.value='diff2'; opt.textContent='diff2';
        const diff=sel.querySelector('option[value="diff"]');
        if(diff && diff.nextSibling) diff.parentNode.insertBefore(opt,diff.nextSibling); else sel.appendChild(opt);
      }
    });
  }
  window.v56EnsureDiff2Options=ensureDiff2Options;

  /* Auto height for edit textareas: height follows content, width unchanged */
  function autoSizeTextArea(el){
    if(!el) return;
    el.style.height='auto';
    el.style.height=Math.max(34, Math.min(el.scrollHeight+2, 220))+'px';
  }
  window.v56AutoSizeAyahBoxes=function(root){
    (root||document).querySelectorAll('textarea.edit-part-text').forEach(autoSizeTextArea);
  };
  document.addEventListener('input',function(e){ if(e.target && e.target.matches('textarea.edit-part-text')) autoSizeTextArea(e.target); });

  ['renderEditVerses','openEditGroup','openAddModal'].forEach(name=>{
    const old=window[name];
    if(typeof old==='function' && !old.__v56Wrapped){
      const wrapped=function(){
        const r=old.apply(this,arguments);
        setTimeout(()=>{ensureDiff2Options(document); window.v56AutoSizeAyahBoxes(document);},60);
        return r;
      };
      wrapped.__v56Wrapped=true;
      window[name]=wrapped;
    }
  });

  /* Guard edit-only actions in read mode */
  ['v38OpenMergeModal','v38OpenDuplicates','openMerge','openDuplicates'].forEach(name=>{
    const old=window[name];
    if(typeof old==='function' && !old.__v56Guarded){
      const wrapped=function(){
        if(!isEditMode()) { alert('فعّل وضع التعديل من الإعدادات أولاً.'); return; }
        return old.apply(this,arguments);
      };
      wrapped.__v56Guarded=true;
      window[name]=wrapped;
    }
  });

  const mo=new MutationObserver(muts=>{
    for(const m of muts){
      if(m.addedNodes && m.addedNodes.length){
        ensureDiff2Options(document);
        window.v56AutoSizeAyahBoxes(document);
        break;
      }
    }
  });
  window.addEventListener('DOMContentLoaded',()=>{
    ensureDiff2Options(document);
    window.v56AutoSizeAyahBoxes(document);
    mo.observe(document.body,{childList:true,subtree:true});
  });
})();


/* V58: Guard Add Group in read mode */
(function(){
  if(window.__V58_ADD_GUARD__) return; window.__V58_ADD_GUARD__=true;
  function isEditMode(){return localStorage.getItem('mutashabihat_edit_mode_enabled')==='true';}
  function guardAdd(){
    const old=window.openAddModal;
    if(typeof old==='function' && !old.__v58Guarded){
      const wrapped=function(){
        if(!isEditMode()){alert('فعّل وضع التعديل من الإعدادات أولاً.');return;}
        return old.apply(this,arguments);
      };
      wrapped.__v58Guarded=true;
      window.openAddModal=wrapped;
    }
  }
  guardAdd();
  window.addEventListener('DOMContentLoaded',()=>setTimeout(guardAdd,900));
})();


/* =========================================================
 V59 INLINE SORT + STATUS LINE PACK
========================================================= */
(function(){
  if(window.__V59_INLINE_SORT_PACK__) return;
  window.__V59_INLINE_SORT_PACK__=true;

  function ensureInlineSort(){
    const row=document.querySelector('#surahFilterSection .filter-compact-row');
    const toolbar=document.getElementById('groupDisplayToolbar');
    const original=document.getElementById('groupDisplaySelect');
    if(!row || !toolbar || !original) return;

    toolbar.classList.add('v59-toolbar-index-only');

    let wrap=document.getElementById('v59InlineSort');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='v59InlineSort';
      wrap.className='v59-inline-sort';
      wrap.innerHTML='<label for="v59GroupDisplaySelect">طريقة عرض المجموعات</label><select id="v59GroupDisplaySelect" class="group-display-select"></select>';
      row.appendChild(wrap);
    }
    const inline=document.getElementById('v59GroupDisplaySelect');
    if(inline && inline.options.length !== original.options.length){
      inline.innerHTML=original.innerHTML;
    }
    if(inline && inline.value !== original.value){ inline.value=original.value; }
    if(inline && !inline.__v59Bound){
      inline.addEventListener('change',function(){
        original.value=this.value;
        if(typeof setGroupDisplayMode==='function') setGroupDisplayMode(this.value);
        else original.dispatchEvent(new Event('change',{bubbles:true}));
      });
      inline.__v59Bound=true;
    }
  }

  function syncInlineSort(){
    const original=document.getElementById('groupDisplaySelect');
    const inline=document.getElementById('v59GroupDisplaySelect');
    if(original && inline && inline.value!==original.value) inline.value=original.value;
  }

  const oldSet=window.setGroupDisplayMode;
  if(typeof oldSet==='function' && !oldSet.__v59Wrapped){
    const wrapped=function(){
      const r=oldSet.apply(this,arguments);
      setTimeout(()=>{ensureInlineSort();syncInlineSort();},40);
      return r;
    };
    wrapped.__v59Wrapped=true;
    window.setGroupDisplayMode=wrapped;
  }

  function init(){
    ensureInlineSort();
    syncInlineSort();
    const mo=new MutationObserver(()=>{ensureInlineSort();syncInlineSort();});
    mo.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,900));
  else setTimeout(init,900);
})();


/* =========================================================
 V60 DASHBOARD OUTSIDE CLOSE + IPAD PORTRAIT MOBILE LOGIC
========================================================= */
(function(){
  if(window.__V60_DASHBOARD_IPAD_PACK__) return;
  window.__V60_DASHBOARD_IPAD_PACK__=true;

  function isMobileOrIpadPortrait(){
    const phone = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
    const ipadPortrait = window.matchMedia && window.matchMedia('(max-width: 1024px) and (orientation: portrait)').matches;
    return !!(phone || ipadPortrait);
  }
  window.v60IsMobileOrIpadPortrait=isMobileOrIpadPortrait;

  /* Close dashboard when clicking the backdrop/outside the dashboard window */
  function bindDashboardOutsideClose(){
    const modal=document.getElementById('v49DashboardModal');
    if(!modal || modal.__v60OutsideClose) return;
    modal.addEventListener('click',function(e){
      if(e.target===modal){
        modal.classList.remove('open');
        document.querySelectorAll('.nav-tab').forEach(function(x){x.classList.remove('active')});
        const first=document.querySelector('.nav-tab');
        if(first) first.classList.add('active');
      }
    });
    modal.__v60OutsideClose=true;
  }

  const oldDashboard=window.showDashboard;
  if(typeof oldDashboard==='function' && !oldDashboard.__v60Wrapped){
    const wrapped=function(){
      const r=oldDashboard.apply(this,arguments);
      setTimeout(bindDashboardOutsideClose,40);
      return r;
    };
    wrapped.__v60Wrapped=true;
    window.showDashboard=wrapped;
  }
  window.addEventListener('DOMContentLoaded',function(){setTimeout(bindDashboardOutsideClose,1200);});

  /* Upgrade mobile group modal behavior to include iPad portrait as mobile */
  function wrapToggleForIpad(){
    const current=window.toggleGroup;
    if(!current || current.__v60IpadWrapped) return;
    const wrapped=function(header){
      if(isMobileOrIpadPortrait() && typeof window.openMobileGroupModalFromHeader==='function'){
        window.openMobileGroupModalFromHeader(header);
        return;
      }
      return current.apply(this,arguments);
    };
    wrapped.__v60IpadWrapped=true;
    window.toggleGroup=wrapped;
  }
  wrapToggleForIpad();
  window.addEventListener('DOMContentLoaded',function(){setTimeout(wrapToggleForIpad,1000);});
})();


/* =========================================================
 V62 SAFE CATEGORY SAVE + FAST SYNC FIX
 Fixes V61 page-freeze by removing continuous MutationObserver rewrites.
========================================================= */
(function(){
  if(window.__V62_SAFE_CATEGORY_SAVE__) return;
  window.__V62_SAFE_CATEGORY_SAVE__=true;

  const VALID_TYPES=['normal','shared','diff','diff2','addition','unique'];
  function normType(t){
    t=(t===undefined||t===null?'normal':String(t)).trim().toLowerCase();
    if(t==='different') t='diff';
    if(t==='diff-2'||t==='diff_2'||t==='purple') t='diff2';
    return VALID_TYPES.includes(t)?t:'normal';
  }
  function esc(v){
    if(typeof escapeHtml==='function') return escapeHtml(v);
    return String(v===undefined||v===null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function optionsHTML(selected){
    selected=normType(selected);
    return VALID_TYPES.map(t=>'<option value="'+t+'" '+(selected===t?'selected':'')+'>'+t+'</option>').join('');
  }
  function ensureOneSelect(sel){
    if(!sel) return;
    const cur=normType(sel.value || sel.getAttribute('data-saved-type') || 'normal');
    // Only rebuild if diff2 is missing. Do NOT rebuild continuously.
    if(!sel.querySelector('option[value="diff2"]') || !sel.querySelector('option[value="unique"]')){
      sel.innerHTML=optionsHTML(cur);
    }
    sel.value=cur;
    sel.setAttribute('data-saved-type',cur);
  }
  function ensureCategoryOptions(root){
    (root||document).querySelectorAll('select.edit-part-type,#newType').forEach(ensureOneSelect);
  }
  window.v62EnsureCategoryOptions=ensureCategoryOptions;

  // Safe edit part renderer with all categories
  function v62RenderEditPart(p,vi,pi){
    const type=normType(p&&p.type);
    const text=(p&&p.text!==undefined)?p.text:'';
    return `<div class="edit-part-row" data-part-index="${pi}">
      <select class="edit-part-type" data-saved-type="${type}">${optionsHTML(type)}</select>
      <textarea class="edit-part-text" placeholder="اكتب جزء الآية هنا...">${esc(text)}</textarea>
      <div class="part-action-bar">
        <button class="move-part-btn" type="button" onclick="moveEditPartUp(${vi},${pi})">↑ أعلى</button>
        <button class="move-part-btn" type="button" onclick="moveEditPartDown(${vi},${pi})">↓ أسفل</button>
        <button class="insert-part-btn" type="button" onclick="insertEditPartAbove(${vi},${pi})">+ فوق</button>
        <button class="insert-part-btn" type="button" onclick="insertEditPartBelow(${vi},${pi})">+ تحت</button>
        <button class="remove-small" type="button" onclick="removeEditPart(${vi},${pi})">حذف</button>
      </div>
    </div>`;
  }
  window.renderEditPart=v62RenderEditPart;
  try{ renderEditPart=v62RenderEditPart; }catch(e){}

  function v62CollectEditVersesFromDOM(){
    const cards=document.querySelectorAll('#editVersesBox .edit-verse-card');
    const verses=[];
    cards.forEach(card=>{
      const surah=(card.querySelector('.edit-surah')?.value||'').trim();
      const ayah=(card.querySelector('.edit-ayah')?.value||'').trim();
      const label=(card.querySelector('.edit-label')?.value||'').trim();
      const parts=[];
      card.querySelectorAll('.edit-part-row').forEach(row=>{
        const type=normType(row.querySelector('.edit-part-type')?.value||'normal');
        const text=row.querySelector('.edit-part-text')?.value||'';
        if(String(text).trim()) parts.push({type,text});
      });
      if(surah && ayah && parts.length) verses.push({surah,ayah,label,parts});
    });
    return verses;
  }
  window.collectEditVersesFromDOM=v62CollectEditVersesFromDOM;
  try{ collectEditVersesFromDOM=v62CollectEditVersesFromDOM; }catch(e){}

  function v62SaveEditGroup(){
    if(editGroupIndex===null || editGroupIndex<0){ alert('لا توجد مجموعة مفتوحة للتعديل'); return; }
    ensureCategoryOptions(document);
    const title=(document.getElementById('editTitle')?.value||'').trim();
    const note=(typeof sanitizeRichText==='function'?sanitizeRichText(document.getElementById('editNoteEditor')?.innerHTML||''):(document.getElementById('editNoteEditor')?.innerHTML||'')).trim();
    const unote=(typeof sanitizeRichText==='function'?sanitizeRichText(document.getElementById('editUnoteEditor')?.innerHTML||''):(document.getElementById('editUnoteEditor')?.innerHTML||'')).trim();
    const verses=v62CollectEditVersesFromDOM();
    if(!title){ alert('عنوان المتشابه لا يمكن أن يكون فارغًا'); return; }
    if(!verses.length){ alert('يجب وجود آية واحدة على الأقل'); return; }
    const oldGroup=DATA[editGroupIndex]||{};
    DATA[editGroupIndex]={...oldGroup,title,surahs:[...new Set(verses.map(v=>v.surah).filter(Boolean))],verses,note,unote};
    if(typeof closeEditModal==='function') closeEditModal();
    if(typeof masterSave==='function') masterSave();
    if(typeof buildSurahFilterBar==='function') buildSurahFilterBar();
    if(typeof applyAllFilters==='function') applyAllFilters(); else if(typeof render==='function') render(DATA);
  }
  window.saveEditGroup=v62SaveEditGroup;
  try{ saveEditGroup=v62SaveEditGroup; }catch(e){}

  // Fast non-blocking save/sync. No page-load heavy processing.
  let syncRunning=false, syncPending=false, syncTimer=null;
  function compactDataJS(){return 'const DATA='+JSON.stringify(DATA)+';';}
  async function v62SyncToGitHub(){
    const s=(typeof loadGHSettings==='function')?loadGHSettings():{};
    if(!s.token||!s.owner||!s.repo){ if(typeof updateGHBadge==='function') updateGHBadge('none'); return false; }
    if(syncRunning){syncPending=true; return false;}
    syncRunning=true; syncPending=false;
    try{
      if(typeof updateGHBadge==='function') updateGHBadge('syncing');
      const content=compactDataJS();
      const encoded=btoa(unescape(encodeURIComponent(content)));
      const url='https://api.github.com/repos/'+s.owner+'/'+s.repo+'/contents/'+(s.path||'data.js');
      const headers={Authorization:'token '+s.token,Accept:'application/vnd.github+json','Content-Type':'application/json'};
      let sha=null;
      const getRes=await fetch(url+'?ref='+(s.branch||'main')+'&t='+Date.now(),{headers,cache:'no-store'});
      if(getRes.ok){sha=(await getRes.json()).sha;}
      const body={message:'fast data.js sync — '+new Date().toISOString(),content:encoded,branch:s.branch||'main'};
      if(sha) body.sha=sha;
      const putRes=await fetch(url,{method:'PUT',headers,body:JSON.stringify(body)});
      if(putRes.ok){ if(typeof updateGHBadge==='function') updateGHBadge('ok'); return true; }
      let msg=putRes.status;
      try{msg=(await putRes.json()).message||msg;}catch(e){}
      if(typeof updateGHBadge==='function') updateGHBadge('error',msg);
      return false;
    }catch(e){
      if(typeof updateGHBadge==='function') updateGHBadge('error','Network error');
      return false;
    }finally{
      syncRunning=false;
      if(syncPending){syncPending=false; setTimeout(v62SyncToGitHub,250);}
    }
  }
  function scheduleSync(){clearTimeout(syncTimer); syncTimer=setTimeout(v62SyncToGitHub,700);}
  async function v62MasterSave(){
    try{localStorage.setItem(LS_KEY,JSON.stringify(DATA)); if(typeof updateStorageStatus==='function') updateStorageStatus('saved');}catch(e){console.warn('local save failed',e);}
    if(typeof fileHandle!=='undefined' && fileHandle && typeof writeToLinkedFile==='function') writeToLinkedFile().catch(()=>{});
    scheduleSync();
  }
  window.syncToGitHub=v62SyncToGitHub;
  window.masterSave=v62MasterSave;
  try{ syncToGitHub=v62SyncToGitHub; }catch(e){}
  try{ masterSave=v62MasterSave; }catch(e){}

  // Compact export data.js
  const oldDownload=window.downloadDataJS;
  if(typeof oldDownload==='function' && !oldDownload.__v62Wrapped){
    const wrapped=function(){
      try{
        const blob=new Blob([compactDataJS()],{type:'application/javascript;charset=utf-8'});
        const a=document.createElement('a');
        a.href=URL.createObjectURL(blob); a.download='data.js';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      }catch(e){return oldDownload.apply(this,arguments);}
    };
    wrapped.__v62Wrapped=true; window.downloadDataJS=wrapped; try{downloadDataJS=wrapped;}catch(e){}
  }

  document.addEventListener('change',e=>{
    if(e.target && e.target.matches('select.edit-part-type,#newType')) e.target.setAttribute('data-saved-type',normType(e.target.value));
  },true);

  // Run once only on load. No observer loop.
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>ensureCategoryOptions(document));
  else ensureCategoryOptions(document);
})();
