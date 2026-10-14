# Proposed sub-category vocabulary (for review before anything is applied)

Rule: every entry gets a **category** (فرش / أصول) and a **clear sub-category**; there is no «أخرى». A sub-category is chosen
from the closed list below by keywords in the entry's own explanation/action text (first matching rule wins). If no rule matches,
the entry is not guessed: it goes to the human queue.

## الفرش (variant types) — one label per `variant_type`
| DB value | Label shown | Meaning |
|---|---|---|
| vowel | تشكيل (حركة) | same letters, different vowel/sukun/shadda |
| consonant | إبدال حرف | one letter replaced by another (يـ→تـ, س→ص…) |
| addition | زيادة حرف أو كلمة | the reading has more letters/words than Hafs |
| omission | حذف حرف أو كلمة | the reading has fewer letters/words than Hafs |
| word_form | تقديم وتأخير | same letters, different order |
| hamza | همز (تحقيق/تسهيل/إبدال/نقل) | the difference is in the hamza |
| orthography | خلاف في الرسم | the difference is in the written form of the word |
| sakt / naql / imalah / idgham / madd | سكت / نقل / إمالة / إدغام / مد | performance differences filed as farsh |
| **word_change (new)** | **اختلاف كلمة** | a different word instead of Hafs's (replaces «أخرى» for the 242 entries that fit nothing above) |
The «أخرى» choice is removed from the editor and from the app.

## الأصول — sub-category per category (closed list)
| Category | Sub-categories (label) | Chosen by |
|---|---|---|
| ميم الجمع (USUL_MIM_JAM) | صلة ميم الجمع وصلاً · صلة بخلف · صلة مع الإشباع · ضم الميم ووصلها بواو · ترك الصلة (إسكان الميم) | «بخلف», «الإشباع», «واو لفظية», «ترك» |
| الممال والمقلل (IMALAH_TAQLIL) | إمالة · تقليل · إمالة هاء التأنيث وقفاً · إمالة وتقليل (وجهان) · فتح | «إمالة», «تقليل», «هاء التأنيث», both words |
| السكت والنقل (USUL_SAKT, USUL_NAQL) | سكت · نقل · ترك السكت (تحقيق) · سكت وترك السكت (وجهان) · سكت ونقل وتحقيق (أوجه) | «السكت», «النقل», «ترك», «وعدمه» |
| تحقيق الهمزة / وقف حمزة / تسهيل / إبدال (USUL_TAHQIQ, WAQF_HAMZA, USUL_TASHIL, USUL_IBDAL, TAGHYIR_HAMZ) | تحقيق الهمزة · تسهيل الهمزة · إبدال الهمزة · نقل حركة الهمزة · حذف الهمزة · تحقيق وصلاً وتسهيل وقفاً · تحقيق وصلاً وإبدال وقفاً · أوجه الوقف (تسهيل/إبدال/حذف) | the hamza verb in the action («تحقيق», «تسهيل», «إبدال», «نقل», «حذف») and «وصلاً/وقفاً» |
| الهمزتان من كلمة / من كلمتين | تسهيل الثانية مع الإدخال · تسهيل الثانية بلا إدخال · إبدال الثانية · إسقاط الأولى · تحقيق الهمزتين | «الإدخال», «إبدال», «إسقاط» |
| الإدغام (IDGHAM_SAGHIR, IDGHAM_KABIR) | إدغام صغير · إدغام كبير · إدغام <حرف> في <حرف> (when the text names the letters) | «صغير/كبير», «في» |
| ترك الغنة · الإخفاء | ترك الغنة · إخفاء · إسكان الميم مع الإخفاء | the text |
| ياءات الإضافة (YAAT_IDAFA) | فتح الياء · إسكان الياء | «فتح», «إسكان» |
| ياءات الزوائد (YAAT_ZAWAID) | إثبات الياء وصلاً · إثبات الياء وصلاً ووقفاً · إثبات الياء وقفاً · حذف الياء | «إثبات», «حذف», «وصلاً/وقفاً» |
| المد (MADD_BADAL, MADD_LIN) | مد البدل · تثليث مد البدل · مد اللين المهموز (توسط/طول) | the text |
| هاء الكناية (SILAT_HA) | صلة الهاء · ضم الهاء · إسكان الهاء (قصر) | «صلة», «ضم», «إسكان/قصر» |
| الترقيق والتغليظ (TARQIQ_RA, TAGHLIZ_LAM) | ترقيق الراء · تغليظ اللام · تغليظ اللام بعد الصاد أو الطاء أو الظاء | the text |
| الوقف على مرسوم الخط (WAQF_RASM) | الوقف بالهاء · الوقف بهاء السكت · الوقف بالياء | «بالهاء», «هاء السكت», «بالياء» |
| عد الآي (AYAH_COUNT) | عد الآية (يحدد حسب مدرسة العد) | school list |

## Where it is stored
* Farsh: the existing `variant_type` (+ the new `word_change`), shown with the labels above.
* Usul: new column `qiraat_ruling_details.sub_category` (Arabic label from the list), exported as `subCategory`; the iOS sheet and the web editor
  show «الفئة › الباب › التصنيف الفرعي». Entries whose text matches no rule keep it empty and are listed for review (never guessed).

## Please review
1. Are the labels above the terms you want (spelling, order, «إمالة وتقليل (وجهان)»…)?
2. Add, rename or remove any sub-category directly in this table; I apply exactly the list you approve.
