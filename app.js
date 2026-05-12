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
   RESTORE PACK: V35 restores features removed after V34
   - Live ayah preview in Add/Edit
   - Color preview in Add/Edit
   - Visual inline compare
   - Improved lock icon
   - Floating/draggable windows
   - Merge groups
   - Duplicate detection
   - Auto-generate title
   - Quran-reference smart search in Add/Edit
   Version: restore-v35-20260512-01
========================================================= */
(function(){
  if(window.__RESTORE_V35__) return;
  window.__RESTORE_V35__ = true;

  const TYPE_LABELS = {normal:'عادي', shared:'مشترك', diff:'اختلاف', addition:'زيادة', unique:'فريدة'};
  const DEFAULT_COLOR = '#1A4A7E';
  const V35_COLORS = ['#1A4A7E','#0D47A1','#2563EB','#007AFF','#1B5E30','#34C759','#4CAF50','#C9A84C','#B45309','#FF9500','#B00000','#E60000','#FF3B30','#6D28D9','#7C3AED','#0F766E','#32D3C8','#17212B','#3A4A60','#8A5C00'];

  function t(v){ return v===undefined || v===null ? '' : String(v); }
  function esc(v){ return t(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function bool(v){ return v===true || v==='true' || v===1 || v==='1'; }
  function getAllGroups(){ return (typeof DATA !== 'undefined' && Array.isArray(DATA)) ? DATA : []; }
  function names(){ return typeof SURAH_NAMES !== 'undefined' ? SURAH_NAMES : (typeof getDefaultSurahNames==='function'?getDefaultSurahNames():{}); }
  function surahNoByName(name){ const ns=names(); name=t(name).trim(); for(const n in ns){ if(t(ns[n]).trim()===name) return Number(n); } return 9999; }
  function ayahNo(v){ const n=Number(t(v).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d))); return isNaN(n)?9999:n; }
  function getVerseText(v){ return (v && Array.isArray(v.parts)) ? v.parts.map(p=>t(p.text)).join(' ') : ''; }
  function normArabic(v){
    return t(v)
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
      .replace(/[إأآٱا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'')
      .replace(/\s+/g,' ').trim();
  }
  function currentPaletteColor(i){ return V35_COLORS[Math.abs(Number(i)||0)%V35_COLORS.length]; }
  function saveRefresh(){ if(typeof masterSave==='function') masterSave(); if(typeof buildSurahFilterBar==='function') buildSurahFilterBar(); if(typeof applyAllFilters==='function') applyAllFilters(); else if(typeof render==='function') render(getAllGroups()); }

  /* ---------- Floating / draggable modal windows ---------- */
  function makeModalDraggable(modal){
    if(!modal || modal.dataset.v35Draggable==='1') return;
    const header = modal.querySelector('.modal-header');
    if(!header) return;
    modal.dataset.v35Draggable='1';
    header.classList.add('v35-drag-handle');
    let dragging=false, startX=0, startY=0, startLeft=0, startTop=0;
    function point(e){ const p=e.touches?e.touches[0]:e; return {x:p.clientX,y:p.clientY}; }
    function down(e){
      if(e.target.closest('button,input,select,textarea,[contenteditable="true"]')) return;
      const p=point(e); const r=modal.getBoundingClientRect();
      dragging=true; startX=p.x; startY=p.y; startLeft=r.left; startTop=r.top;
      modal.classList.add('v35-floating-modal');
      modal.style.left=startLeft+'px'; modal.style.top=startTop+'px'; modal.style.right='auto'; modal.style.margin='0'; modal.style.transform='none';
      document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
      document.addEventListener('touchmove',move,{passive:false}); document.addEventListener('touchend',up);
    }
    function move(e){
      if(!dragging) return; if(e.cancelable) e.preventDefault();
      const p=point(e), w=window.innerWidth, h=window.innerHeight, r=modal.getBoundingClientRect();
      let l=startLeft+(p.x-startX), top=startTop+(p.y-startY);
      l=Math.max(8,Math.min(l,w-r.width-8)); top=Math.max(8,Math.min(top,h-60));
      modal.style.left=l+'px'; modal.style.top=top+'px';
    }
    function up(){ dragging=false; document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up); document.removeEventListener('touchmove',move); document.removeEventListener('touchend',up); }
    header.addEventListener('mousedown',down); header.addEventListener('touchstart',down,{passive:true});
  }
  function makeAllModalsDraggable(){ document.querySelectorAll('.modal').forEach(makeModalDraggable); }
  new MutationObserver(()=>makeAllModalsDraggable()).observe(document.body,{childList:true,subtree:true});
  setTimeout(makeAllModalsDraggable,500);

  /* ---------- Live preview + color preview ---------- */
  function colorControlHtml(id, value){
    const color=value || DEFAULT_COLOR;
    return `<div class="v35-color-row"><label>لون المجموعة</label><input id="${id}" class="v35-color-picker" type="color" value="${esc(color)}" oninput="v35UpdateColorPreview('${id}')"><span id="${id}Preview" class="v35-color-preview" style="background:${esc(color)}">معاينة اللون</span></div>`;
  }
  window.v35UpdateColorPreview=function(id){ const inp=document.getElementById(id), p=document.getElementById(id+'Preview'); if(inp&&p){ p.style.background=inp.value; p.textContent='معاينة اللون '+inp.value; } };
  function ensureAddEnhancements(){
    const title=document.getElementById('newTitle'); if(!title) return;
    if(!document.getElementById('newColor')) title.insertAdjacentHTML('afterend', colorControlHtml('newColor', currentPaletteColor(getAllGroups().length)));
    if(!document.getElementById('v35AddAutoTitleBtn')) title.insertAdjacentHTML('afterend','<button id="v35AddAutoTitleBtn" type="button" class="v35-mini-action" onclick="v35AutoGenerateAddTitle()">توليد عنوان تلقائي</button>');
    const prev=document.getElementById('ayahPreview');
    if(prev && !document.getElementById('v35AddLivePreview')) prev.insertAdjacentHTML('afterend','<div id="v35AddLivePreview" class="v35-live-preview">معاينة مباشرة للآية المختارة</div>');
    ensureQuranSearch('add');
    v35UpdateAddLivePreview();
  }
  window.v35UpdateAddLivePreview=function(){
    const preview=document.getElementById('ayahPreview'), box=document.getElementById('v35AddLivePreview'), type=document.getElementById('newType')?.value||'normal';
    if(box && preview) box.innerHTML = `<b>معاينة مباشرة:</b><div class="verse-text"><span class="${esc(type)}">${esc(preview.value)}</span></div>`;
  };
  const oldPreviewSelectedAyah = window.previewSelectedAyah;
  window.previewSelectedAyah=function(){ if(typeof oldPreviewSelectedAyah==='function') oldPreviewSelectedAyah.apply(this,arguments); setTimeout(v35UpdateAddLivePreview,10); };
  document.addEventListener('input',e=>{ if(e.target && (e.target.id==='selectedPart'||e.target.id==='newType')) v35UpdateAddLivePreview(); });

  window.v35AutoGenerateAddTitle=function(){
    const title=document.getElementById('newTitle'); if(!title) return;
    const list=(window.draftVerses||draftVerses||[]);
    const surahs=[...new Set(list.map(v=>v.surah).filter(Boolean))];
    const ayahs=list.map(v=>v.ayah).filter(Boolean);
    title.value = list.length ? `متشابه ${surahs.join(' / ')} — ${ayahs.join('، ')}` : 'متشابه جديد';
  };

  const oldOpenAdd=window.openAddModal;
  window.openAddModal=function(){ const r=typeof oldOpenAdd==='function'?oldOpenAdd.apply(this,arguments):undefined; setTimeout(ensureAddEnhancements,80); return r; };

  const oldCreate=window.createNewGroup;
  window.createNewGroup=function(){
    if(!document.getElementById('newTitle') || !document.getElementById('newColor')) return typeof oldCreate==='function'?oldCreate.apply(this,arguments):undefined;
    const title=document.getElementById('newTitle').value.trim();
    const color=document.getElementById('newColor').value || currentPaletteColor(getAllGroups().length);
    const before=getAllGroups().length;
    const r=typeof oldCreate==='function'?oldCreate.apply(this,arguments):undefined;
    const data=getAllGroups();
    if(data.length>before){ data[data.length-1].color=color; data[data.length-1].headerColor=color; saveRefresh(); }
    return r;
  };

  function ensureEditEnhancements(){
    const editTitle=document.getElementById('editTitle'); if(!editTitle || editTitle.dataset.v35Enhanced==='1') { ensureQuranSearch('edit'); return; }
    editTitle.dataset.v35Enhanced='1';
    const g=getAllGroups()[editGroupIndex] || {};
    editTitle.insertAdjacentHTML('afterend','<button id="v35EditAutoTitleBtn" type="button" class="v35-mini-action" onclick="v35AutoGenerateEditTitle()">توليد عنوان تلقائي</button>'+colorControlHtml('editColor', g.color||g.headerColor||DEFAULT_COLOR));
    ensureQuranSearch('edit');
    renderEditLivePreviews();
  }
  window.v35AutoGenerateEditTitle=function(){
    const title=document.getElementById('editTitle'); if(!title) return;
    const verses=typeof collectEditVersesFromDOM==='function'?collectEditVersesFromDOM():[];
    const surahs=[...new Set(verses.map(v=>v.surah).filter(Boolean))];
    const ayahs=verses.map(v=>v.ayah).filter(Boolean);
    title.value = verses.length ? `متشابه ${surahs.join(' / ')} — ${ayahs.join('، ')}` : 'متشابه جديد';
  };
  function renderEditLivePreviews(){
    document.querySelectorAll('#editVersesBox .edit-verse-card').forEach((card,i)=>{
      if(!card.querySelector('.v35-edit-live-preview')){
        const actions=card.querySelector('.ayah-fill-actions') || card.querySelector('.edit-parts-box');
        if(actions) actions.insertAdjacentHTML('afterend',`<div class="v35-edit-live-preview" id="v35EditLivePreview${i}"></div>`);
      }
      const v=(typeof collectEditVersesFromDOM==='function'?collectEditVersesFromDOM():[])[i];
      const box=card.querySelector('.v35-edit-live-preview');
      if(box && v) box.innerHTML=`<b>معاينة مباشرة:</b><div class="verse-text">${(v.parts||[]).map(p=>`<span class="${esc(p.type||'normal')}">${esc(p.text)}</span>`).join(' ')}</div>`;
    });
  }
  const oldRenderEdit=window.renderEditVerses;
  window.renderEditVerses=function(){ const r=typeof oldRenderEdit==='function'?oldRenderEdit.apply(this,arguments):undefined; setTimeout(renderEditLivePreviews,20); return r; };
  const oldOpenEdit=window.openEditGroup;
  window.openEditGroup=function(){ const r=typeof oldOpenEdit==='function'?oldOpenEdit.apply(this,arguments):undefined; setTimeout(ensureEditEnhancements,120); return r; };
  document.addEventListener('input',e=>{ if(e.target && (e.target.classList.contains('edit-part-text')||e.target.classList.contains('edit-part-type'))) setTimeout(renderEditLivePreviews,20); });

  /* ---------- Smart quran-reference search in Add/Edit ---------- */
  function allAyahs(){
    const out=[], ns=names();
    if(typeof getSurahAyahs!=='function') return out;
    Object.keys(ns).forEach(no=>{ (getSurahAyahs(no)||[]).forEach(a=>out.push({surahNo:Number(no), surah:a.surah||ns[no], ayahNo:a.ayahNo, text:a.text||''})); });
    return out;
  }
  function quranSearch(q){
    const exact=t(q).trim(), nq=normArabic(q); if(!exact) return [];
    const rows=allAyahs().map(a=>{ const text=t(a.text); const exactHit=text.includes(exact); const normHit=normArabic(text).includes(nq); return {...a, exactHit, normHit}; })
      .filter(a=>a.exactHit||a.normHit)
      .sort((a,b)=>(b.exactHit-a.exactHit)||a.surahNo-b.surahNo||Number(a.ayahNo)-Number(b.ayahNo));
    return rows.slice(0,80);
  }
  function ensureQuranSearch(mode){
    const body=document.querySelector(mode==='add'?'#addModal .modal-body':'#editModal .modal-body'); if(!body) return;
    const id=mode==='add'?'v35AddQuranSearch':'v35EditQuranSearch';
    if(document.getElementById(id)) return;
    const html=`<div id="${id}" class="v35-quran-search-box" data-mode="${mode}">
      <div class="v35-search-title">بحث في quran-reference.js</div>
      <input class="full-input v35-quran-search-input" placeholder="اكتب كلمة أو جزء من آية — يتجاهل التشكيل والهمزات..." oninput="v35RunQuranSearch('${mode}', this.value)">
      <div class="v35-search-hint">الترتيب: النتائج المطابقة حرفيًا أولًا، ثم المطابقة بعد التطبيع.</div>
      <div id="${id}Results" class="v35-quran-results"></div>
    </div>`;
    body.insertAdjacentHTML('afterbegin',html);
  }
  window.v35RunQuranSearch=function(mode,q){
    const res=document.getElementById(mode==='add'?'v35AddQuranSearchResults':'v35EditQuranSearchResults'); if(!res) return;
    const rows=quranSearch(q);
    res.innerHTML = rows.length ? rows.map(a=>{
      const key=`${a.surahNo}:${a.ayahNo}`;
      return `<div class="v35-result-row" data-key="${key}">
        <label class="v35-result-check"><input type="checkbox" onchange="v35ToggleSearchAyah('${mode}', this, ${a.surahNo}, ${a.ayahNo})"> إضافة/إزالة</label>
        <div class="v35-result-meta"><b>${esc(a.surah)}</b> <span>${esc(a.ayahNo)}</span> ${a.exactHit?'<em>مطابق حرفيًا</em>':'<em>مطابق بعد التطبيع</em>'}</div>
        <div class="v35-result-text">${esc(a.text)}</div>
        <div class="v35-result-actions"><button type="button" onclick="v35AddSearchAyah('${mode}', ${a.surahNo}, ${a.ayahNo}, 'full')">Add full ayah</button><button type="button" onclick="v35AddSearchAyah('${mode}', ${a.surahNo}, ${a.ayahNo}, 'selected')">Add selected text</button></div>
      </div>`;
    }).join('') : '<div class="v35-no-results">لا توجد نتائج</div>';
  };
  function buildVerseFromAyah(surahNo, ayahNo, selectedText){
    const a=typeof getAyah==='function'?getAyah(surahNo, ayahNo):null; if(!a) return null;
    return {surah:a.surah, ayah:a.ayahNo, label:'', parts:[{type:'normal', text:selectedText||a.text}]};
  }
  function selectedTextOrFull(a){ const s=(window.getSelection&&window.getSelection().toString().trim())||''; return s || (a?a.text:''); }
  window.v35AddSearchAyah=function(mode,surahNo,ayahNo,kind){
    const a=typeof getAyah==='function'?getAyah(surahNo, ayahNo):null; if(!a) return;
    const text=kind==='selected'?selectedTextOrFull(a):a.text;
    const verse=buildVerseFromAyah(surahNo,ayahNo,text); if(!verse) return;
    if(mode==='add'){
      draftVerses.push(verse); if(typeof renderDraftVerses==='function') renderDraftVerses(); v35AutoGenerateAddTitle();
    } else {
      const verses=typeof collectEditVersesFromDOM==='function'?collectEditVersesFromDOM():[]; verses.push(verse); if(typeof renderEditVerses==='function') renderEditVerses(verses);
    }
  };
  window.v35ToggleSearchAyah=function(mode,chk,surahNo,ayahNo){
    if(chk.checked){ v35AddSearchAyah(mode,surahNo,ayahNo,'full'); return; }
    if(mode==='add'){
      const a=typeof getAyah==='function'?getAyah(surahNo, ayahNo):null; if(!a) return;
      const idx=draftVerses.findIndex(v=>t(v.surah)===t(a.surah)&&Number(v.ayah)===Number(a.ayahNo)); if(idx>-1){ draftVerses.splice(idx,1); if(typeof renderDraftVerses==='function') renderDraftVerses(); }
    } else {
      const a=typeof getAyah==='function'?getAyah(surahNo, ayahNo):null; if(!a) return;
      const verses=(typeof collectEditVersesFromDOM==='function'?collectEditVersesFromDOM():[]).filter(v=>!(t(v.surah)===t(a.surah)&&Number(v.ayah)===Number(a.ayahNo)));
      if(typeof renderEditVerses==='function') renderEditVerses(verses);
    }
  };

  /* ---------- Lock icon improved + lock protection ---------- */
  window.v35ToggleLock=function(groupId){ const g=(typeof findGroupById==='function'?findGroupById(groupId):getAllGroups().find(x=>Number(x.id)===Number(groupId))); if(!g) return; g.locked=!bool(g.locked); saveRefresh(); };
  function lockBtn(g){ const locked=bool(g.locked); return `<button class="group-status-btn lock-btn ${locked?'active':''}" type="button" onclick="event.stopPropagation(); v35ToggleLock(${Number(g.id)})" title="${locked?'مقفلة - اضغط لفتح القفل':'مفتوحة - اضغط للقفل'}">${locked?'🔒':'🔓'}</button>`; }
  const oldGbCard=window.gbGroupCard;
  if(typeof oldGbCard==='function'){
    window.gbGroupCard=function(g){
      let html=oldGbCard(g);
      html=html.replace('<article class="group', `<article class="group${bool(g.locked)?' is-locked':''}`);
      html=html.replace('<div class="group-side">', `<div class="group-side">${lockBtn(g)}<button class="group-status-btn compare-btn" type="button" onclick="event.stopPropagation(); v35CompareGroupInline(${Number(g.id)})" title="مقارنة مرئية">≋</button>`);
      return html;
    };
  }
  const oldSaveEdit=window.saveEditGroup;
  window.saveEditGroup=function(){
    const g=getAllGroups()[editGroupIndex]; if(g && bool(g.locked)){ alert('هذه المجموعة مقفلة. افتح القفل قبل التعديل.'); return; }
    const color=document.getElementById('editColor')?.value;
    const idx=editGroupIndex;
    const r=typeof oldSaveEdit==='function'?oldSaveEdit.apply(this,arguments):undefined;
    if(color && getAllGroups()[idx]){ getAllGroups()[idx].color=color; getAllGroups()[idx].headerColor=color; saveRefresh(); }
    return r;
  };
  const oldDelete=window.deleteEditGroup;
  window.deleteEditGroup=function(){ const g=getAllGroups()[editGroupIndex]; if(g && bool(g.locked)){ alert('هذه المجموعة مقفلة. افتح القفل قبل الحذف.'); return; } return typeof oldDelete==='function'?oldDelete.apply(this,arguments):undefined; };

  /* ---------- Visual inline comparison ---------- */
  function tokenize(s){ return normArabic(s).split(/\s+/).filter(Boolean); }
  function diffVisual(base, other){
    const b=new Set(tokenize(base));
    return t(other).split(/(\s+)/).map(tok=>{ if(/^\s+$/.test(tok)) return tok; return b.has(normArabic(tok))?`<span class="v35-same">${esc(tok)}</span>`:`<span class="v35-diff">${esc(tok)}</span>`; }).join('');
  }
  window.v35CompareGroupInline=function(groupId){
    const card=document.querySelector(`.group[data-group-id="${groupId}"]`); const g=(typeof findGroupById==='function'?findGroupById(groupId):getAllGroups().find(x=>Number(x.id)===Number(groupId))); if(!card||!g) return;
    let panel=card.querySelector('.v35-compare-panel'); if(panel){ panel.remove(); return; }
    const verses=g.verses||[]; const base=getVerseText(verses[0]||{});
    panel=document.createElement('div'); panel.className='v35-compare-panel';
    panel.innerHTML=`<div class="v35-compare-title">مقارنة مرئية داخلية <span class="v35-same">مشترك</span> <span class="v35-diff">مختلف</span></div>` + verses.map((v,i)=>`<div class="v35-compare-line"><b>${esc(v.surah)} ${esc(v.ayah)}</b><div>${i===0?`<span class="v35-base">${esc(getVerseText(v))}</span>`:diffVisual(base,getVerseText(v))}</div></div>`).join('');
    (card.querySelector('.group-body')||card).appendChild(panel); card.classList.add('open');
  };

  /* ---------- Merge groups ---------- */
  function ensureMergeModal(){
    if(document.getElementById('v35MergeModal')) return;
    const m=document.createElement('div'); m.id='v35MergeModal'; m.className='modal-backdrop';
    m.innerHTML=`<div class="modal"><div class="modal-header"><h2>دمج المجموعات</h2><button class="close-btn" onclick="v35CloseMergeModal()">×</button></div><div class="modal-body"><p class="v35-search-hint">اختر المجموعة الأساسية ثم المجموعة التي سيتم دمجها داخلها. سيتم نقل الآيات والملاحظات ثم حذف المجموعة الثانية وإعادة الترقيم.</p><label>المجموعة الأساسية</label><select id="v35MergeA" class="full-input"></select><label>المجموعة المراد دمجها</label><select id="v35MergeB" class="full-input"></select></div><div class="modal-footer"><button class="primary-btn" onclick="v35DoMergeGroups()">دمج الآن</button><button onclick="v35CloseMergeModal()">إغلاق</button></div></div>`;
    document.body.appendChild(m);
  }
  function fillGroupSelects(){ const opts=getAllGroups().map(g=>`<option value="${Number(g.id)}">${esc(g.id)} - ${esc(g.title)}</option>`).join(''); ['v35MergeA','v35MergeB'].forEach(id=>{const s=document.getElementById(id); if(s)s.innerHTML=opts;}); }
  window.v35OpenMergeModal=function(){ ensureMergeModal(); fillGroupSelects(); document.getElementById('v35MergeModal').classList.add('open'); setTimeout(makeAllModalsDraggable,20); };
  window.v35CloseMergeModal=function(){ document.getElementById('v35MergeModal')?.classList.remove('open'); };
  window.v35DoMergeGroups=function(){
    const aId=Number(document.getElementById('v35MergeA')?.value), bId=Number(document.getElementById('v35MergeB')?.value); if(!aId||!bId||aId===bId){alert('اختر مجموعتين مختلفتين');return;}
    const data=getAllGroups(), a=data.find(g=>Number(g.id)===aId), b=data.find(g=>Number(g.id)===bId); if(!a||!b)return;
    if(bool(a.locked)||bool(b.locked)){alert('لا يمكن دمج مجموعة مقفلة. افتح القفل أولًا.');return;}
    a.verses=[...(a.verses||[]),...(b.verses||[])]; a.surahs=[...new Set([...(a.surahs||[]),...(b.surahs||[])])];
    if(b.note) a.note=[a.note,b.note].filter(Boolean).join('<br>'); if(b.unote) a.unote=[a.unote,b.unote].filter(Boolean).join('<br>');
    const idx=data.indexOf(b); if(idx>-1) data.splice(idx,1); data.forEach((g,i)=>g.id=i+1); v35CloseMergeModal(); saveRefresh();
  };

  /* ---------- Duplicate detection ---------- */
  function groupKey(g){ return (g.verses||[]).map(v=>`${v.surah}:${v.ayah}`).sort().join('|'); }
  window.v35OpenDuplicates=function(){
    const buckets={}; getAllGroups().forEach(g=>{ const keys=[normArabic(g.title), groupKey(g)].filter(Boolean); keys.forEach(k=>{buckets[k]=buckets[k]||[]; buckets[k].push(g);}); });
    const dups=Object.values(buckets).filter(arr=>arr.length>1);
    let m=document.getElementById('v35DupModal'); if(!m){ m=document.createElement('div'); m.id='v35DupModal'; m.className='modal-backdrop'; document.body.appendChild(m); }
    m.innerHTML=`<div class="modal edit-modal"><div class="modal-header"><h2>كشف التكرار</h2><button class="close-btn" onclick="document.getElementById('v35DupModal').classList.remove('open')">×</button></div><div class="modal-body">${dups.length?dups.map(arr=>`<div class="v35-dup-block">${arr.map(g=>`<div><b>${esc(g.id)}</b> - ${esc(g.title)} <button onclick="openEditGroup(${Number(g.id)})">تعديل</button></div>`).join('')}</div>`).join(''):'<div class="v35-no-results">لا توجد مجموعات مكررة حسب العنوان أو نفس الآيات.</div>'}</div><div class="modal-footer"><button onclick="document.getElementById('v35DupModal').classList.remove('open')">إغلاق</button></div></div>`;
    m.classList.add('open'); setTimeout(makeAllModalsDraggable,20);
  };

  /* ---------- Add management buttons beside main search ---------- */
  function ensureToolbarButtons(){
    const panel=document.querySelector('.search-panel'); if(!panel || document.getElementById('v35MergeBtn')) return;
    const btns=document.createElement('span'); btns.className='v35-toolbar-buttons';
    btns.innerHTML='<button id="v35MergeBtn" type="button" onclick="v35OpenMergeModal()">دمج المجموعات</button><button id="v35DupBtn" type="button" onclick="v35OpenDuplicates()">كشف التكرار</button>';
    panel.appendChild(btns);
  }
  function init(){ ensureToolbarButtons(); ensureAddEnhancements(); ensureEditEnhancements(); makeAllModalsDraggable(); }
  window.addEventListener('DOMContentLoaded',()=>setTimeout(init,900));
  setTimeout(init,1400);
})();
/* END RESTORE PACK V35 */
