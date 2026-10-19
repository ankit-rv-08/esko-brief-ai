import re
import json

QUESTION_TEMPLATES = [
    (("legal name", "statement of identity"),
     "What legal name / statement of identity should appear on the pack?",
     "The statement of identity is mandatory on the front panel."),
    (("print run", "print quantity", "print volume"),
     "What is the expected print run (number of units)?",
     "The print run affects the printing process and material choices."),
    (("price", "rrp", "msrp"),
     "What is the target retail price (and currency)?",
     "The agency needs it to position the pack as value, standard or premium."),
    (("ingredient",),
     "What is the full ingredient list, in descending order by weight?",
     "Ingredients are mandatory content and drive allergen call-outs."),
    (("allergen",),
     "Which allergens must be declared on the pack?",
     "Allergen statements are regulated and must appear on pack."),
    (("net weight", "net quantity", "net content", "pack size"),
     "What net quantity / pack size should be printed on the pack?",
     "Net quantity is mandatory and must match the approved product data."),
    (("logo",),
     "Should the existing logo stay unchanged?",
     "Designers need to know whether brand marks are fixed or open to change."),
    (("barcode", "gtin", "ean"),
     "What is the GTIN / barcode number?",
     "The barcode must be placed and verified before print."),
    (("claim", "certification", "certified"),
     "Which claims or certifications are approved for this pack?",
     "Unverified claims are a regulatory risk."),
    (("storage", "shelf life", "best before"),
     "What storage instructions and shelf life apply?",
     "These are required statements on most food packs."),
    (("country", "market", "region"),
     "Which country or market will this pack be sold in?",
     "Mandatory content differs by market."),
]

def _gap_text(gap):
    if isinstance(gap, str):
        return gap
    if isinstance(gap, dict):
        return " ".join(str(v) for v in gap.values())
    for attr in ("field", "reason", "description", "name"):
        value = getattr(gap, attr, None)
        if value:
            return str(value)
    return str(gap)

def questions_from_gaps(gaps, fact_texts=None):
    blob = ""
    if fact_texts:
        blob = re.sub(r"[_\-]+", " ", " ".join(fact_texts).lower())

    out = []
    for gap in gaps:
        text = _gap_text(gap)
        low = re.sub(r"[_\-]+", " ", text.lower())
        match = next(
            ((keys, q, w) for keys, q, w in QUESTION_TEMPLATES if any(k in low for k in keys)),
            None,
        )
        if match:
            keys, question, why = match
            if blob and any(k in blob for k in keys):
                continue  # the facts already answer this
        else:
            question = f"Can you provide the missing information: {text.strip()[:120]}?"
            why = "The brief cannot be finalised without it."
        out.append({"id": f"q{len(out) + 1}", "gap": text, "question": question, "why_it_matters": why})
    return out

NUM = re.compile(r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?")

def _numbers(text):
    found = set()
    for n in NUM.findall(text):
        n = n.replace(",", "")
        if "." in n:
            n = n.rstrip("0").rstrip(".")
        found.add(n)
    return found

def ungrounded_numbers(section_text, cited_fact_texts, ignore_below=10):
    source = _numbers(" ".join(cited_fact_texts))
    flagged = []
    for n in sorted(_numbers(section_text), key=float):
        if "." not in n and float(n) < ignore_below:
            continue
        if n not in source:
            flagged.append(n)
    return flagged
