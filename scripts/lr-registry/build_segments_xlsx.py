#!/usr/bin/env python3
"""Build the segmented lead-list workbook from clean_entities.csv.

Usage:
    python build_segments_xlsx.py <clean_entities.csv> [--out lr-registry-segments.xlsx]

Tabs: Зведення (pivot counts), ФОП_соло, ФОП_мульти, Малі_ТОВ_ПП,
По_регіонах, Спеціальності_ICP. Lead tabs carry name/region/address/
specialties so the user can filter them directly in Google Sheets.
"""
import argparse
from pathlib import Path

import pandas as pd

LEAD_COLS = {
    "name": "Назва / ПІБ",
    "oblast": "Область",
    "raion": "Район",
    "address": "Адреса",
    "specialties": "Спеціальності",
    "n_specialties": "К-ть спец.",
    "n_places": "К-ть місць",
    "first_issue": "Перша видача",
    "last_issue": "Останнє рішення",
    "edrpou": "ЄДРПОУ",
    "partial_termination": "Часткове припинення",
}
SEGMENT_LABELS = {
    "fop_solo": "ФОП соло (1 місце)",
    "fop_multi": "ФОП 2+ місць",
    "private_small": "Приватні юрособи ≤3 місць",
    "private_mid_plus": "Приватні юрособи 4+ місць",
    "public": "Комунальні / державні",
    "unclassified": "Некласифіковані (школи, БФ тощо)",
}


def lead_sheet(df: pd.DataFrame) -> pd.DataFrame:
    out = df[list(LEAD_COLS)].rename(columns=LEAD_COLS)
    return out.sort_values(["Область", "Назва / ПІБ"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("entities_csv", type=Path)
    ap.add_argument("--out", type=Path, default=Path("lr-registry-segments.xlsx"))
    args = ap.parse_args()

    ent = pd.read_csv(args.entities_csv)
    for c in ("first_issue", "last_issue"):
        ent[c] = pd.to_datetime(ent[c]).dt.date

    with pd.ExcelWriter(args.out, engine="openpyxl") as xw:
        summary = (ent.groupby("segment").size().rename("Кількість")
                   .reindex(SEGMENT_LABELS).reset_index())
        summary["segment"] = summary["segment"].map(SEGMENT_LABELS)
        summary.columns = ["Сегмент", "Кількість"]
        total = pd.DataFrame([["РАЗОМ активних", summary["Кількість"].sum()]],
                             columns=summary.columns)
        pd.concat([summary, total]).to_excel(xw, sheet_name="Зведення", index=False)

        lead_sheet(ent[ent["segment"] == "fop_solo"]).to_excel(
            xw, sheet_name="ФОП_соло", index=False)
        lead_sheet(ent[ent["segment"] == "fop_multi"]).to_excel(
            xw, sheet_name="ФОП_мульти", index=False)
        lead_sheet(ent[ent["segment"] == "private_small"]).to_excel(
            xw, sheet_name="Малі_ТОВ_ПП", index=False)

        region = (ent.pivot_table(index="oblast", columns="segment",
                                  aggfunc="size", fill_value=0))
        region["ICP разом"] = (region.get("fop_solo", 0)
                               + region.get("fop_multi", 0)
                               + region.get("private_small", 0))
        region.sort_values("ICP разом", ascending=False).rename(
            columns=SEGMENT_LABELS).to_excel(xw, sheet_name="По_регіонах")

        icp = ent[ent["segment"].isin(["fop_solo", "fop_multi", "private_small"])]
        specs = (icp["specialties"].fillna("").str.split(", ").explode()
                 .loc[lambda s: s.ne("")].value_counts()
                 .rename("Ліцензіатів ICP").reset_index()
                 .rename(columns={"specialties": "Спеціальність"}))
        specs.to_excel(xw, sheet_name="Спеціальності_ICP", index=False)

    print(f"written {args.out}: {len(ent)} entities")


if __name__ == "__main__":
    main()
