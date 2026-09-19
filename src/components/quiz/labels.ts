import type { Difficulty, QuizMode } from '@/lib/quiz/types'
export const MODE_LABELS:Record<QuizMode,string>={quick:'اختبار سريع',custom:'اختبار مخصص',mutashabihat:'اختبار المتشابهات',weak:'نقاط ضعفي',daily:'اختبار اليوم'}
export const LEVEL_LABELS:Record<Difficulty,string>={1:'سهل',2:'متوسط',3:'صعب',4:'متشابهات',5:'إتقان'}
export const MODE_DESCRIPTIONS:Record<QuizMode,string>={quick:'عشرة أسئلة جديدة، بمستوى يناسب تقدّمك.',custom:'اختر السور والنطاق والمستوى ونوع الأسئلة.',mutashabihat:'ميّز اللفظ الصحيح بين مواضع القرآن المتشابهة.',weak:'راجع الآيات والروابط التي تحتاج منك عناية.',daily:'عشرون سؤالًا تجمع المراجعة والمتشابهات والربط.'}
export const seconds=(n:number)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`
