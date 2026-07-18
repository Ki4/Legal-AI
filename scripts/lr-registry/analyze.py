#!/usr/bin/env python3
"""Analyze the MOZ medical-practice licence registry export (ЛР-*.xlsx).

Registry shape (verified on the 10.04.2026 export):
  - one row  = decision x branch/place of practice
  - licence_id is a DECISION-RECORD id, not a subject id (0 licence_ids carry
    more than one decision; chains like "Сіневе Україна" span 90+ ids)
  - ЄДРПОУ/РНОКПП is masked as "----------" for natural persons (ФОП)

Pipeline: raw decision rows -> subject-level dedup (ЄДРПОУ for legal
entities, normalized full name for ФОП) -> active/annulled status from the
decision timeline -> entity typing (fop / private_legal / public) -> ICP
segments -> aggregates + step-by-step reconciliation.

Usage:
    python analyze.py <registry.xlsx> [--outdir OUTDIR] [--snapshot YYYY-MM-DD]

The raw xlsx is NOT committed to the repo (public registry data,
re-downloadable from moz.gov.ua / data.gov.ua). External benchmark for the
active-subject count: Опендатабот, end of 2025 — 43 939 active licences,
29 614 of them ФОП (67%).
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

COLUMNS = [
    "licence_id", "name", "ownership", "edrpou", "oblast", "raion",
    "postal_code", "address", "activity", "decision", "decision_basis",
    "decision_date", "decision_number", "licence_start", "licence_end",
    "branch_no", "branch_name", "branch_address", "works", "branch_flag",
    "issue_date", "liquidation_date", "basis", "licensing_body",
]

ISSUING = {"Видати", "Видати копію", "Переоформити"}
PARTIAL_MARKER = "ПРИПИНЕННЯ ЧАСТКОВО"

PUBLIC_PREFIXES = (
    "КОМУНАЛЬНЕ", "КОМУНАЛЬНИЙ", "КОМУНАЛЬНА", "КНП", "КП ", "КЗ ",
    "ДЕРЖАВНЕ", "ДЕРЖАВНИЙ", "ДЕРЖАВНА", "ДП ", "ДУ ", "ДЗ ",
    "ВІЙСЬКОВ", "НАЦІОНАЛЬН", "ОБЛАСН", "МІСЬК", "РАЙОНН", "ЦЕНТРАЛЬН",
    "УПРАВЛІННЯ", "МІНІСТЕРСТВО", "АКАДЕМІЯ", "УНІВЕРСИТЕТ", "ІНСТИТУТ",
)
PRIVATE_LEGAL_PREFIXES = (
    "ТОВАРИСТВО З ОБМЕЖЕНОЮ", "ТОВ ", "ТОВ\"", "ТОВ«",
    "ПРИВАТНЕ ПІДПРИЄМСТВО", "ПП ", "ПП\"", "ПП«",
    "ПРИВАТНЕ АКЦІОНЕРНЕ", "ПРАТ", "АКЦІОНЕРНЕ ТОВАРИСТВО", "АТ ", "ПАТ",
    "ТДВ", "ПОВНЕ ТОВАРИСТВО", "МАЛЕ ПРИВАТНЕ", "МПП", "ФІРМА",
    "ПРИВАТНА ФІРМА", "ПРИВАТНИЙ ЗАКЛАД", "ПРИВАТНЕ",
    "МЕДИЧНИЙ ЦЕНТР", "СТОМАТОЛОГ",
)
# ФОП names are «Прізвище Ім'я По батькові» — 3 capitalized Cyrillic words
FOP_NAME_RE = (
    r"^[А-ЯҐЄІЇ][а-яґєії'’\-]+\s+[А-ЯҐЄІЇ][а-яґєії'’\-]+\s+"
    r"[А-ЯҐЄІЇ][а-яґєії'’\-]+$"
)


def classify_entity(name: str, ownership: str, has_edrpou: bool,
                    looks_fop: bool) -> str:
    """Return one of: fop, private_legal, public, unclassified."""
    nu = (name or "").upper()
    own = (ownership or "").strip()
    if own in ("Комунальна власність", "Державна власність",
               "Загальнодержавна власність"):
        return "public"
    if any(nu.startswith(p) for p in PUBLIC_PREFIXES):
        return "public"
    if nu.startswith("ФОП") or nu.startswith("ФІЗИЧНА ОСОБА"):
        return "fop"
    if not has_edrpou and looks_fop:
        return "fop"
    if any(nu.startswith(p) for p in PRIVATE_LEGAL_PREFIXES):
        return "private_legal"
    if has_edrpou:
        if own in ("Приватна власність", "Колективна власність"):
            return "private_legal"
        return "unclassified"
    return "unclassified"


def load_rows(xlsx_path: Path) -> pd.DataFrame:
    df = pd.read_excel(xlsx_path, header=0, names=COLUMNS, dtype=object)
    for c in ("decision_date", "licence_start", "licence_end",
              "issue_date", "liquidation_date"):
        df[c] = pd.to_datetime(df[c], errors="coerce")
    return df


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx", type=Path)
    ap.add_argument("--outdir", type=Path, default=Path(__file__).parent / "output")
    ap.add_argument("--snapshot", default=None,
                    help="registry snapshot date YYYY-MM-DD (default: today)")
    args = ap.parse_args()
    snapshot = pd.Timestamp(args.snapshot) if args.snapshot else pd.Timestamp.now().normalize()
    args.outdir.mkdir(parents=True, exist_ok=True)

    recon: dict = {"snapshot": str(snapshot.date()), "input": str(args.xlsx)}

    df = load_rows(args.xlsx)
    recon["rows_total"] = len(df)

    # Drop orphan rows: no name AND no ЄДРПОУ AND no decision -> a subject
    # cannot be identified. These are branch fragments with no parent record
    # in the export (~2.3k licence_ids, no named counterpart anywhere).
    name_empty = df["name"].astype("string").fillna("").str.strip().eq("")
    edr_empty = (df["edrpou"].astype("string").fillna("").str.strip("-")
                 .str.strip().eq(""))
    orphan = name_empty & edr_empty & df["decision"].isna()
    recon["rows_dropped_orphan"] = int(orphan.sum())
    df = df[~orphan].copy()
    recon["rows_usable"] = len(df)
    recon["decision_records_total"] = int(df["licence_id"].nunique())

    # --- Subject key ---------------------------------------------------------
    df["name_norm"] = (
        df["name"].astype("string").fillna("")
        .str.replace(rf"\s*\({PARTIAL_MARKER}\)\s*", "", regex=True)
        .str.replace(r"\s+", " ", regex=True).str.strip()
    )
    df["name_upper"] = df["name_norm"].str.upper()
    # NB: pandas 3.0 keeps NA through .astype(str); fillna("") first so that a
    # genuinely empty ЄДРПОУ cell (natural persons, ~2.7k rows) is treated as
    # "no code" (ФОП), not silently dropped via a NaN subject key.
    edr = df["edrpou"].astype("string").fillna("").str.strip()
    df["has_edrpou"] = (edr.str.strip("-").str.strip().ne("")
                        & ~edr.str.lower().isin(["none", "nan"]))
    df["subject"] = np.where(df["has_edrpou"], "EDR::" + edr,
                             "FOP::" + df["name_upper"])
    recon["subjects_total"] = int(df["subject"].nunique())

    # --- Status from the decision timeline -----------------------------------
    df["is_partial"] = df["name"].astype(str).str.contains(PARTIAL_MARKER)
    df["is_issue"] = df["decision"].isin(ISSUING)
    df["is_annul_full"] = df["decision"].eq("Анулювати") & ~df["is_partial"]
    df["is_annul_part"] = df["decision"].eq("Анулювати") & df["is_partial"]

    last_issue = df[df["is_issue"]].groupby("subject")["decision_date"].max()
    last_annul = df[df["is_annul_full"]].groupby("subject")["decision_date"].max()

    subjects = pd.DataFrame(index=df["subject"].unique())
    subjects["last_issue"] = last_issue
    subjects["last_annul_full"] = last_annul
    # active = ever issued AND not fully annulled after the last issuing decision
    # (tie on the same date -> annulment wins)
    subjects["alive"] = subjects["last_issue"].notna() & (
        subjects["last_annul_full"].isna()
        | (subjects["last_issue"] > subjects["last_annul_full"])
    )
    recon["subjects_never_issued"] = int(subjects["last_issue"].isna().sum())
    recon["subjects_fully_annulled"] = int(
        (subjects["last_issue"].notna() & ~subjects["alive"]).sum())

    # expiry: licence_end on rows of the last issuing decision (licences were
    # term-limited until ~2010, indefinite afterwards -> licence_end is NaT)
    issue_rows = df[df["is_issue"]].merge(
        subjects["last_issue"].rename("last_issue"),
        left_on="subject", right_index=True)
    last_issue_rows = issue_rows[
        issue_rows["decision_date"] == issue_rows["last_issue"]]
    lic_end = last_issue_rows.groupby("subject")["licence_end"].max()
    subjects["licence_end"] = lic_end
    expired = subjects["licence_end"].notna() & (subjects["licence_end"] < snapshot)
    recon["subjects_expired"] = int((subjects["alive"] & expired).sum())
    subjects.loc[expired, "alive"] = False
    recon["subjects_active"] = int(subjects["alive"].sum())
    recon["benchmark_opendatabot_2025"] = {
        "active_total": 43939, "fop": 29614, "legal": 14325,
        "source": "https://opendatabot.ua/analytics/moz-licenses-2025"}

    # --- Attributes of active subjects ----------------------------------------
    act_ids = subjects.index[subjects["alive"]]
    rows_act = df[df["subject"].isin(act_ids)]
    src = last_issue_rows[last_issue_rows["subject"].isin(act_ids)]

    ent = (src.sort_values("decision_date")
              .groupby("subject")
              .agg(name=("name_norm", "first"),
                   ownership=("ownership", "first"),
                   has_edrpou=("has_edrpou", "first"),
                   edrpou=("edrpou", "first"),
                   oblast=("oblast", "first"),
                   raion=("raion", "first"),
                   address=("address", "first")))
    first_issue = rows_act[rows_act["is_issue"]].groupby("subject")["decision_date"].min()
    ent["first_issue"] = first_issue
    ent["last_issue"] = subjects.loc[ent.index, "last_issue"]
    ent["partial_termination"] = rows_act.groupby("subject")["is_annul_part"].any()

    # places: distinct alive branch addresses across ALL issuing decisions,
    # minus addresses later annulled (partial terminations list the branches
    # being closed). Approximation - the registry has no authoritative
    # "current branch list" field.
    ib = df[df["is_issue"] & df["subject"].isin(act_ids)].copy()
    ib["baddr"] = (ib["branch_address"].astype(str)
                   .str.upper().str.replace(r"\s+", " ", regex=True).str.strip())
    ib = ib[ib["liquidation_date"].isna() & ib["baddr"].ne("NONE") & ib["baddr"].ne("")]
    ann = df[df["decision"].eq("Анулювати") & df["subject"].isin(act_ids)].copy()
    ann["baddr"] = (ann["branch_address"].astype(str)
                    .str.upper().str.replace(r"\s+", " ", regex=True).str.strip())
    annulled_addr = set(zip(ann["subject"], ann["baddr"]))
    ib["pair"] = list(zip(ib["subject"], ib["baddr"]))
    ib_alive = ib[~ib["pair"].isin(annulled_addr)]
    n_places = ib_alive.groupby("subject")["baddr"].nunique()
    ent["n_places"] = n_places.reindex(ent.index).fillna(1).clip(lower=1).astype(int)

    def union_works(s: pd.Series) -> tuple:
        out: set = set()
        for v in s.dropna():
            out.update(w.strip() for w in str(v).split(",") if w.strip())
        return tuple(sorted(out))

    works = ib_alive.groupby("subject")["works"].apply(union_works)
    ent["specialties"] = works.reindex(ent.index).apply(
        lambda v: v if isinstance(v, tuple) else ())
    ent["n_specialties"] = ent["specialties"].apply(len)

    looks_fop = ent["name"].str.match(FOP_NAME_RE, na=False)
    ent["entity_type"] = [
        classify_entity(n, o, h, lf)
        for n, o, h, lf in zip(ent["name"], ent["ownership"].fillna(""),
                               ent["has_edrpou"], looks_fop)
    ]
    recon["entity_type"] = ent["entity_type"].value_counts().to_dict()

    # --- ICP segments ----------------------------------------------------------
    def segment(row) -> str:
        t = row["entity_type"]
        if t == "fop":
            return "fop_solo" if row["n_places"] <= 1 else "fop_multi"
        if t == "private_legal":
            return "private_small" if row["n_places"] <= 3 else "private_mid_plus"
        return t

    ent["segment"] = ent.apply(segment, axis=1)
    recon["segments"] = ent["segment"].value_counts().to_dict()
    recon["icp_total"] = int(
        ent["segment"].isin(["fop_solo", "fop_multi", "private_small"]).sum())

    assert int(ent["segment"].value_counts().sum()) == recon["subjects_active"], \
        "segment sum != active subjects"
    # FOP namesake caveat: masked ЄДРПОУ forces name-keyed dedup, full
    # namesakes collapse into one subject. Report scale of the risk.
    recon["note_fop_key"] = "FOP subjects deduped by full name; namesakes collapse"

    # --- Outputs ----------------------------------------------------------------
    ent_out = ent.reset_index(names="subject")
    ent_out["specialties"] = ent_out["specialties"].apply(", ".join)
    ent_out.to_csv(args.outdir / "clean_entities.csv", index=False)

    ent[ent["entity_type"] == "unclassified"].reset_index(names="subject")[
        ["subject", "name", "ownership", "edrpou", "oblast"]
    ].to_csv(args.outdir / "unclassified.csv", index=False)

    ent.groupby(["oblast", "segment"]).size().unstack(fill_value=0).to_csv(
        args.outdir / "agg_region_segment.csv")

    spec_counter: Counter = Counter()
    for seg, specs in zip(ent["segment"], ent["specialties"]):
        if seg in ("fop_solo", "fop_multi", "private_small"):
            spec_counter.update(specs)
    pd.Series(spec_counter).sort_values(ascending=False).rename("icp_licensees") \
        .to_csv(args.outdir / "agg_icp_specialties.csv")

    ent["issue_year"] = ent["first_issue"].dt.year
    (ent.groupby(["issue_year", "segment"]).size().unstack(fill_value=0)
        .to_csv(args.outdir / "agg_year_segment.csv"))

    recon["top_icp_specialties"] = dict(spec_counter.most_common(15))
    (args.outdir / "summary.json").write_text(
        json.dumps(recon, ensure_ascii=False, indent=2, default=str))
    print(json.dumps(recon, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    sys.exit(main())
