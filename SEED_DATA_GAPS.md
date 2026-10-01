# Qiraat annotation engine — scholarly seed-data gaps

This list deliberately blocks unverified scholarly seeding. It does **not** block the additive engineering schema, empty catalog surfaces or test-only synthetic data isolated from production.

## Verified and available in the repository/database

- Ten readers and twenty narrator relationships are present in `packages/qiraat-core` and the applied `qiraat_authorities` table.
- Existing identity colours for those readers/narrators are present in qiraat-core and `qiraat_authorities.color_hex`.
- The existing source-document rows include Al-Shatibiyya and Al-Durra as sources, plus a Mushaf source and Tayyibat al-Nashr. Their presence is evidence-source metadata, not authorization to seed every framework membership or rule.
- Twenty-four existing category rows are available for the fixture-import pipeline.

## Do not seed without a supplied or repository-authoritative source

1. A corpus record and exact scoped association of **Al-Ashr Al-Sughra** to Al-Shatibiyya and Al-Durra. Existing source-document labels are insufficient to assert formal framework validity.
2. Any Tariq/route records and their parent relationships; the observed database has only readers and narrators.
3. Framework-to-entity memberships, including which narrator/Tariq is valid in each framework.
4. Collective groups/presets (الكوفيون, أهل سما, الأخوان, صحبة, صحاب, etc.) and all memberships.
5. A hierarchical Usul/Farsh taxonomy mapping. Existing flat categories may be mapped only after a verified source explicitly supplies the parent/child classification.
6. Any rule attribution, face/Awjuh value, preference (including `muqaddam`), Wasl/Waqf condition, variant text, transmission exception, source citation or explicit exclusion not already in a verified repository record.
7. Any relationship between the existing fixture records and the new authoring annotations. This needs an approved provenance-preserving bridge design and validated anchor mapping.

## Safe implementation policy

- Phase 1 seeds only deterministic canonical words and existing, already-authoritative reader/narrator/colour records through an explicit migration mapping.
- Empty tables and editor controls must state “no verified data available” instead of inferring options.
- Test fixtures use clearly synthetic IDs/text and cannot be exported or mistaken for scholarship.
- Human-authored manual entries default to `draft`; nothing is promoted to `reviewed` or `verified` by engineering automation.
