'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Dashboard,QuizMode,QuizSettings,Scope,Session } from '@/lib/quiz/types'
import QuizConfig, { type QuizMetadata } from './QuizConfig'
import QuizQuestion from './QuizQuestion'
import QuizResults from './QuizResults'
import QuizDashboard from './QuizDashboard'
import { MODE_LABELS, MODE_DESCRIPTIONS } from './labels'
import s from './quiz.module.css'

type HomeData={dashboard:Dashboard;metadata:QuizMetadata;hasMore:boolean}
const zone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone
async function request<T>(path:string,body?:unknown):Promise<T> {
 const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'})
 const data=await response.json()
 if(!response.ok) throw new Error(data.error??'تعذّر الاتصال. حاول مرة أخرى.')
 return data
}
export default function QuizApp({initialSessionId,initialScope}:{initialSessionId?:string;initialScope?:Scope}) {
 const [home,setHome]=useState<HomeData|null>(null);const [session,setSession]=useState<Session|null>(null)
 const [mode,setMode]=useState<QuizMode|null>(initialScope?'custom':null)
 const [index,setIndex]=useState(0);const [results,setResults]=useState(false)
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [resumeId,setResumeId]=useState<string|null>(null)
 const loadHome=useCallback(async()=>{const data=await request<HomeData>(`/api/quiz?timezone=${encodeURIComponent(zone())}`);setHome(data);return data},[])
 const remember=(value:Session)=>{
  try{if(value.completedAt)localStorage.removeItem('hifz:active-session');else localStorage.setItem('hifz:active-session',value.id)}catch{/* Storage may be disabled; the server history still resumes sessions. */}
 }
 const open=useCallback(async(id:string)=>{
  setBusy(true);setError('')
  try{const value=await request<Session>(`/api/quiz/${id}`);setSession(value);setIndex(Math.min(value.answers.length,value.questions.length-1));setResults(!!value.completedAt);remember(value);window.history.replaceState(null,'',`/test?session=${value.id}`)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 },[])
 useEffect(()=>{
  let active=true
  loadHome().catch(e=>{if(active)setError(e.message)})
  if(initialSessionId) void open(initialSessionId)
  else {try{const value=localStorage.getItem('hifz:active-session');if(value)request<Session>(`/api/quiz/${value}`).then(saved=>{if(active&&!saved.completedAt)setResumeId(saved.id)}).catch(()=>{})}catch{}}
  return()=>{active=false}
 },[loadHome,open,initialSessionId])
 async function start(settings:QuizSettings) {
  setBusy(true);setError('')
  try{const value=await request<Session>('/api/quiz',settings);setSession(value);setIndex(Math.min(value.answers.length,value.questions.length-1));setResults(!!value.completedAt);setMode(null);setResumeId(null);remember(value);window.history.replaceState(null,'',`/test?session=${value.id}`)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 function chooseMode(value:QuizMode) {
  if(value==='custom'||value==='mutashabihat'){setMode(value);return}
  void start({mode:value,difficulty:2,count:value==='quick'?10:20,scope:{type:'all'},questionType:'mixed',timer:'none',timezone:zone()})
 }
 async function answer(choiceId:string,responseTimeMs:number) {
  if(!session)return
  setBusy(true);setError('')
  try{const value=await request<Session>(`/api/quiz/${session.id}/answer`,{questionId:session.questions[index].id,choiceId,responseTimeMs});setSession(value);remember(value)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 function backHome(){if(session&&!session.completedAt)setResumeId(session.id);setSession(null);setMode(null);setResults(false);window.history.replaceState(null,'','/test');void loadHome().catch(e=>setError(e.message))}
 const names=Object.fromEntries((home?.metadata.surahs??[]).map(v=>[v.id,v.name]))
 return <main className={s.shell} dir="rtl">
  {!session&&<header className={s.header}><div><p className={s.eyebrow}>مراجعة واعية · حفظ راسخ</p><h1>اختبر حفظك</h1><p className={s.muted}>من الموضع إلى اللفظ، اجعل كل مراجعة خطوة إلى الإتقان.</p></div><Link className={s.link} href="/mushaf-1441">المصحف</Link></header>}
  {error&&<div role="alert" className={s.error} style={{marginBottom:18}}>{error}<button className={s.link} style={{marginInlineStart:12}} onClick={()=>{setError('');void loadHome().catch(e=>setError(e.message))}}>إعادة المحاولة</button></div>}
  {!home&&!session&&<p role="status" className={s.muted}>جارٍ تحميل اختباراتك…</p>}
  {session?(results?<QuizResults session={session} surahs={names} busy={busy} onHome={backHome} onRetest={()=>void start({...session.settings,mode:'weak',count:10,questionType:'mixed',reviewSessionId:session.id,retryDaily:false})}/>:<QuizQuestion key={session.questions[index].id} question={session.questions[index]} answer={session.answers.find(a=>a.questionId===session.questions[index].id)} index={index} total={session.questions.length} settings={session.settings} startedAt={session.startedAt} busy={busy} onAnswer={(c,t)=>void answer(c,t)} onNext={()=>index+1===session.questions.length?setResults(true):setIndex(index+1)} onHome={backHome}/>):home&&(mode?<QuizConfig mode={mode} metadata={home.metadata} busy={busy} onStart={v=>void start(v)} onBack={()=>setMode(null)} initialScope={initialScope}/>:<div className={s.stack}>
   {resumeId&&<div className={`${s.card} ${s.spread}`}><div><h2>أكمل من حيث توقّفت</h2><p className={s.muted}>إجاباتك محفوظة، ويمكنك العودة إليها الآن.</p></div><button className={s.button} disabled={busy} onClick={()=>void open(resumeId)}>استكمال الاختبار</button></div>}
   <section className={s.modes} aria-label="أنواع الاختبار">{(Object.keys(MODE_LABELS) as QuizMode[]).map((value,i)=><button key={value} className={s.mode} disabled={busy} onClick={()=>chooseMode(value)}><span className={s.number}>٠{i+1}</span><strong>{MODE_LABELS[value]}</strong><p className={s.muted}>{MODE_DESCRIPTIONS[value]}</p></button>)}</section>
   {busy&&<p role="status" className={s.muted}>جارٍ إعداد أسئلة موثوقة من القرآن…</p>}
   {home.dashboard.weakAyahs.length>0&&<section className={`${s.card} ${s.stack}`}><div className={s.spread}><h2>مواضع تستحق المراجعة</h2><button className={s.link} disabled={busy} onClick={()=>chooseMode('weak')}>اختبرني في أخطائي</button></div><p className={s.muted}>الأخطاء الحديثة والمتكررة لها أولوية. ستظهر الآية بأسئلة متنوعة.</p><div className={s.row}>{home.dashboard.weakAyahs.slice(0,6).map(p=><span key={p.ayahKey} className={s.badge}>{names[p.ayahKey.split(':')[0]]} · {p.ayahKey.split(':')[1]} — {p.wrong} خطأ / {p.attempts}</span>)}</div></section>}
   <QuizDashboard data={home.dashboard} surahs={names} onOpen={id=>void open(id)} hasMore={home.hasMore} busy={busy} onMore={()=>{setBusy(true);request<HomeData>(`/api/quiz?timezone=${encodeURIComponent(zone())}&offset=${home.dashboard.sessions.length}`).then(next=>setHome({...next,dashboard:{...next.dashboard,sessions:[...home.dashboard.sessions,...next.dashboard.sessions]}})).catch(e=>setError(e.message)).finally(()=>setBusy(false))}}/>
   <div className={s.spread}><Link className={s.link} href="/test/legacy">الاختبار السابق وبطاقات المراجعة</Link><button className={s.link} disabled={busy} onClick={()=>void start({mode:'daily',difficulty:2,count:20,scope:{type:'all'},questionType:'mixed',timer:'none',timezone:zone(),retryDaily:true})}>اختبار إضافي لليوم</button></div>
  </div>)}
 </main>
}
