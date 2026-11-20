#!/usr/bin/env python3
"""Összefűzi a HU alapadatokat + RO/EN/DE fordításokat + PubMed linkeket egy önálló HTML-be."""
import json, os, sys, re

# keep the final print from raising UnicodeEncodeError on a non-UTF-8 console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = HERE
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "index.html")

def load(name, required=True):
    p = os.path.join(DATA, name)
    if not os.path.exists(p):
        if required:
            raise SystemExit("HIÁNYZIK: " + p)
        return None
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)

hu = load("hu_data.json")
teas, sources, tagMap = hu["teas"], hu["sources"], hu["tagMap"]
ui = load("ui.json")
sources_tr = load("sources_tr.json")
videos = load("videos.json")

# --- fordítások összefűzése a 4 részből ---
tr = {}
missing_parts = []
for part in ("tr_A.json", "tr_B.json", "tr_C.json", "tr_D.json"):
    d = load(part, required=False)
    if d is None:
        missing_parts.append(part)
        continue
    for k, v in d.items():
        tr[str(int(k))] = v

links = load("links.json", required=False) or {}
links = {str(int(k)): v for k, v in links.items()}

# --- ellenőrzések ---
problems = []
LANGS = ("ro", "en", "de")
for i, tea in enumerate(teas):
    key = str(i)
    fields = ["name", "role", "hatas", "prep"]
    fields.append("tradText" if tea.get("traditional") else "clinical")
    if tea.get("warn"):
        fields.append("warn")
    if key not in tr:
        problems.append(f"tea {i}: nincs fordítás")
        continue
    for lg in LANGS:
        block = tr[key].get(lg)
        if not block:
            problems.append(f"tea {i}/{lg}: hiányzó nyelvi blokk")
            continue
        for fl in fields:
            val = block.get(fl)
            if not val or not str(val).strip():
                problems.append(f"tea {i}/{lg}: üres mező '{fl}'")
        # a prep sortörései maradjanak meg
        if tea.get("prep", "").count("\n") != str(block.get("prep", "")).count("\n"):
            problems.append(f"tea {i}/{lg}: prep sortörés-eltérés")

for lg in LANGS:
    arr = sources_tr.get(lg) or []
    if len(arr) != len(sources):
        problems.append(f"sources/{lg}: {len(arr)} != {len(sources)}")

for lg in ("hu",) + LANGS:
    if lg not in ui:
        problems.append(f"ui: hiányzó nyelv {lg}")

# videos.json: 1 to 48 slots, id is "" or a unique 11-char YouTube id, t is [line1, line2]
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
MAX_VIDEOS = 48
if not isinstance(videos, list) or not 1 <= len(videos) <= MAX_VIDEOS:
    problems.append(f"videos: must be a list of 1 to {MAX_VIDEOS} items "
                    f"(got {len(videos) if isinstance(videos, list) else type(videos).__name__})")
    videos = videos if isinstance(videos, list) else []
seen_ids = {}
for n, v in enumerate(videos, 1):
    vid = v.get("id") if isinstance(v, dict) else None
    if isinstance(vid, str) and vid:
        if vid in seen_ids:
            raise SystemExit(f"videos: duplicate id {vid!r} (entries {seen_ids[vid]} and {n})")
        seen_ids[vid] = n
for n, v in enumerate(videos, 1):
    if not isinstance(v, dict):
        problems.append(f"videos {n}: not an object")
        continue
    vid = v.get("id")
    if not isinstance(vid, str) or (vid != "" and not VIDEO_ID.match(vid)):
        problems.append(f"videos {n}: invalid id {vid!r}")
    vt = v.get("t")
    if not isinstance(vt, list) or len(vt) != 2 or not all(isinstance(x, str) for x in vt):
        problems.append(f"videos {n}: 't' must be a list of exactly 2 strings")

link_count = sum(len(v) for v in links.values())
no_link = [i for i in range(len(teas)) if not links.get(str(i))]

# --- PubMed keresőkifejezés minden teához (így MINDIG van link a leírás alatt) ---
QUERY_OVERRIDE = {
    12: "Prunus cerasus stem OR tart cherry",
    27: "ginger nausea OR honey cough children",
}
FILTER = ' AND (randomized controlled trial[pt] OR meta-analysis[pt] OR systematic review[pt] OR review[pt])'
for i, tea in enumerate(teas):
    base = QUERY_OVERRIDE.get(i) or re.sub(r"\s*\(.*?\)\s*", " ", tea["lat"]).strip()
    tea["q"] = base + FILTER
    tea["qname"] = base

data = {
    "teas": teas,
    "sources": sources,
    "tagMap": tagMap,
    "tr": tr,
    "sourcesTr": sources_tr,
    "ui": ui,
    "links": links,
    "videos": videos,
}

payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
# a <script> blokkba biztonságosan beágyazható legyen
payload = payload.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")

with open(os.path.join(HERE, "template.html"), encoding="utf-8") as fh:
    tpl = fh.read()
if "__APPDATA__" not in tpl:
    raise SystemExit("A sablonból hiányzik a __APPDATA__ jelölő")
html = tpl.replace("__APPDATA__", payload)

with open(OUT, "w", encoding="utf-8") as fh:
    fh.write(html)

print(f"KÉSZ: {OUT}  ({len(html)/1024:.0f} KB)")
print(f"teák: {len(teas)} · nyelvek: hu, ro, en, de · linkek: {link_count} db, "
      f"{len(teas)-len(no_link)}/{len(teas)} teához")
print(f"videók: {sum(1 for v in videos if isinstance(v, dict) and v.get('id'))}/{len(videos)} kitöltve")
if no_link:
    print("link nélküli teák:", no_link)
if missing_parts:
    print("hiányzó fordítási részek:", missing_parts)
if problems:
    print("\nFIGYELEM – ellenőrzési hibák:")
    for p in problems[:40]:
        print("  -", p)
    print(f"  összesen: {len(problems)}")
else:
    print("Minden ellenőrzés rendben.")
