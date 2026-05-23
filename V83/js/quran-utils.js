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
