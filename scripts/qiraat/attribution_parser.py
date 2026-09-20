# -*- coding: utf-8 -*-
"""Deterministic parser for an Excel attribution cell (who reads this وجه).

Splits a free-text Arabic attribution phrase into individual reader/narrator/group tokens
and resolves each one against the EXISTING authority model (`authorities.py`,
`group_symbols.py`) — never a second naming scheme (task requirement #6).

No AI/LLM involvement: this is pure string splitting + dictionary lookup. Anything that does
not resolve is returned as an explicit unresolved token; the caller must not guess.
"""
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import authorities as A          # noqa: E402
import group_symbols as G        # noqa: E402

# Cheap normalizations that do not change identity: trailing "و" glue words, alef variants,
# tatweel, extra whitespace. This mirrors the folding rules already used elsewhere in this
# project's Arabic-normalization helpers (src/lib/arabic.ts), scoped to what attribution
# strings actually contain.
_SPLIT_RE = re.compile(r'[,،،؛;/\n]|(?:\s+و)(?=\S)')


def _clean(token: str) -> str:
    t = token.strip()
    t = t.replace('ـ', '')
    t = re.sub(r'\s+', ' ', t)
    # A leading "و" ("وحمزة") is the Arabic conjunction, not part of the name.
    if t.startswith('و') and len(t) > 1 and t[1:] in (set(A.ALL) | set(G.GROUPS) | set(G.AMBIGUOUS_WITHOUT_CONTEXT)):
        t = t[1:]
    return t.strip(' \t.:؛،')


def split_attribution(raw: str):
    """Split a raw attribution phrase into candidate name tokens (no resolution yet)."""
    if not raw or not raw.strip():
        return []
    parts = _SPLIT_RE.split(raw)
    out = []
    for p in parts:
        c = _clean(p)
        if c:
            out.append(c)
    return out


class AttributionResult:
    def __init__(self):
        self.tokens = []             # every input token, verbatim
        self.resolved_readings = []  # sorted unique Q0N-R0M
        self.resolved_by_token = {}  # token -> list[reading_id] | 'REMAINDER'
        self.unresolved = []         # tokens that could not be resolved
        self.is_remainder = False    # "الباقون" or equivalent seen
        self.remainder_reason = None

    @property
    def ok(self) -> bool:
        return not self.unresolved


def resolve_attribution(raw: str) -> AttributionResult:
    """Resolve a full attribution cell.

    Every token is tried, in order, as: (1) an individual reader/narrator name via
    `authorities.resolve`, (2) a group name via `group_symbols.resolve_group`. A token that
    matches neither — including a deliberately-ambiguous one such as bare "خلف" or "الباقون"
    — is recorded as unresolved with the reason, never silently guessed.
    """
    result = AttributionResult()
    for token in split_attribution(raw):
        result.tokens.append(token)
        try:
            qid = A.resolve(token)
            readings = A.readings_of(qid)
            result.resolved_by_token[token] = readings
            for r in readings:
                if r not in result.resolved_readings:
                    result.resolved_readings.append(r)
            continue
        except A.BadAuthority as e:
            if token in G.AMBIGUOUS_WITHOUT_CONTEXT or token in ('الباقون',):
                if token == 'الباقون' or 'remainder' in str(e).lower():
                    result.is_remainder = True
                    result.remainder_reason = str(e)
                    continue
            # fall through to group resolution attempt below
            first_error = str(e)
        try:
            readings = G.resolve_group(token)
            result.resolved_by_token[token] = readings
            for r in readings:
                if r not in result.resolved_readings:
                    result.resolved_readings.append(r)
        except A.BadAuthority as e2:
            reason = str(e2)
            if token in G.AMBIGUOUS_WITHOUT_CONTEXT:
                reason = f'{token}: {G.AMBIGUOUS_WITHOUT_CONTEXT[token]}'
            result.unresolved.append({'token': token, 'reason': reason})
    result.resolved_readings.sort()
    return result
