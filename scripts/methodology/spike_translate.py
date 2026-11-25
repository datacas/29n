#!/usr/bin/env python3
"""Traducción AUXILIAR al castellano de los programas en catalán y gallego (ERC, Compromís, BNG) para probarla como índice de recuperación.
Local (NLLB-200 600M destilado). Solo para recuperar candidatos: las citas y evidencias definitivas siguen siendo las del documento ORIGINAL.
Conserva la correspondencia documento → página → párrafo → traducción ↔ original (mismo índice que los párrafos originales). Cachea y versiona por modelo+huella."""
import json, pathlib, hashlib, time, sys
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
MODEL = 'facebook/nllb-200-distilled-600M'; LANG = {'ca': 'cat_Latn', 'gl': 'glg_Latn'}
base = pathlib.Path('docs/methodology/local/out/spike'); meta = json.load(open(base / 'cells.json'))['meta']
tok = AutoTokenizer.from_pretrained(MODEL); model = AutoModelForSeq2SeqLM.from_pretrained(MODEL, torch_dtype=torch.float16 if DEVICE == 'cuda' else torch.float32).to(DEVICE).eval()
done = {}
for party, info in meta['parties'].items():
    if info['language'] == 'es': continue
    passages = json.load(open(base / f"passages_{info['slug']}.json"))
    key = hashlib.sha256((MODEL + '\n' + '\n'.join(p['text'] for p in passages)).encode()).hexdigest()[:16]; f = base / 'cache' / f"translation_{info['slug']}_{key}.json"
    if f.exists(): done[party] = f.name; continue
    tok.src_lang = LANG[info['language']]; out = []; t0 = time.time()
    order = sorted(range(len(passages)), key=lambda i: len(passages[i]['text']))
    res = {}
    for s in range(0, len(order), 8):
        idx = order[s:s + 8]; enc = tok([passages[i]['text'] for i in idx], return_tensors='pt', padding=True, truncation=True, max_length=400).to(DEVICE)
        with torch.no_grad(): gen = model.generate(**enc, forced_bos_token_id=tok.convert_tokens_to_ids('spa_Latn'), max_new_tokens=450, num_beams=2)
        for i, t in zip(idx, tok.batch_decode(gen, skip_special_tokens=True)): res[i] = t
    out = [{'idx': i, 'page': passages[i]['page'], 'original': passages[i]['text'], 'translation': res[i]} for i in range(len(passages))]
    json.dump({'model': MODEL, 'src': info['language'], 'party': party, 'corpus_key': key, 'seconds': round(time.time() - t0, 1), 'paragraphs': out}, open(f, 'w'), ensure_ascii=False)
    done[party] = f.name; print(party, len(passages), 'párrafos', round(time.time() - t0), 's', flush=True)
print(json.dumps(done, ensure_ascii=False))
