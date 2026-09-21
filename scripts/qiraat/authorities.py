# -*- coding: utf-8 -*-
"""Arabic authority name -> canonical Q-ID.

The word "خلف" can denote two authorities:
    خلف عن حمزة  = Q06-R01 (a narrator)
    خلف العاشر   = Q10     (a reader, one of the ten)
Project convention: bare "خلف" means Q06-R01. Resolve Q10 only when the source explicitly says
"خلف العاشر".
"""

READERS = {
    'نافع': 'Q01', 'ابن كثير': 'Q02', 'أبو عمرو': 'Q03', 'ابن عامر': 'Q04',
    'عاصم': 'Q05', 'حمزة': 'Q06', 'الكسائي': 'Q07', 'أبو جعفر': 'Q08',
    'يعقوب': 'Q09', 'خلف العاشر': 'Q10',
}

NARRATORS = {
    'قالون': 'Q01-R01', 'ورش': 'Q01-R02',
    'البزي': 'Q02-R01', 'قنبل': 'Q02-R02',
    'الدوري عن أبي عمرو': 'Q03-R01', 'السوسي': 'Q03-R02',
    'هشام': 'Q04-R01', 'ابن ذكوان': 'Q04-R02',
    'شعبة': 'Q05-R01', 'حفص': 'Q05-R02',
    'خلف عن حمزة': 'Q06-R01', 'خلاد': 'Q06-R02',
    'أبو الحارث': 'Q07-R01', 'الدوري عن الكسائي': 'Q07-R02',
    'ابن وردان': 'Q08-R01', 'ابن جماز': 'Q08-R02',
    'رويس': 'Q09-R01', 'روح': 'Q09-R02',
    'إسحاق': 'Q10-R01', 'إدريس': 'Q10-R02',
}

# Explicit, unambiguous aliases used by the data files.
ALIAS = {
    'KHALAF10': 'Q10',          # خلف العاشر — the reader
    'KHALAF_HAMZA': 'Q06-R01',  # خلف عن حمزة — the narrator
    'DURI_AMR': 'Q03-R01',
    'DURI_KISAI': 'Q07-R02',
}

ALL = {}
ALL.update(READERS)
ALL.update(NARRATORS)
ALL.update(ALIAS)

READER_OF = {n: r for n, r in
             [(v, v.split('-')[0]) for v in NARRATORS.values()]}

ALL_READINGS = sorted(NARRATORS.values())


class BadAuthority(Exception):
    pass


def resolve(name: str) -> str:
    name = name.strip()
    if name == 'خلف':
        return NARRATORS['خلف عن حمزة']
    if name == 'الدوري':
        raise BadAuthority(
            'Bare "الدوري" is ambiguous (Q03-R01 عن أبي عمرو vs Q07-R02 عن الكسائي). '
            'Use DURI_AMR or DURI_KISAI.')
    if name not in ALL:
        raise BadAuthority(f'unknown authority {name!r}')
    return ALL[name]


def readings_of(authority_id: str):
    """Every Riwayah covered by an authority: a reader expands to its two narrators."""
    if '-' in authority_id:
        return [authority_id]
    return [r for r in ALL_READINGS if r.startswith(authority_id + '-')]


def expand(names):
    out = []
    for n in names:
        for r in readings_of(resolve(n)):
            if r not in out:
                out.append(r)
    return sorted(out)


def remainder(claimed):
    """الباقون — the 20 Riwayat minus everyone already claimed at this locus."""
    return sorted(set(ALL_READINGS) - set(claimed))


def all_except(names):
    """جميع القراء عدا X"""
    return remainder(expand(names))
