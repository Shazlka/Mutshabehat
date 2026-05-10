function safeText(value) {
  return value === undefined || value === null ? "" : String(value);
}

let selectedSurahFilter = null;
let draftVerses = [];
let editGroupIndex = null;

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

  buildSurahFilterBar();
  applyAllFilters();

  alert("تمت الإضافة داخل الصفحة. لتحفظها نهائيًا اضغط تحميل data.js واستبدل الملف القديم.");
}

/* =========================
   DOWNLOAD DATA.JS
========================= */

function downloadDataJS() {
  const content =
    "const DATA = " + JSON.stringify(DATA, null, 2) + ";";

  // Try normal download first
  try {
    const blob = new Blob([content], {
      type: "application/javascript;charset=utf-8"
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data.js";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(function () {
      showDataExportFallback(content);
    }, 800);

  } catch (e) {
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

  buildSurahFilterBar();
  applyAllFilters();

  alert("تم تعديل المجموعة داخل الصفحة. لتحفظ التعديل نهائيًا اضغط تحميل data.js واستبدل الملف القديم.");
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
    'هل أنت متأكد من حذف المجموعة:\n"' + safeText(g.title) + '"\n\nلا يمكن التراجع عن هذه العملية إلا بإغلاق الصفحة دون حفظ data.js.'
  );

  if (!confirmed) return;

  // Remove the group
  DATA.splice(editGroupIndex, 1);

  // Renumber all IDs sequentially
  DATA.forEach(function(group, i) {
    group.id = i + 1;
  });

  closeEditModal();
  buildSurahFilterBar();
  applyAllFilters();

  alert("تم حذف المجموعة وإعادة ترقيم البيانات. اضغط تحميل data.js لحفظ التغيير نهائيًا.");
}

/* =========================
   INITIAL LOAD
========================= */

window.addEventListener("DOMContentLoaded", function () {
  if (typeof DATA === "undefined") {
    const app = document.getElementById("app");

    if (app) {
      app.innerHTML =
        '<div class="group"><div class="group-body" style="display:block;color:red">خطأ: ملف data.js غير مقروء.</div></div>';
    }

    return;
  }

  buildSurahFilterBar();
  render(DATA);
  updateSurahButtonAvailability(DATA);
});