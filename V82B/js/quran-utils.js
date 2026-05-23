function normalizeQuranSearchText(v){return safeText(v).toLowerCase()
  .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
  .replace(/[إأآٱا]/g,'ا').replace(/[ؤ]/g,'و').replace(/[ئ]/g,'ي')
  .replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ـ/g,'').replace(/\s+/g,' ').trim()}

function getSelectedTextareaText(id){let el=document.getElementById(id);if(!el)return '';let a=el.selectionStart||0,b=el.selectionEnd||0;return (a!==b)?el.value.substring(a,b):''}

function surahNames(){return typeof SURAH_NAMES!=='undefined'?SURAH_NAMES:{1:'الفاتحة',2:'البقرة',3:'آل عمران',4:'النساء',5:'المائدة',6:'الأنعام',7:'الأعراف',8:'الأنفال',9:'التوبة',10:'يونس',11:'هود',12:'يوسف',13:'الرعد',14:'إبراهيم',15:'الحجر',16:'النحل',17:'الإسراء',18:'الكهف',19:'مريم',20:'طه',21:'الأنبياء',22:'الحج',23:'المؤمنون',24:'النور',25:'الفرقان',26:'الشعراء',27:'النمل',28:'القصص',29:'العنكبوت',30:'الروم',31:'لقمان',32:'السجدة',33:'الأحزاب',34:'سبأ',35:'فاطر',36:'يس',37:'الصافات',38:'ص',39:'الزمر',40:'غافر',41:'فصلت',42:'الشورى',43:'الزخرف',44:'الدخان',45:'الجاثية',46:'الأحقاف',47:'محمد',48:'الفتح',49:'الحجرات',50:'ق',51:'الذاريات',52:'الطور',53:'النجم',54:'القمر',55:'الرحمن',56:'الواقعة',57:'الحديد',58:'المجادلة',59:'الحشر',60:'الممتحنة',61:'الصف',62:'الجمعة',63:'المنافقون',64:'التغابن',65:'الطلاق',66:'التحريم',67:'الملك',68:'القلم',69:'الحاقة',70:'المعارج',71:'نوح',72:'الجن',73:'المزمل',74:'المدثر',75:'القيامة',76:'الإنسان',77:'المرسلات',78:'النبأ',79:'النازعات',80:'عبس',81:'التكوير',82:'الانفطار',83:'المطففين',84:'الانشقاق',85:'البروج',86:'الطارق',87:'الأعلى',88:'الغاشية',89:'الفجر',90:'البلد',91:'الشمس',92:'الليل',93:'الضحى',94:'الشرح',95:'التين',96:'العلق',97:'القدر',98:'البينة',99:'الزلزلة',100:'العاديات',101:'القارعة',102:'التكاثر',103:'العصر',104:'الهمزة',105:'الفيل',106:'قريش',107:'الماعون',108:'الكوثر',109:'الكافرون',110:'النصر',111:'المسد',112:'الإخلاص',113:'الفلق',114:'الناس'}}

function getSurahNo(n){let names=surahNames();for(let no in names)if(normalize(names[no])===normalize(n))return Number(no);return 9999}

function qAyahs(){let arr=[];try{for(let s=1;s<=114;s++)(getSurahAyahs(s)||[]).forEach(a=>arr.push(a))}catch(e){}return arr}

function getRef(no,ay){try{return typeof getAyah==='function'?getAyah(no,ay):null}catch(e){return null}}

function getValidSurahNo(v){let n=parseInt(v,10);if(n>=1&&n<=114)return n;let g=getSurahNo(v);return g===9999?1:g}

function surahOptionsHtml(sel){let names=surahNames(),selected=getValidSurahNo(sel);return Object.keys(names).map(no=>`<option value="${no}" ${+no===+selected?'selected':''}>${no} - ${names[no]}</option>`).join('')}

function ayahOptionsHtml(no,sel){let arr=[];try{arr=getSurahAyahs(getValidSurahNo(no))||[]}catch(x){};let selected=parseInt(sel,10)||1;return (arr.length?arr:[{ayahNo:1}]).map(a=>`<option value="${a.ayahNo}" ${+a.ayahNo===+selected?'selected':''}>${a.ayahNo}</option>`).join('')}

