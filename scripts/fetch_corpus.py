"""Download the author-published CC BY-SA screenplay; preserve page provenance."""
import json
import re
import urllib.request
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://www.valkaama.com/download.php?target=media%2Fscript%2FValkaama_v.2007-06-30%28English-Final%29.pdf'
DEST = ROOT / 'data' / 'raw' / 'valkaama-en.pdf'
DEST.parent.mkdir(parents=True, exist_ok=True)
if not DEST.exists():
    req = urllib.request.Request(URL, headers={'User-Agent': 'FauxRaccord/1.0 educational research'})
    with urllib.request.urlopen(req, timeout=45) as response:
        content = response.read(10 * 1024 * 1024)
    if not content.startswith(b'%PDF'):
        raise ValueError('The source did not return a PDF')
    DEST.write_bytes(content)
pages = []
with pdfplumber.open(str(DEST)) as doc:
    for i, page in enumerate(doc.pages):
        text = page.extract_text() or ''
        if i == 0 and 'VALKAAMA' in text and 'screenplay by' in text:
            continue
        lines = [line for line in text.splitlines() if not re.match(r'^\s*\d+\s*$', line)]
        pages.append({'page': i + 1, 'text': '\n'.join(lines).strip()})
corpus = {
    'id': 'valkaama', 'title': 'Valkaama', 'author': 'Tim Baumann',
    'basedOn': 'Novel by Hendrik Behnisch', 'language': 'en',
    'license': 'CC BY-SA 3.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-sa/3.0/',
    'sourceUrl': 'https://www.valkaama.com/index.php?l=en&page=sources',
    'downloadUrl': URL, 'version': '2007-06-30', 'synthetic': False,
    'description': 'Scénario publié par le projet Valkaama. Certaines scènes sont absentes du film final.',
    'pages': pages, 'text': '\n\n'.join(p['text'] for p in pages)
}
(ROOT / 'data' / 'valkaama.json').write_text(json.dumps(corpus, ensure_ascii=False, indent=2), encoding='utf-8')
(ROOT / 'data' / 'valkaama.fountain').write_text(corpus['text'], encoding='utf-8')
print(json.dumps({'source': 'Valkaama', 'pages': len(pages), 'characters': len(corpus['text']), 'license': corpus['license']}))
