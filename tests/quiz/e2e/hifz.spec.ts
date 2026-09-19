import { test,expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
// This suite writes answers. Explicit isolated DB guard prevents accidental production testing.
const database=process.env.HIFZ_TEST_DATABASE
if(!database?.startsWith('hifz_validation_')) throw new Error('Set HIFZ_TEST_DATABASE to an isolated hifz_validation_* database before E2E.')
function answerId(id:string,correct:boolean) {
 if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid session ID')
 const sql=`select q.id||'|'||c.id from quiz_questions q join quiz_choices c on c.question_id=q.id where q.session_id='${id}' and q.answered_at is null and ${correct?'c.id=q.correct_choice_id':'c.id<>q.correct_choice_id'} order by q.position,c.choice_order limit 1`
 return execFileSync('docker',['exec','mutshabehat-db','psql','-U','postgres','-d',database!,'-Atc',sql],{encoding:'utf8'}).trim().split('|')
}
test('Yunus level4 twenty questions, refresh, mistakes and adaptive retest',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/test');await expect(page.getByRole('heading',{name:'اختبر حفظك',exact:true})).toBeVisible()
 await page.getByRole('region',{name:'أنواع الاختبار'}).getByRole('button',{name:/اختبار مخصص/}).click()
 await page.getByLabel('نطاق القرآن',{exact:true}).selectOption('single');await page.getByLabel('السورة',{exact:true}).selectOption('10')
 await page.getByLabel('المستوى',{exact:true}).selectOption('4');await page.getByLabel('عدد الأسئلة',{exact:true}).selectOption('20')
 const generated=page.waitForResponse(r=>r.url().endsWith('/api/quiz')&&r.request().method()==='POST')
 await page.getByRole('button',{name:'ابدأ الاختبار',exact:true}).click()
 const response=await generated;expect(response.status()).toBe(200);let session=await response.json()
 expect(session.questions).toHaveLength(20);expect(session.questions.every((q:{choices:unknown[]})=>q.choices.length===4)).toBe(true)
 expect(JSON.stringify(session)).not.toContain('correctChoiceId');expect(JSON.stringify(session.questions)).not.toContain('source')
 const originalId=session.id
 for(let i=0;i<20;i++) {
  await expect(page.getByTestId('quiz-choice')).toHaveCount(4)
  const [questionId,choiceId]=answerId(session.id,i%3!==0)
  const q=session.questions.find((v:{id:string})=>v.id===questionId)
  const ci=q.choices.findIndex((v:{id:string})=>v.id===choiceId)
  const saved=page.waitForResponse(r=>r.url().endsWith('/answer')&&r.request().method()==='POST')
  await page.getByTestId('quiz-choice').nth(ci).click();const savedResponse=await saved;expect(savedResponse.status()).toBe(200)
  session=await savedResponse.json()
  await expect(page.getByText(i%3!==0?'✓ صحيح':'✕ إجابة غير صحيحة',{exact:true})).toBeVisible()
  if(i===2){await page.reload();await expect(page.getByLabel('تقدم الاختبار')).toContainText('4 / 20')}
  else await page.getByRole('button',{name:i===19?'عرض النتيجة':'السؤال التالي',exact:true}).click()
 }
 await expect(page.getByRole('heading',{name:'النتيجة',exact:true})).toBeVisible();await expect(page.getByRole('paragraph').filter({hasText:/^65%$/})).toBeVisible()
 await page.getByRole('button',{name:/مراجعة الأخطاء/}).click();await expect(page.getByRole('region',{name:'مراجعة الأخطاء'})).toBeVisible()
 const retestResponse=page.waitForResponse(r=>r.url().endsWith('/api/quiz')&&r.request().method()==='POST')
 await page.getByRole('button',{name:'اختبرني في أخطائي',exact:true}).click()
 const retried=await retestResponse;expect(retried.status()).toBe(200);const next=await retried.json();expect(next.id).not.toBe(originalId)
 const weak=new Set(session.answers.filter((a:{isCorrect:boolean})=>!a.isCorrect).map((a:{questionId:string})=>session.questions.find((q:{id:string})=>q.id===a.questionId).ayahKey))
 const visibleTargets=next.questions.filter((q:{ayahKey:string})=>q.ayahKey)
 expect(visibleTargets.some((q:{ayahKey:string})=>weak.has(q.ayahKey))).toBe(true)
 await expect(page.getByTestId('quiz-choice')).toHaveCount(4)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 await page.screenshot({path:`test-results/hifz-${test.info().project.name}.png`,fullPage:true})
 expect(errors).toEqual([])
})
test('quick, Mutashabihat, daily reuse and history',async({page})=>{
 const modes=page.getByRole('region',{name:'أنواع الاختبار'})
 await page.goto('/test');await modes.getByRole('button',{name:/اختبار سريع/}).click();await expect(page.getByTestId('quiz-choice')).toHaveCount(4)
 await expect(page.getByLabel('تقدم الاختبار')).toContainText('/ 10')
 await page.getByRole('button',{name:'حفظ ومتابعة لاحقًا'}).click()
 await modes.getByRole('button',{name:/اختبار المتشابهات/}).click();await page.getByLabel('نطاق القرآن',{exact:true}).selectOption('single');await page.getByLabel('السورة',{exact:true}).selectOption('10')
 await page.getByLabel('عدد الأسئلة',{exact:true}).selectOption('10');await page.getByRole('button',{name:'ابدأ الاختبار',exact:true}).click();await expect(page.getByTestId('quiz-choice')).toHaveCount(4)
 await page.getByRole('button',{name:'حفظ ومتابعة لاحقًا'}).click()
 await modes.getByRole('button',{name:/اختبار اليوم/}).click();await expect(page.getByTestId('quiz-choice')).toHaveCount(4);const first=page.url()
 await page.getByRole('button',{name:'حفظ ومتابعة لاحقًا'}).click();await modes.getByRole('button',{name:/اختبار اليوم/}).click();await expect(page).toHaveURL(first)
 await expect(page.getByTestId('quiz-choice')).toHaveCount(4)
})
