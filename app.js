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
              ? `<div class="note">${cleanNoteLabel(g.note)}</div>`
              : ""
          }

          ${
            g.unote
              ? `<div class="unote">${cleanNoteLabel(g.unote)}</div>`
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
        <textarea id="editNote" class="ayah-preview"></textarea>

        <label>فائدة فريدة / إضافية</label>
        <textarea id="editUnote" class="ayah-preview"></textarea>
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
  document.getElementById("editNote").value = safeText(cleanNoteLabel(g.note));
  document.getElementById("editUnote").value = safeText(cleanNoteLabel(g.unote));

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
  const note = document.getElementById("editNote").value.trim();
  const unote = document.getElementById("editUnote").value.trim();
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
   FIX: FILTER NUMBERS + CLEAN TOOLBAR + NO SAVE POPUP
========================= */
const THEME_STORAGE_KEY="mutashabihat_ui_theme";const THEME_NAMES={"quran-classic":"Quran Classic","apple-health":"Apple Health Clean","bevel-night":"Bevel Night Metrics","serene-reader":"Serene Reader","memorization-contrast":"Memorization Contrast","manuscript-premium":"Manuscript Premium","pro-dashboard":"Professional Dashboard"};function applyTheme(t){const theme=THEME_NAMES[t]?t:"quran-classic";document.body.setAttribute("data-theme",theme);localStorage.setItem(THEME_STORAGE_KEY,theme);const s=document.getElementById("settingsThemeSelect");if(s)s.value=theme}function changeTheme(t){applyTheme(t)}function initializeTheme(){applyTheme(localStorage.getItem(THEME_STORAGE_KEY)||"quran-classic")}
const FONT_STORAGE_KEY="mutashabihat_font_preset";const FONT_PRESET_NAMES={"classic-quran":"Classic Quran — Amiri Quran + Cairo","modern-reader":"Modern Reader — Scheherazade + Tajawal","mobile-clear":"Mobile Clear — Noto Naskh + Readex Pro","dashboard-pro":"Dashboard Pro — Noto Naskh + IBM Plex","manuscript-style":"Manuscript Style — Amiri + Aref Ruqaa","qpc-nastaleeq":"QPC Nastaleeq — KFGQPCNastaleeq-Regular","surah-display":"Surah Display — surah-name-v4"};const AVAILABLE_FONT_LIST=["Amiri Quran","Scheherazade New","Noto Naskh Arabic","Cairo","Tajawal","IBM Plex Sans Arabic","Readex Pro","Reem Kufi","Aref Ruqaa","KFGQPCNastaleeq-Regular","surah-name-v4"];function applyFontPreset(p){const preset=FONT_PRESET_NAMES[p]?p:"classic-quran";document.body.setAttribute("data-font-preset",preset);localStorage.setItem(FONT_STORAGE_KEY,preset);const s=document.getElementById("settingsFontPresetSelect");if(s)s.value=preset}function changeFontPreset(p){applyFontPreset(p)}function initializeFontPreset(){applyFontPreset(localStorage.getItem(FONT_STORAGE_KEY)||"classic-quran")}
function openAppSettings(){ensureAppSettingsModal();fillAppSettingsForm();document.getElementById("appSettingsModal").classList.add("open")}function closeAppSettings(){document.getElementById("appSettingsModal")?.classList.remove("open")}function ensureAppSettingsModal(){if(document.getElementById("appSettingsModal"))return;const m=document.createElement("div");m.id="appSettingsModal";m.className="modal-backdrop";m.innerHTML=`<div class="modal edit-modal"><div class="modal-header"><h2>⚙ إعدادات التطبيق</h2><button class="close-btn" onclick="closeAppSettings()">×</button></div><div class="modal-body"><div class="settings-section"><h3>🎨 Theme / شكل الواجهة</h3><select id="settingsThemeSelect" class="theme-select-large" onchange="changeTheme(this.value)">${Object.keys(THEME_NAMES).map(k=>`<option value="${k}">${THEME_NAMES[k]}</option>`).join("")}</select></div><div class="settings-section"><h3>🔤 Font Style / نوع الخط</h3><select id="settingsFontPresetSelect" class="theme-select-large" onchange="changeFontPreset(this.value)">${Object.keys(FONT_PRESET_NAMES).map(k=>`<option value="${k}">${FONT_PRESET_NAMES[k]}</option>`).join("")}</select><div class="setting-note">Fonts: ${AVAILABLE_FONT_LIST.join("، ")}<br>Offline custom fonts path: fonts/KFGQPCNastaleeq-Regular.woff2 and fonts/surah-name-v4.woff2</div><div class="font-preview-box"><div class="font-preview-title">معاينة العنوان: متشابهات القرآن</div><div class="font-preview-surah">اسم السورة: البقرة</div><div class="font-preview-ayah">ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ</div><div class="font-preview-note">معاينة الملاحظات: يتم حفظ اختيار الخط تلقائيًا.</div></div></div><div class="settings-section"><h3>☁ GitHub Auto Sync</h3><label>Token</label><input id="settingsGhToken" class="full-input" type="password"><div class="settings-grid"><div><label>Owner</label><input id="settingsGhOwner" class="full-input"></div><div><label>Repo</label><input id="settingsGhRepo" class="full-input"></div></div><div class="settings-grid"><div><label>Branch</label><input id="settingsGhBranch" class="full-input" placeholder="main"></div><div><label>Path</label><input id="settingsGhPath" class="full-input" placeholder="data.js"></div></div><div class="settings-action-row"><button class="primary-btn" onclick="saveAppSettings()">حفظ</button><button onclick="syncToGitHub()">مزامنة الآن</button></div></div><div class="settings-section"><h3>💾 التخزين والنسخ الاحتياطي</h3><div class="settings-action-row"><button onclick="downloadDataJS()">📤 Export data.js</button><button onclick="linkDataFile()">🔗 Link data.js</button><button class="settings-warning" onclick="clearLocalStorage()">↺ Reset</button></div></div></div><div class="modal-footer"><button class="primary-btn" onclick="saveAppSettings()">حفظ</button><button onclick="closeAppSettings()">إغلاق</button></div></div>`;document.body.appendChild(m)}function fillAppSettingsForm(){const gh=typeof loadGHSettings==="function"?loadGHSettings():{};const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v||""};set("settingsThemeSelect",localStorage.getItem(THEME_STORAGE_KEY)||"quran-classic");set("settingsFontPresetSelect",localStorage.getItem(FONT_STORAGE_KEY)||"classic-quran");set("settingsGhToken",gh.token);set("settingsGhOwner",gh.owner);set("settingsGhRepo",gh.repo);set("settingsGhBranch",gh.branch||"main");set("settingsGhPath",gh.path||"data.js")}function saveAppSettings(){applyTheme(document.getElementById("settingsThemeSelect")?.value||"quran-classic");applyFontPreset(document.getElementById("settingsFontPresetSelect")?.value||"classic-quran");const token=document.getElementById("settingsGhToken")?.value.trim()||"",owner=document.getElementById("settingsGhOwner")?.value.trim()||"",repo=document.getElementById("settingsGhRepo")?.value.trim()||"",branch=document.getElementById("settingsGhBranch")?.value.trim()||"main",path=document.getElementById("settingsGhPath")?.value.trim()||"data.js";if(token||owner||repo){if(!token||!owner||!repo){return}saveGHSettings({token,owner,repo,branch,path});updateGHBadge("ready")}closeAppSettings()}
let surahFilterPanelOpen=false,showOnlySurahsWithResults=true,activeSurahRange="all",surahFilterSearchText="";function getCountBadgeClass(c){if(!c)return"zero";if(c>=10)return"high";if(c>=4)return"medium";return"low"}function getRangeBounds(r){if(r==="1-30")return[1,30];if(r==="31-60")return[31,60];if(r==="61-90")return[61,90];if(r==="91-114")return[91,114];return[1,114]}function toggleSurahFilterPanel(){surahFilterPanelOpen=!surahFilterPanelOpen;document.getElementById("surahFilterPanel")?.classList.toggle("collapsed",!surahFilterPanelOpen);const b=document.getElementById("surahFilterToggleBtn");if(b)b.textContent=surahFilterPanelOpen?"إغلاق الفلتر ▴":"فتح الفلتر ▾"}function toggleOnlyWithResults(){showOnlySurahsWithResults=!showOnlySurahsWithResults;document.getElementById("onlyResultsBtn")?.classList.toggle("active",showOnlySurahsWithResults);renderSurahFilterButtons()}function runSurahFilterSearch(){surahFilterSearchText=document.getElementById("surahFilterSearch")?.value.trim()||"";renderSurahFilterButtons()}function setSurahRange(r){activeSurahRange=r||"all";document.querySelectorAll(".range-tab").forEach(b=>b.classList.toggle("active",b.dataset.range===activeSurahRange));renderSurahFilterButtons()}function buildSurahFilterBar(){renderSurahFilterButtons();updateSelectedSurahChip()}function renderSurahPill(no,name,count,cls){const active=selectedSurahFilter===name?"active":"",zero=count?"":"zero-count",bc=getCountBadgeClass(count);return`<button class="${cls||"pro-surah-pill"} ${active} ${zero}" data-surah="${escapeAttr(name)}" data-count="${count}" onclick="filterBySurah('${escapeAttr(name)}')"><span class="surah-no-badge">${Number(no).toLocaleString('en-US')}</span><span class="surah-name-text">${safeText(name)}</span><span class="surah-count-badge ${bc}">${Number(count).toLocaleString('en-US')}</span></button>`}function renderSurahFilterButtons(){const grid=document.getElementById("surahFilterGrid"),top=document.getElementById("topSurahGrid"),cnt=document.getElementById("surahFilterCount");if(!grid)return;const names=typeof SURAH_NAMES!=="undefined"?SURAH_NAMES:getDefaultSurahNames(),counts=getSurahGroupCounts(DATA),q=safeText(surahFilterSearchText).toLowerCase(),b=getRangeBounds(activeSurahRange);const items=Object.keys(names).map(no=>({no:+no,name:names[no],count:counts[names[no]]||0}));const topItems=items.filter(i=>i.count>0).sort((a,b)=>b.count-a.count||a.no-b.no).slice(0,8);if(top)top.innerHTML=topItems.map(i=>renderSurahPill(i.no,i.name,i.count,"top-surah-pill")).join("");const vis=items.filter(i=>i.no>=b[0]&&i.no<=b[1]&&(!showOnlySurahsWithResults||i.count>0||selectedSurahFilter===i.name)&&(!q||String(i.no).includes(q)||safeText(i.name).toLowerCase().includes(q)));grid.innerHTML=vis.length?vis.map(i=>renderSurahPill(i.no,i.name,i.count,"pro-surah-pill")).join(""):`<div class="no-results" style="padding:18px">لا توجد سور مطابقة</div>`;if(cnt)cnt.textContent="المعروض: "+vis.length+" من 114 سورة";updateSurahButtonAvailability(getSearchOnlyFilteredData())}function updateSelectedSurahChip(){const chip=document.getElementById("selectedSurahChip"),st=document.getElementById("filterStatus");if(!chip)return;if(!selectedSurahFilter){chip.classList.add("hidden");chip.innerHTML="";if(st)st.textContent="المعروض الآن: كل السور";return}const c=getSurahGroupCounts(DATA)[selectedSurahFilter]||0;chip.classList.remove("hidden");chip.innerHTML=`<span>السورة المختارة: ${safeText(selectedSurahFilter)}</span><span class="surah-count-badge ${getCountBadgeClass(c)}">${Number(c).toLocaleString('en-US')}</span><button onclick="clearSurahFilter()">×</button>`;if(st)st.textContent="المعروض الآن: "+selectedSurahFilter}function filterBySurah(s){selectedSurahFilter=s;updateSelectedSurahChip();renderSurahFilterButtons();applyAllFilters()}function clearSurahFilter(){selectedSurahFilter=null;updateSelectedSurahChip();renderSurahFilterButtons();applyAllFilters()}function updateSurahButtonAvailability(d){const a=new Set();(Array.isArray(d)?d:[]).forEach(g=>getTags(g).forEach(s=>a.add(s)));document.querySelectorAll(".pro-surah-pill,.top-surah-pill").forEach(btn=>btn.classList.toggle("no-match",!(a.has(btn.dataset.surah)||selectedSurahFilter===btn.dataset.surah)))}
function renderEditPart(p,vi,pi){const type=safeText((p&&p.type)||"normal"),text=p&&p.text!==undefined?p.text:"";return`<div class="edit-part-row" data-part-index="${pi}"><select class="edit-part-type"><option value="normal" ${type==="normal"?"selected":""}>normal</option><option value="shared" ${type==="shared"?"selected":""}>shared</option><option value="diff" ${type==="diff"?"selected":""}>diff</option><option value="addition" ${type==="addition"?"selected":""}>addition</option><option value="unique" ${type==="unique"?"selected":""}>unique</option></select><textarea class="edit-part-text" placeholder="اكتب جزء الآية هنا...">${escapeHtml(text)}</textarea><div class="part-action-bar"><button class="move-part-btn" onclick="moveEditPartUp(${vi},${pi})">↑ أعلى</button><button class="move-part-btn" onclick="moveEditPartDown(${vi},${pi})">↓ أسفل</button><button class="insert-part-btn" onclick="insertEditPartAbove(${vi},${pi})">+ فوق</button><button class="insert-part-btn" onclick="insertEditPartBelow(${vi},${pi})">+ تحت</button><button class="remove-small" onclick="removeEditPart(${vi},${pi})">حذف</button></div></div>`}function collectEditVersesFromDOM(){const cards=document.querySelectorAll("#editVersesBox .edit-verse-card"),verses=[];cards.forEach(card=>{const surah=(card.querySelector(".edit-surah")?.value||"").trim(),ayah=(card.querySelector(".edit-ayah")?.value||"").trim(),label=(card.querySelector(".edit-label")?.value||"").trim(),parts=[];card.querySelectorAll(".edit-part-row").forEach(row=>parts.push({type:row.querySelector(".edit-part-type")?.value||"normal",text:row.querySelector(".edit-part-text")?.value||""}));if(!parts.length)parts.push({type:"normal",text:""});if(surah&&ayah)verses.push({surah,ayah,label,parts})});return verses}function cleanEmptyEditPartsBeforeSave(vs){return vs.map(v=>{const parts=(v.parts||[]).filter(p=>safeText(p.text).trim()!=="");return{...v,parts:parts.length?parts:[{type:"normal",text:""}]}}).filter(v=>v.surah&&v.ayah&&(v.parts||[]).some(p=>safeText(p.text).trim()!==""))}function moveEditPartUp(vi,pi){const vs=collectEditVersesFromDOM();if(!vs[vi]||pi<=0)return;[vs[vi].parts[pi-1],vs[vi].parts[pi]]=[vs[vi].parts[pi],vs[vi].parts[pi-1]];renderEditVerses(vs)}function moveEditPartDown(vi,pi){const vs=collectEditVersesFromDOM();if(!vs[vi]||pi>=vs[vi].parts.length-1)return;[vs[vi].parts[pi+1],vs[vi].parts[pi]]=[vs[vi].parts[pi],vs[vi].parts[pi+1]];renderEditVerses(vs)}function insertEditPartAbove(vi,pi){const vs=collectEditVersesFromDOM();if(!vs[vi])return;vs[vi].parts.splice(pi,0,{type:"normal",text:""});renderEditVerses(vs)}function insertEditPartBelow(vi,pi){const vs=collectEditVersesFromDOM();if(!vs[vi])return;vs[vi].parts.splice(pi+1,0,{type:"normal",text:""});renderEditVerses(vs)}function addEditPart(vi){const vs=collectEditVersesFromDOM();if(!vs[vi])return;vs[vi].parts.push({type:"normal",text:""});renderEditVerses(vs)}function removeEditPart(vi,pi){const vs=collectEditVersesFromDOM();if(!vs[vi])return;vs[vi].parts.splice(pi,1);if(!vs[vi].parts.length)vs[vi].parts.push({type:"normal",text:""});renderEditVerses(vs)}function saveEditGroup(){if(editGroupIndex===null||editGroupIndex<0){return}const title=document.getElementById("editTitle").value.trim(),note=document.getElementById("editNote").value.trim(),unote=document.getElementById("editUnote").value.trim(),verses=cleanEmptyEditPartsBeforeSave(collectEditVersesFromDOM());if(!title||!verses.length)return;const oldGroup=DATA[editGroupIndex];DATA[editGroupIndex]={...oldGroup,title,surahs:[...new Set(verses.map(v=>v.surah).filter(Boolean))],verses,note,unote};closeEditModal();masterSave();buildSurahFilterBar();applyAllFilters()}

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