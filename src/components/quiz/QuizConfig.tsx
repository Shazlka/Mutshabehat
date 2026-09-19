'use client'
import { useState } from 'react'
import { QUESTION_LABELS, QUIZ_CONFIG } from '@/lib/quiz/config'
import type { Difficulty, QuizMode, QuizSettings, Scope } from '@/lib/quiz/types'
import { LEVEL_LABELS, MODE_LABELS } from './labels'
import s from './quiz.module.css'
export type QuizMetadata={surahs:{id:number;name:string}[];groups:{id:string;title:string;completed:boolean}[];hasStudied:boolean}
export default function QuizConfig({mode,metadata,onStart,onBack,busy,initialScope}:{mode:QuizMode;metadata:QuizMetadata;onStart:(settings:QuizSettings)=>void;onBack:()=>void;busy:boolean;initialScope?:Scope}) {
 const [scopeKind,setScopeKind]=useState(initialScope?.type==='surahs'?'single':initialScope?.type??'all')
 const [surahs,setSurahs]=useState<number[]>(initialScope?.surahIds??[10])
 const [from,setFrom]=useState(initialScope?.from??1);const [to,setTo]=useState(initialScope?.to??1)
 const [groupId,setGroupId]=useState(initialScope?.groupId??metadata.groups[0]?.id??'')
 const [difficulty,setDifficulty]=useState<Difficulty>(mode==='mutashabihat'?4:2)
 const [count,setCount]=useState(20)
 const [questionType,setQuestionType]=useState<QuizSettings['questionType']>('mixed')
 const [timer,setTimer]=useState<QuizSettings['timer']>('none')
 const [timerSeconds,setTimerSeconds]=useState(60)
 const scope=():Scope=>({type:scopeKind==='single'||scopeKind==='multiple'?'surahs':scopeKind as Scope['type'],surahIds:scopeKind==='single'||scopeKind==='ayah_range'?[surahs[0]??10]:surahs,from,to,groupId})
 return <form className={s.stack} onSubmit={e=>{e.preventDefault();onStart({mode,difficulty,count,scope:scope(),questionType,timer,timerSeconds,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})}}>
  <div className={s.spread}><h2>{MODE_LABELS[mode]}</h2><button type="button" className={s.link} onClick={onBack}>رجوع</button></div>
  <div className={`${s.card} ${s.stack}`}>
   <label className={s.field}>نطاق القرآن<select aria-label="نطاق القرآن" value={scopeKind} onChange={e=>{setScopeKind(e.target.value);setFrom(1);setTo(1)}}>
    <option value="all">القرآن كاملًا</option><option value="single">سورة واحدة</option><option value="multiple">عدة سور</option><option value="juz">جزء</option><option value="hizb">حزب</option><option value="pages">صفحات</option><option value="ayah_range">نطاق آيات</option>
    {metadata.hasStudied&&<><option value="studied">الآيات المدروسة فقط</option><option value="studied_mutashabihat">المتشابهات المدروسة</option></>}
    {metadata.groups.length>0&&<option value="group">مجموعة متشابهات محددة</option>}
   </select></label>
   {['single','ayah_range'].includes(scopeKind)&&<label className={s.field}>السورة<select aria-label="السورة" value={surahs[0]??10} onChange={e=>setSurahs([Number(e.target.value)])}>{metadata.surahs.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
   {scopeKind==='multiple'&&<fieldset><legend className={s.muted}>اختر السور ({surahs.length})</legend><div className={s.checks}>{metadata.surahs.map(v=><label className={s.check} key={v.id}><input type="checkbox" checked={surahs.includes(v.id)} onChange={e=>setSurahs(e.target.checked?[...surahs,v.id]:surahs.filter(x=>x!==v.id))}/>{v.name}</label>)}</div></fieldset>}
   {['juz','hizb','pages','ayah_range'].includes(scopeKind)&&<div className={s.grid}>{(['from','to'] as const).map(k=><label className={s.field} key={k}>{k==='from'?'من':'إلى'}<input type="number" aria-label={k==='from'?'من':'إلى'} min={1} max={scopeKind==='juz'?30:scopeKind==='hizb'?60:scopeKind==='pages'?604:286} required value={k==='from'?from:to} onChange={e=>(k==='from'?setFrom:setTo)(Number(e.target.value))}/></label>)}</div>}
   {scopeKind==='group'&&<label className={s.field}>المجموعة<select value={groupId} onChange={e=>setGroupId(e.target.value)}>{metadata.groups.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
   {['studied','studied_mutashabihat'].includes(scopeKind)&&<p className={s.muted}>الآيات المرتبطة بالمجموعات التي علّمتها «مكتملة».</p>}
  </div>
  <div className={`${s.card} ${s.grid}`}>
   <label className={s.field}>المستوى<select aria-label="المستوى" value={difficulty} onChange={e=>setDifficulty(Number(e.target.value) as Difficulty)}>{Object.entries(LEVEL_LABELS).map(([n,label])=><option key={n} value={n}>المستوى {n} — {label}</option>)}</select></label>
   <label className={s.field}>عدد الأسئلة<select aria-label="عدد الأسئلة" value={count} onChange={e=>setCount(Number(e.target.value))}>{QUIZ_CONFIG.questionCounts.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
   {mode!=='mutashabihat'&&<label className={s.field}>نوع الأسئلة<select aria-label="نوع الأسئلة" value={questionType} onChange={e=>setQuestionType(e.target.value as QuizSettings['questionType'])}><option value="mixed">مختلط</option>{Object.entries(QUESTION_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
   <label className={s.field}>الوقت<select aria-label="الوقت" value={timer} onChange={e=>{setTimer(e.target.value as QuizSettings['timer']);setTimerSeconds(e.target.value==='quiz'?1200:60)}}><option value="none">بدون مؤقّت</option><option value="question">مؤقّت لكل سؤال</option><option value="quiz">مؤقّت للاختبار</option></select></label>
   {timer!=='none'&&<label className={s.field}>المدة بالثواني<input type="number" min={5} max={7200} value={timerSeconds} onChange={e=>setTimerSeconds(Number(e.target.value))}/><span className={s.muted}>للتدريب فقط؛ لا تُغلق الإجابة عند انتهاء الوقت.</span></label>}
  </div>
  <p className={s.muted}>كل سؤال بأربعة اختيارات. النصوص من مصحف التطبيق، وتتغيّر الأسئلة ومواضع الإجابات في كل اختبار.</p>
  <button className={s.button} type="submit" disabled={busy||(scopeKind==='multiple'&&!surahs.length)}>{busy?'جارٍ إعداد الأسئلة…':'ابدأ الاختبار'}</button>
 </form>
}
