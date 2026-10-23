import assert from 'node:assert/strict'
import test from 'node:test'
import { consistentUthmaniText } from '../../src/app/api/mushaf-1441/qiraat/variant-text'

test('a stale Hafs copy in uthmaniText is dropped when the reading text differs (2:144 تعملون)', () => {
  assert.equal(consistentUthmaniText('يَعْمَلُونَ', 'تَعْمَلُونَ', 'يَعْمَلُونَ'), undefined)
})

test('a vowel-only change is caught too, because the comparison is exact, not normalized', () => {
  assert.equal(consistentUthmaniText('أُفٍّ', 'أُفَّ', 'أُفٍّ'), undefined)
})

test('an Uthmani text that matches the reading is kept', () => {
  assert.equal(consistentUthmaniText('إِبْرَٰهِـۧمَ', 'إِبْرَاهَامَ', 'إِبْرَاهَامَ'), 'إِبْرَاهَامَ')
})

test('a performance-only variant (reading equals Hafs) keeps its uthmaniText', () => {
  assert.equal(consistentUthmaniText('عَلَيْهِمْ', 'عَلَيْهِمْ', 'عَلَيْهِمْ'), 'عَلَيْهِمْ')
})

test('no uthmaniText stays absent, and surrounding spaces are ignored', () => {
  assert.equal(consistentUthmaniText('كلمة', 'كلمه', null), undefined)
  assert.equal(consistentUthmaniText('كلمة', 'كلمه', '  '), undefined)
  assert.equal(consistentUthmaniText('كلمة ', ' كلمه', 'كلمة'), undefined)
})
