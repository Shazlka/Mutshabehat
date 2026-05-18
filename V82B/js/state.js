/* =========================
   V78 restored features from V72/V73 on clean V71 base
   ========================= */
const LAST_VIEW_KEY_V78='mutashabihat_v78_last_view';

/* V82 fixed automated-surahs lazy loader by Surah number */
const PERSONAL_KEY='mutashabihat_v69_personal_db';

const AUTO_KEY='mutashabihat_v69_auto_db';

const SETTINGS_KEY='mutashabihat_v69_settings';

let personalData=[], automatedData=[], activeDb=null, activeData=[];

let draftVerses=[], editGroupId=null, editVersesBuffer=[], selectedSurahFilter=null;

let editMode=localStorage.getItem('mutashabihat_v69_edit_mode')==='true';

let displayMode=localStorage.getItem('mutashabihat_v69_display_mode')||'original';

let editQuranSelectionMode='full';

let onlyWithResults=true, surahRange='all', advancedFilters={status:'all',kind:'',minScore:'',surah:''};

const LAST_SURAH_KEY_V78='mutashabihat_v78_last_surah';

let __modalScrollY_V78=0;

let __touchStartY_V78=0;

let __touchStartX_V78=0;

let __touchStartedOnHead_V78=false;
