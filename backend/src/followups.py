"""Zero-LLM helpers for the follow-up question flow and trust checks.

Schema-agnostic: pass plain strings/dicts and adapt field names at the call site.
Drop into backend/src/followups.py.
"""
import re

# (keywords found in the gap text, question, why it matters). First match wins, so order matters.
QUESTION_TEMPLATES = [
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


def questions_from_gaps(gaps):
    """gaps: list of strings, or dicts whose values describe the gap."""
    out = []
    for i, gap in enumerate(gaps):
        text = gap if isinstance(gap, str) else " ".join(str(v) for v in gap.values())
        low = text.lower()
        question = why = None
        for keys, q, w in QUESTION_TEMPLATES:
            if any(k in low for k in keys):
                question, why = q, w
                break
        if question is None:
            question = f"Can you provide the missing information: {text.strip()[:120]}?"
            why = "The brief cannot be finalised without it."
        out.append({"id": f"q{i + 1}", "gap": text, "question": question, "why_it_matters": why})
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
    """Numbers in generated text that appear in none of the cited facts.

    Treat the result as 'needs a look', not as proof of error (years and counts can be fine).
    Small whole numbers (e.g. '6 sections') are ignored.
    """
    source = _numbers(" ".join(cited_fact_texts))
    flagged = []
    for n in sorted(_numbers(section_text), key=float):
        if "." not in n and float(n) < ignore_below:
            continue
        if n not in source:
            flagged.append(n)
    return flagged


if __name__ == "__main__":
    print(questions_from_gaps(["Target retail price not found", "Print run quantity missing", "Brand voice unclear"]))
    print(ungrounded_numbers("The pack holds 480 g, priced at 4.50, shelf life 18 months.", ["Net weight: 480 g", "Price 4.5"]))