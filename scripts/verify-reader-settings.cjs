// Run against an isolated local build: READER_SETTINGS_URL=http://127.0.0.1:3237 PLAYWRIGHT_CHANNEL=chrome npm run test:reader-settings
// Every data API is intercepted; this verification never writes user data.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const root = process.cwd();
(async () => {
 const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined,headless:true});
 const context = await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'});
 await context.addInitScript(() => {
  localStorage.setItem('mushaf1441:reader-layer:v1','qiraat');
  window.wakeCalls = {request:0,release:0};
  Object.defineProperty(navigator,'wakeLock',{value:{request:async () => {window.wakeCalls.request++; const s = new EventTarget(); s.released=false; s.release=async()=>{s.released=true;window.wakeCalls.release++;s.dispatchEvent(new Event('release'));};return s;}}});
 });
 await context.route('**/api/**', async route => {
  const url = new URL(route.request().url());
  if(url.pathname.includes('qiraat') && !url.pathname.includes('resolved')) {
   const n=String(Number(url.searchParams.get('page')||17)).padStart(3,'0');
   const read=(dir)=>{try{return JSON.parse(fs.readFileSync(`${root}/packages/qiraat-core/fixtures/${dir}/page-${n}.json`,'utf8'));}catch{return []}};
   await route.fulfill({json:{variants:read('pages'),rulings:read('rulings'),rules:read('rules')}});
  } else await route.fulfill({json:{annotations:[],highlights:[],rows:[]}});
 });
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.READER_SETTINGS_URL || 'http://127.0.0.1:3237'}/mushaf-1441?page=17`);
 const marked=page.locator('[data-page-slot-current] [data-qiraat-marked="true"]');
 await expect(marked.first()).toBeVisible({timeout:60000});
 const before=await marked.count();
 async function settings(){await page.getByRole('button',{name:'القائمة والإعدادات',exact:true}).click();await page.getByRole('button',{name:'إعدادات القراءة والقراءات والمظهر'}).click();}
 await settings();
 const dialog=page.getByRole('dialog',{name:'إعدادات المصحف والقراءات'});
 await dialog.getByRole('checkbox',{name:'فرش الحروف فقط (إخفاء الأصول)',exact:true}).check();
 await expect.poll(()=>marked.count()).toBeLessThan(before);
 const farshCount=await marked.count();
 await dialog.getByRole('checkbox',{name:'فرش الحروف فقط (إخفاء الأصول)',exact:true}).uncheck();
 await dialog.getByRole('button',{name:'إخفاء الكل',exact:true}).click();
 await expect.poll(()=>marked.count()).toBe(farshCount);
 await dialog.getByRole('button',{name:'إظهار الكل',exact:true}).click();
 await expect.poll(()=>marked.count()).toBe(before);
 await dialog.getByRole('checkbox',{name:'إظهار التصنيف الفرعي في بطاقة الفرش',exact:true}).check();
 await dialog.getByRole('checkbox',{name:'إبقاء الشاشة مضاءة أثناء القراءة',exact:true}).check();
 await expect.poll(()=>page.evaluate(()=>window.wakeCalls.request)).toBe(1);
 await dialog.getByRole('checkbox',{name:'إبقاء الشاشة مضاءة أثناء القراءة',exact:true}).uncheck();
 await expect.poll(()=>page.evaluate(()=>window.wakeCalls.release)).toBe(1);
 await dialog.getByRole('checkbox',{name:'إخفاء الشريط السفلي تلقائيًا بعد ١٠ ثوانٍ',exact:true}).check();
 await dialog.getByRole('button',{name:'تم الحفظ والتطبيق',exact:true}).click();
 await page.getByRole('button',{name:'إغلاق القائمة',exact:true}).click();
 await expect(page.getByTestId('reader-footer')).toBeHidden({timeout:15000});
 await page.mouse.move(700,500);
 await expect(page.getByTestId('reader-footer')).toBeVisible();
 await page.reload();
 await settings();
 await expect(dialog.getByRole('checkbox',{name:'إظهار التصنيف الفرعي في بطاقة الفرش',exact:true})).toBeChecked();
 await expect(dialog.getByRole('checkbox',{name:'إخفاء الشريط السفلي تلقائيًا بعد ١٠ ثوانٍ',exact:true})).toBeChecked();
 await page.setViewportSize({width:390,height:844});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('checkbox',{name:'فرش الحروف فقط (إخفاء الأصول)',exact:true})).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);
 await page.keyboard.press('Escape');
 await expect(dialog).toBeHidden();
 expect(errors).toEqual([]);
 console.log(JSON.stringify({markedBefore:before,farshOnlyMarked:farshCount,persistence:true,footerHideAndRestore:true,wakeAcquireAndRelease:true,mobileNoOverflow:true,pageErrors:errors}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
