-- Migration: new farsh difference type word_change = «اختلاف كلمة» (a different word instead of Hafs's). Replaces «أخرى».
-- Own file/transaction: a new enum value cannot be used in the transaction that adds it.
-- Rollback: Postgres cannot drop an enum value; the rollback of 20261015100100 simply stops using it.
ALTER TYPE qiraat_variant_type ADD VALUE IF NOT EXISTS 'word_change';
