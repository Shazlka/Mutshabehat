'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Answer, Question, QuizSettings } from '@/lib/quiz/types'
import { QUESTION_LABELS } from '@/lib/quiz/config'
import { LEVEL_LABELS,seconds } from './labels'
import s from './quiz.module.css'
export function QuestionContext({question:q}:{question:Question}) {
 return <div className={`${s.quran} ${s.context}`} dir="rtl">{q.blank?<>{q.blank.before}<span className={s.blank} aria-label="موضع الكلمة الناقصة">…</span>{q.blank.after}</>:q.context}</div>
}
export default function QuizQuestion({question:q,answer,index,total,settings,startedAt,busy,onAnswer,onNext,onHome}:{question:Question;answer?:Answer;index:number;total:number;settings:QuizSettings;startedAt:string;busy:boolean;onAnswer:(choiceId:string,elapsed:number)=>void;onNext:()=>void;onHome:()=>void}) {
 const opened=useRef(Date.now());const heading=useRef<HTMLHeadingElement>(null)
 const [elapsed,setElapsed]=useState(0)
 useEffect(()=>{heading.current?.focus();const id=setInterval(()=>setElapsed(Math.floor((Date.now()-opened.current)/1000)),1000);return()=>clearInterval(id)},[])
 const correct=q.choices.find(c=>c.id===answer?.correctChoiceId)
 const remaining=(settings.timerSeconds??60)-(settings.timer==='quiz'?Math.floor((Date.now()-Date.parse(startedAt))/1000):elapsed)
 return <div className={s.stack}>
  <header className={s.progressHeader}><div className={s.spread}><span aria-label="تقدم الاختبار">السؤال {index+1} / {total}</span><button type="button" className={s.link} onClick={onHome}>حفظ ومتابعة لاحقًا</button></div><progress className={s.progress} max={total} value={index+(answer?1:0)} aria-label="التقدّم"/><div className={s.spread}><div className={s.row}><span className={s.badge}>{QUESTION_LABELS[q.type]}</span><span className={s.badge}>{LEVEL_LABELS[q.difficulty]}</span></div>{settings.timer!=='none'&&<span className={s.timer}>{remaining>=0?`الوقت المتبقي ${seconds(remaining)}`:'انتهى وقت التدريب؛ يمكنك متابعة الإجابة'}</span>}</div></header>
  <section className={s.card} aria-labelledby="quiz-prompt"><h2 ref={heading} tabIndex={-1} id="quiz-prompt">{q.prompt}</h2><QuestionContext question={q}/></section>
  <div className={s.choices} role="group" aria-label="اختيارات الإجابة">{q.choices.map((c,i)=>{
   const state=answer?(c.id===answer.correctChoiceId?'correct':c.id===answer.selectedChoiceId?'wrong':'neutral'):'neutral'
   return <button type="button" data-testid="quiz-choice" data-state={state} data-kind={['surah','ayah_number','location'].includes(q.type)?'metadata':'quran'} key={c.id} className={s.choice} disabled={busy||!!answer} onClick={()=>onAnswer(c.id,Math.min(3600000,Date.now()-opened.current))}><span className={s.choiceLetter} aria-hidden>{['أ','ب','ج','د'][i]}</span><span className={s.choiceText}>{c.text}</span>{state==='correct'&&<span className={s.correct}>✓ الصحيح</span>}{state==='wrong'&&<span className={s.wrong}>✕ اختيارك</span>}</button>
  })}</div>
  {busy&&!answer&&<p role="status" className={s.muted}>جارٍ حفظ الإجابة…</p>}
  {answer&&<section className={`${s.feedback} ${s.stack}`} aria-live="polite"><h3 className={answer.isCorrect?s.correct:s.wrong}>{answer.isCorrect?'✓ صحيح':'✕ إجابة غير صحيحة'}</h3><div><p className={s.muted}>الإجابة الصحيحة</p><p className={s.quran}>{correct?.text}</p><p className={s.muted}>{answer.explanation}</p></div>
   {!!answer.comparisons.length&&<details className={s.details}><summary>مقارنة المتشابهات</summary><div className={s.stack}>{answer.comparisons.map((c,i)=><div key={`${c.ayahKey}:${i}`}><p className={`${s.quran} ${s.difference}`}>{c.text}</p><p className={s.muted}>{c.surahName} · {c.ayahKey.split(':')[1]}</p></div>)}</div></details>}
   <div className={s.spread}>{q.page&&<Link className={s.link} href={`/mushaf-1441?page=${q.page}`}>راجع الموضع في المصحف</Link>}<button type="button" autoFocus className={s.button} onClick={onNext}>{index+1===total?'عرض النتيجة':'السؤال التالي'}</button></div>
  </section>}
 </div>
}
