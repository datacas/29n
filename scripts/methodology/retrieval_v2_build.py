#!/usr/bin/env python3
"""Paso 2 de la prueba de recuperación v2 (LOCAL): recuperador híbrido B-2.0.0 = B-1.0.0 con la segmentación v2 (BM25 V7 + BGE-M3 por RRF, 25 candidatos, bge-reranker-v2-m3, K=10).
Modelos de recuperación LOCALES (GPU), sin llamadas a modelos de lenguaje ni a servicios externos. Lee los pasajes/rankings de retrieval_v2_export.mjs. Solo celdas de S."""
import json, sys, hashlib, pathlib, time
import numpy as np, torch
from sentence_transformers import SentenceTransformer, CrossEncoder
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
cfg = json.load(open('docs/methodology/fase2/retriever-config-B2.json')); h = hashlib.sha256(json.dumps(cfg, sort_keys=True).encode()).hexdigest()
base = pathlib.Path('docs/methodology/local/out/v2'); (base / 'cache').mkdir(exist_ok=True)
cells = json.load(open(base / 'cells_pilot.json'))['cells']
emb_model = SentenceTransformer(cfg['dense']['model'], device=DEVICE); emb_model.max_seq_length = cfg['dense']['max_seq_length']
ce = CrossEncoder(cfg['reranker']['model'], device=DEVICE, max_length=cfg['reranker']['max_length'])
emb, texts = {}, {}
for c in cells:
    if c['party'] in texts: continue
    ps = json.load(open(base / f"passages_{c['slug']}.json")); texts[c['party']] = ps
    key = hashlib.sha256((cfg['dense']['model'] + '\n' + '\n'.join(p['text'] for p in ps)).encode()).hexdigest()[:16]
    f = base / 'cache' / f"{cfg['dense']['model'].replace('/', '_')}_{c['slug']}_{key}.npy"
    if f.exists(): emb[c['party']] = np.load(f)
    else:
        emb[c['party']] = emb_model.encode([p['text'] for p in ps], normalize_embeddings=True, batch_size=16, show_progress_bar=False).astype(np.float32); np.save(f, emb[c['party']])
def rrf(lists, k):
    s = {}
    for l in lists:
        for r, i in enumerate(l): s[i] = s.get(i, 0) + 1 / (cfg['fusion']['c'] + r + 1)
    return [i for i, _ in sorted(s.items(), key=lambda x: -x[1])[:k]]
out = {}; t0 = time.time()
for c in cells:
    q = c['item'] + ' ' + c['context']
    v = emb_model.encode([q + ' ' + c['expansion_es']], normalize_embeddings=True, show_progress_bar=False)[0].astype(np.float32)
    dense = [int(i) for i in np.argsort(-(emb[c['party']] @ v))[:200]]
    pool = rrf([c['bm25_v7'], dense], cfg['pool'])
    sc = ce.predict([(q, texts[c['party']][i]['text']) for i in pool], batch_size=8, show_progress_bar=False)
    top = [pool[j] for j in np.argsort(-sc)][:cfg['k']]
    out[c['cellId']] = [{'page': texts[c['party']][i]['page'], 'pages': texts[c['party']][i].get('pages'), 'extended': texts[c['party']][i].get('extended', False), 'score': round(float(sc[pool.index(i)]), 3), 'text': texts[c['party']][i]['text'][:1800]} for i in top]
json.dump({'config': cfg['version'], 'config_sha256': h, 'k': cfg['k'], 'cells': out}, open(base / 'pack_v2_pilot.json', 'w'), ensure_ascii=False)
print(json.dumps({'celdas': len(cells), 'segundos': round(time.time() - t0), 'config_sha256': h[:12], 'dispositivo': DEVICE}))