function populateSurah(id,sel){let e=document.getElementById(id);if(e)e.innerHTML=surahOptionsHtml(sel)}

function populateAyah(id,no,sel){let e=document.getElementById(id);if(e)e.innerHTML=ayahOptionsHtml(no,sel)}

// ═══════════════════════════════════════════════════════════════
// Arabic Smart Fuzzy Search Engine — V82B
// ═══════════════════════════════════════════════════════════════

// 1. Normalize Arabic text for loose matching
function normalizeArabicLooseSearchText(v) {
  return String(v || '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // remove tashkeel
    .replace(/[إأآٱا]/g, 'ا')   // normalize alef variants
    .replace(/[ؤو]/g, 'و')       // normalize waw
    .replace(/[ئي]/g, 'ي')       // normalize ya
    .replace(/ى/g, 'ا')           // alef maqsura → alef
    .replace(/ة/g, 'ه')           // ta marbuta → ha
    .replace(/ء/g, '')             // drop hamza standalone
    .replace(/ـ/g, '')             // remove tatweel
    .replace(/\s+/g, ' ')
    .trim();
}

// 2. Split search query into meaningful words
function splitArabicSearchWords(q) {
  return normalizeArabicLooseSearchText(q)
    .split(/\s+/)
    .filter(w => w.length > 0);
}

// 3. Strip common Arabic prefixes to find root word
function stripArabicSearchPrefixes(word) {
  const prefixes = ['فال', 'وال', 'بال', 'كال', 'لل', 'ال', 'فب', 'وب', 'ف', 'و', 'ب', 'ك', 'ل', 'س'];
  for (const p of prefixes) {
    if (word.startsWith(p) && word.length > p.length + 2) {
      return word.slice(p.length);
    }
  }
  return word;
}

// 4. Generate search variants for a word
function generateArabicSearchVariants(word) {
  const n = normalizeArabicLooseSearchText(word);
  const stripped = stripArabicSearchPrefixes(n);
  const variants = new Set([word, n, stripped]);
  // Add prefix combinations
  for (const p of ['ف', 'و', 'ب', 'ك', 'ل']) {
    variants.add(p + n);
    variants.add(p + stripped);
  }
  // Add ال prefix
  variants.add('ال' + stripped);
  variants.add('ال' + n);
  return [...variants].filter(v => v.length > 1);
}

// 5. Levenshtein distance for fuzzy matching
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// 6. Allowed fuzzy distance based on word length
function getAllowedArabicDistance(word) {
  const l = word.length;
  if (l <= 3) return 0;
  if (l <= 5) return 1;
  if (l <= 8) return 2;
  return 3;
}

// 7. Build personal search pattern index from PERSONAL_DATA
let _personalSearchIndex = null;
function buildPersonalSearchPatternIndex() {
  _personalSearchIndex = new Set();
  try {
    const data = typeof PERSONAL_DATA !== 'undefined' ? PERSONAL_DATA : [];
    const types = ['shared', 'diff', 'diff2', 'diff3', 'addition', 'unique'];
    data.forEach(g => {
      (g.verses || []).forEach(v => {
        (v.parts || []).forEach(p => {
          if (types.includes(p.type)) {
            const words = splitArabicSearchWords(p.text || '');
            words.forEach(w => {
              const stripped = stripArabicSearchPrefixes(w);
              if (stripped.length > 2) _personalSearchIndex.add(stripped);
            });
          }
        });
      });
    });
  } catch (e) {}
  return _personalSearchIndex;
}

// 8. Get personal data search variants for a query word
function getPersonalArabicSearchVariants(word) {
  if (!_personalSearchIndex) buildPersonalSearchPatternIndex();
  const n = normalizeArabicLooseSearchText(word);
  const stripped = stripArabicSearchPrefixes(n);
  const results = [];
  _personalSearchIndex.forEach(pattern => {
    if (pattern.includes(stripped) || stripped.includes(pattern)) {
      results.push(pattern);
    }
  });
  return results;
}

// 9. Smart Arabic search score (0-100)
function smartArabicSearchScore(query, text) {
  if (!query || !text) return 0;
  const rawText = String(text);
  const rawQuery = String(query).trim();

  // Exact match
  if (rawText.includes(rawQuery)) return 100;

  const nText = normalizeArabicLooseSearchText(rawText);
  const nQuery = normalizeArabicLooseSearchText(rawQuery);

  // Normalized exact match
  if (nText.includes(nQuery)) return 90;

  const queryWords = splitArabicSearchWords(rawQuery);
  if (queryWords.length === 0) return 0;

  let totalScore = 0;

  for (const qWord of queryWords) {
    const nWord = normalizeArabicLooseSearchText(qWord);
    const stripped = stripArabicSearchPrefixes(nWord);
    const variants = generateArabicSearchVariants(qWord);
    const textWords = splitArabicSearchWords(rawText);
    let bestWordScore = 0;

    for (const tWord of textWords) {
      const nTWord = normalizeArabicLooseSearchText(tWord);
      const tStripped = stripArabicSearchPrefixes(nTWord);

      // Personal pattern match
      if (_personalSearchIndex && _personalSearchIndex.has(stripped) && _personalSearchIndex.has(tStripped)) {
        if (stripped === tStripped) { bestWordScore = Math.max(bestWordScore, 85); continue; }
      }

      // Variant / prefix match
      for (const v of variants) {
        if (nTWord === v || nTWord.includes(v) || v.includes(nTWord)) {
          bestWordScore = Math.max(bestWordScore, 80);
        }
      }

      // Stripped root match
      if (stripped.length > 2 && tStripped.length > 2) {
        if (tStripped.includes(stripped) || stripped.includes(tStripped)) {
          bestWordScore = Math.max(bestWordScore, 70);
        }
      }

      // Fuzzy distance match
      const allowed = getAllowedArabicDistance(nWord);
      if (allowed > 0) {
        const dist = levenshteinDistance(nWord, nTWord);
        if (dist <= allowed) {
          const score = Math.round(55 + ((allowed - dist) / allowed) * 15);
          bestWordScore = Math.max(bestWordScore, score);
        }
        // Also try stripped vs stripped
        const distStripped = levenshteinDistance(stripped, tStripped);
        if (distStripped <= allowed) {
          bestWordScore = Math.max(bestWordScore, 55);
        }
      }
    }

    totalScore += bestWordScore;
  }

  if(queryWords.length===0) return 0;
  // For multi-word: all words must match (min score approach)
  let wordScores=[];
  for(const qWord of queryWords){
    const nWord=normalizeArabicLooseSearchText(qWord);
    const stripped=stripArabicSearchPrefixes(nWord);
    const variants=generateArabicSearchVariants(qWord);
    const textWords=splitArabicSearchWords(rawText);
    let best=0;
    for(const tWord of textWords){
      const nT=normalizeArabicLooseSearchText(tWord);
      const tS=stripArabicSearchPrefixes(nT);
      for(const v of variants){if(nT===v||nT.includes(v)||v.includes(nT)){best=Math.max(best,80);}}
      if(stripped.length>2&&tS.length>2&&(tS.includes(stripped)||stripped.includes(tS))){best=Math.max(best,70);}
      const allowed=getAllowedArabicDistance(nWord);
      if(allowed>0){
        if(levenshteinDistance(nWord,nT)<=allowed)best=Math.max(best,55);
        if(levenshteinDistance(stripped,tS)<=allowed)best=Math.max(best,55);
      }
    }
    wordScores.push(best);
  }
  return Math.min(...wordScores);
}

// 10. Smart Arabic search match — returns true if score >= threshold
function smartArabicSearchMatch(query, text, threshold) {
  threshold = threshold || 55;
  return smartArabicSearchScore(query, text) >= threshold;
}

function smartArabicSearchMatch(query,text,threshold){try{threshold=threshold||50;return smartArabicSearchScore(query,text)>=threshold;}catch(e){return normalizeArabicLooseSearchText(text).includes(normalizeArabicLooseSearchText(query));}}
