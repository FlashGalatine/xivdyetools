"""Offline additive prerequisite: retain base glyph IDs/tables; append only new cmap glyphs.

Run from repo root with Python/fontTools 4.61.1. No network, Git writes, or full sources.
Inputs are snapshotted using read-only git show; outputs are staged in scratch, proved,
then compared to the two prepared Discord font paths. Application files are read-only.
"""
import copy
import hashlib
import io
import json
from pathlib import Path
import subprocess

import fontTools
from fontTools.merge import Merger
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = Path.cwd()
HERE = ROOT / ".superpowers/sdd/2026-10-29-font-reproduction"
HERE.mkdir(parents=True, exist_ok=True)
BASE = "13c386e5983fe58ff17ac08fb5712239feb2e696"
REFERENCE = "cea587fa276b502a246f6c5fe0d1cfe9a03ef55f"
EXPECTED = {"JP": {0x53CE}, "SC": {0x4ECD, 0x53CE, 0x800C}}
CORE_TABLES = {"GlyphOrder", "head", "hhea", "vhea", "maxp", "OS/2", "hmtx", "vmtx", "cmap", "loca", "glyf", "name", "post", "prep", "gasp"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def raw(font, tag):
    return font.getTableData(tag)


def instruction_bytes(font, name):
    glyph = font["glyf"][name]  # expand, including lazy glyphs
    return bytes(glyph.program.getBytecode()) if hasattr(glyph, "program") else b""


def glyph_signature(font, name):
    gs = font.getGlyphSet()
    pen = DecomposingRecordingPen(gs)
    gs[name].draw(pen)
    return {"hmtx": font["hmtx"][name], "vmtx": font["vmtx"][name],
            "outline": pen.value, "instructions": instruction_bytes(font, name).hex()}


def font_metadata(font):
    return {tag: raw(font, tag).hex() for tag in ("name", "OS/2", "STAT", "BASE", "prep", "gasp")}


def normalized_digest(value):
    return sha(json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode())


def assemble(face):
    rel = f"apps/discord-worker/src/fonts/NotoSans{face}-Subset.ttf"
    old_bytes = subprocess.check_output(["git", "show", f"{BASE}:{rel}"], cwd=ROOT)
    ref_bytes = subprocess.check_output(["git", "show", f"{REFERENCE}:{rel}"], cwd=ROOT)
    (HERE / f"old-{face}.ttf").write_bytes(old_bytes)
    (HERE / f"reference-{face}.ttf").write_bytes(ref_bytes)
    base = TTFont(io.BytesIO(old_bytes), recalcTimestamp=False)
    ref = TTFont(io.BytesIO(ref_bytes), recalcTimestamp=False)
    old_map, ref_map = base.getBestCmap(), ref.getBestCmap()
    added = set(ref_map) - set(old_map)
    require(added == EXPECTED[face], f"{face}: unexpected added cmap: {added}")
    require(base["OS/2"].usWeightClass == ref["OS/2"].usWeightClass == 400, "must be static regular 400")
    require("fvar" not in base and "fvar" not in ref, "variable font input")
    require(base["head"].unitsPerEm == ref["head"].unitsPerEm, "unitsPerEm differs")
    # Merger does not map hint programs from later donors. Fail before invoking it
    # if there is any per-glyph hinting to lose, or any global hint difference.
    for source in (base, ref):
        require(not any(instruction_bytes(source, n) for n in source.getGlyphOrder()), "hinted input: use canonical full source instead")
    for tag in ("prep", "fpgm", "cvt ", "gasp"):
        require((tag in base) == (tag in ref), f"{tag}: presence differs")
        if tag in base:
            require(raw(base, tag) == raw(ref, tag), f"{tag}: source hint tables differ")

    donor = TTFont(io.BytesIO(ref_bytes), recalcTimestamp=False)
    options = Options()
    options.layout_features = []
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.name_legacy = True
    subset = Subsetter(options=options)
    subset.populate(unicodes=sorted(added))
    subset.subset(donor)
    require(set(donor.getBestCmap()) == added, "donor cmap includes unexpected characters")

    # Strip layout only in scratch merger inputs. The original layout tables are
    # restored exactly because every original glyph ID remains in its position.
    # This also avoids unsupported BASE/STAT merge logic and duplicate lookups.
    original_order = list(base.getGlyphOrder())
    for font, label in ((base, "merge-base"), (donor, "donor")):
        for tag in list(font.keys()):
            if tag not in CORE_TABLES:
                del font[tag]
        font.recalcTimestamp = False
        font.save(HERE / f"{label}-{face}.ttf")
    merged = Merger().merge([str(HERE / f"merge-base-{face}.ttf"), str(HERE / f"donor-{face}.ttf")])
    require(merged.getGlyphOrder()[:len(original_order)] == original_order, "original glyph IDs changed")
    merged_map = merged.getBestCmap()
    original = TTFont(io.BytesIO(old_bytes), recalcTimestamp=False)
    # Preserve all original tables except the glyph storage and glyph-count data.
    # hhea/vhea count fields are necessarily recalculated on compilation.
    for tag in original.keys():
        if tag not in {"GlyphOrder", "glyf", "loca", "hmtx", "vmtx", "maxp"}:
            merged[tag] = copy.deepcopy(original[tag])
    for table in merged["cmap"].tables:
        require(table.isUnicode() and table.format == 4, "unhandled original cmap subtable")
        for cp in sorted(added):
            table.cmap[cp] = merged_map[cp]
    merged.recalcTimestamp = False
    merged.recalcBBoxes = False
    candidate = HERE / f"union-{face}.ttf"
    merged.save(candidate)
    out = TTFont(candidate, recalcTimestamp=False)
    require(set(out.keys()) == set(original.keys()), "table set changed")
    require(set(out.getBestCmap()) == set(old_map) | added, "output cmap is not exact union")
    require(out.getGlyphOrder()[:len(original_order)] == original_order, "saved glyph IDs changed")
    require(font_metadata(original) == font_metadata(out), "metadata/global hints changed")
    # Layout tables byte comparison proves old GSUB/GPOS behavior is preserved.
    for tag in ("BASE", "GSUB", "GPOS", "STAT", "name", "OS/2", "post", "prep", "gasp"):
        require(raw(original, tag) == raw(out, tag), f"{tag}: binary differs")
    for tag in ("head", "hhea", "vhea", "maxp"):
        ignored = {"head": {"checkSumAdjustment", "indexToLocFormat"}, "hhea": {"numberOfHMetrics"}, "vhea": {"numberOfVMetrics"}, "maxp": {"numGlyphs"}}[tag]
        a = {k: v for k, v in vars(original[tag]).items() if k not in ignored}
        b = {k: v for k, v in vars(out[tag]).items() if k not in ignored}
        require(a == b, f"{tag}: metadata differs: {[(k, a.get(k), b.get(k)) for k in set(a) | set(b) if a.get(k) != b.get(k)]}")
    base_signatures, output_signatures = {}, {}
    for name in original_order:
        a, b = glyph_signature(original, name), glyph_signature(out, name)
        require(a == b, f"old glyph differs: {name}")
        # Compare records recompiled after fontTools expansion, not original raw file slices.
        require(original["glyf"][name].compile(original["glyf"]) == out["glyf"][name].compile(out["glyf"]), f"raw old glyph differs: {name}")
        base_signatures[name], output_signatures[name] = a, b
    new_proofs = []
    for cp in sorted(added):
        a = glyph_signature(ref, ref_map[cp])
        b = glyph_signature(out, out.getBestCmap()[cp])
        require(a == b, f"new glyph differs from reference U+{cp:04X}")
        require(a["outline"], f"empty donor outline U+{cp:04X}")
        new_proofs.append({"codepoint": f"U+{cp:04X}", "reference_signature_sha256": normalized_digest(a), "output_signature_sha256": normalized_digest(b)})
    (HERE / f"render-input-{face}.json").write_text(json.dumps({"family": f"Noto Sans {face}", "old_codepoints": sorted(old_map), "new_codepoints": sorted(added)}, indent=2) + "\n", encoding="utf-8")
    # Verify the prepared runtime bytes without writing application files.
    require((ROOT / rel).read_bytes() == candidate.read_bytes(), "prepared font differs from reproduced union")
    return {"face": face, "base_revision": subprocess.check_output(["git", "rev-parse", BASE], cwd=ROOT, text=True).strip(), "reference_revision": subprocess.check_output(["git", "rev-parse", REFERENCE], cwd=ROOT, text=True).strip(),
            "base_sha256": sha(old_bytes), "reference_sha256": sha(ref_bytes),
            "output_sha256": sha(candidate.read_bytes()), "base_bytes": len(old_bytes), "output_bytes": candidate.stat().st_size,
            "base_cmap_count": len(old_map), "output_cmap_count": len(out.getBestCmap()),
            "old_glyph_count_verified": len(original_order), "old_codepoints_verified": len(old_map),
            "old_all_glyph_signature_sha256": normalized_digest(base_signatures), "output_old_all_glyph_signature_sha256": normalized_digest(output_signatures),
            "new_glyphs": new_proofs, "removed_codepoints": [], "static_weight": out["OS/2"].usWeightClass,
            "original_layout_tables_byte_identical": True, "old_expanded_recompiled_glyph_records_equal": True,
            "metadata_byte_identical_tables": ["name", "OS/2", "post", "BASE", "STAT", "prep", "gasp"],
            "global_metric_fields_unchanged": True, "glyph_hint_programs_present": False}


if __name__ == "__main__":
    require(fontTools.__version__ == "4.61.1", "reproducibility requires fontTools 4.61.1")
    report = {"fonttools_version": fontTools.__version__, "assembly": [assemble(face) for face in ("JP", "SC")], "resvg_pixel_proof": "separate receipt required", "production_acceptance": "HOLD"}
    (HERE / "normalized-proof.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
