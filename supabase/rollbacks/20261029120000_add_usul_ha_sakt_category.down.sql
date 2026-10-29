-- Rollback: removes the category. Fails (foreign key) while an entry still uses it; delete or move those entries first.
DELETE FROM qiraat_categories WHERE code = 'USUL_HA_SAKT';
NOTIFY pgrst, 'reload schema';
