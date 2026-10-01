'use client'
import { useState } from 'react'
import Link from 'next/link'
import { summarizeSession } from '@/lib/quiz/analytics'
import { QUESTION_LABELS,QUIZ_CONFIG } from '@/lib/quiz/config'
import type { CategoryStat,QuestionType,Session } from '@/lib/quiz/types'
import { QuestionContext } from './QuizQuestion'
import { seconds } from './labels'
import s from './quiz.module.css'
export function CategoryTable({stats,label}:{stats:CategoryStat[];label:(key:string)=>string}) {
 return <table className={s.table}><thead><tr><th>الفئة</th><th>الصحيح / الإجابات</th><th>الدقة</th></tr></thead><tbody>{stats.map(t=><tr key={t.key}><td>{label(t.key)}</td><td>{t.correct} / {t.attempts}</td><td>{t.accuracy}%</td></tr>)}</tbody></table>
}
export default function QuizResults({session,onRetest,onHome,busy,surahs}:{session:Session;onRetest:()=>void;onHome:()=>void;busy:boolean;surahs:Record<string,string>}) {
 const [review,setReview]=useState(false);const summary=summarizeSession(session)
 const wrong=session.answers.filter(a=>!a.isCorrect)
 const enough=summary.bySurah.filter(t=>t.attempts>=QUIZ_CONFIG.minimumAttempts).sort((a,b)=>b.accuracy-a.accuracy)
 return <div className={s.stack}>
  <section className={`${s.card} ${s.stack}`}><p className={s.eyebrow}>اكتملت المراجعة</p><h2>النتيجة</h2><div className={s.spread}><div><p className={s.score}>{summary.percentage}%</p><p className={s.muted}>{summary.correct} / {summary.total} إجابة صحيحة</p></div><div className={s.muted}>كل خطأ يوجّه مراجعتك القادمة.<br/>ارجع إلى موضعه، ثم اختبره بصورة أخرى.</div></div><div className={s.stats}><div className={s.stat}><strong>{summary.correct}</strong><span>صحيح</span></div><div className={s.stat}><strong>{summary.wrong}</strong><span>غير صحيح</span></div><div className={s.stat}><strong>{seconds(summary.durationSeconds)}</strong><span>وقت الإجابة الفعلي</span></div><div className={s.stat}><strong>{Math.round(summary.averageResponseMs/1000)} ث</strong><span>متوسط الإجابة</span></div></div></section>
  <section className={s.card}><h2>الأداء حسب نوع السؤال</h2><CategoryTable stats={summary.byType} label={k=>QUESTION_LABELS[k as QuestionType]}/></section>
  <section className={s.card}><h2>الأداء حسب السورة</h2><CategoryTable stats={summary.bySurah} label={k=>surahs[k]??k}/>{enough.length>0?<div className={s.actions}>{enough.filter(t=>t.accuracy>=85).map(t=><p key={t.key} className={s.correct}>أداء قوي: {surahs[t.key]} — {t.accuracy}%</p>)}{enough.filter(t=>t.accuracy<75).map(t=><p key={t.key} className={s.wrong}>تحتاج مراجعة: {surahs[t.key]} — {t.accuracy}%</p>)}</div>:<p className={s.muted}>نحتاج إلى {QUIZ_CONFIG.minimumAttempts} إجابات على الأقل في السورة قبل وصف قوتها أو ضعفها.</p>}</section>
  <div className={s.actions}>{wrong.length>0&&<><button className={s.secondary} onClick={()=>setReview(!review)} aria-expanded={review}>مراجعة الأخطاء ({wrong.length})</button><button className={s.button} disabled={busy} onClick={onRetest}>اختبرني في أخطائي</button></>}<button className={s.secondary} onClick={onHome}>العودة للاختبارات</button></div>
  {review&&<section className={s.stack} aria-label="مراجعة الأخطاء">{wrong.map(a=>{
   const q=session.questions.find(q=>q.id===a.questionId)!
   return <article key={q.id} className={`${s.card} ${s.stack}`}><div className={s.spread}><h3>{q.prompt}</h3><span className={s.badge}>{QUESTION_LABELS[q.type]}</span></div><QuestionContext question={q}/><div><p className={s.wrong}>✕ اختيارك</p><p className={s.quran}>{q.choices.find(c=>c.id===a.selectedChoiceId)?.text}</p></div><div><p className={s.correct}>✓ الإجابة الصحيحة</p><p className={s.quran}>{q.choices.find(c=>c.id===a.correctChoiceId)?.text}</p><p className={s.muted}>{q.surahName} · {q.ayahNumber}</p></div>{a.comparisons.length>0&&<details className={s.details}><summary>مقارنة المتشابهات</summary>{a.comparisons.map((c,i)=><div key={i}><p className={`${s.quran} ${s.difference}`}>{c.text}</p><p className={s.muted}>{c.surahName} · {c.ayahKey.split(':')[1]}</p></div>)}</details>}{q.page&&<Link className={s.link} href={`/mushaf-1441?page=${q.page}`}>راجع في المصحف</Link>}</article>
  })}</section>}
 </div>
}
