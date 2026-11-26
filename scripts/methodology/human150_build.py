#!/usr/bin/env python3
"""Paso 2 (LOCAL) de los paquetes de evidencia de la campaña humana: recuperador híbrido B-1.0.0 CONGELADO (BM25 V7 + BGE-M3 por RRF, 25 candidatos, bge-reranker-v2-m3, K=10).
Se niega a ejecutar si la configuración no coincide con la huella congelada. Modelos de recuperación LOCALES (GPU); sin llamadas a modelos de lenguaje. Solo desarrollo; E sellado."""
import json, sys, hashlib, pathlib, time
import numpy as np, torch
from sentence_transformers import SentenceTransformer, CrossEncoder
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
cfg = json.load(open('docs/methodology/fase1/retriever-config-B.json')); frozen = json.load(open('docs/methodology/local/retriever_frozen.json'))
h = hashlib.sha256(json.dumps(cfg, sort_keys=True).encode()).hexdigest()
if not frozen or frozen['sha256'] != h: sys.exit('La configuración del recuperador no está congelada o ha cambiado (retriever_frozen.json).')
base = pathlib.Path('docs/methodology/local/out'); sp = base / 'spike'; out_dir = base / 'h150'
cells = json.load(open(out_dir / 'cells_h150.json'))['cells']; meta = json.load(open(sp / 'cells.json'))['meta']
emb_model = SentenceTransformer(cfg['dense']['model'], device=DEVICE); emb_model.max_seq_length = cfg['dense']['max_seq_length']; ce = CrossEncoder(cfg['reranker']['model'], device=DEVICE, max_length=cfg['reranker']['max_length'])
emb, texts = {}, {}
for c in cells:
    party = c['party']
    if party in texts: continue
    info = meta['parties'][party]; ps = json.load(open(sp / f"passages_{info['slug']}.json")); texts[party] = ps
    key = hashlib.sha256((cfg['dense']['model'] + '\n' + '\n'.join(p['text'] for p in ps)).encode()).hexdigest()[:16]
    f = sp / 'cache' / f"{cfg['dense']['model'].replace('/', '_')}_{info['slug']}_{key}.npy"
    if f.exists(): emb[party] = np.load(f)
    else:
        emb[party] = emb_model.encode([p['text'] for p in ps], normalize_embeddings=True, batch_size=16, show_progress_bar=False).astype(np.float32); np.save(f, emb[party])
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
    out[c['cellId']] = [{'page': texts[c['party']][i]['page'], 'score': round(float(sc[pool.index(i)]), 3), 'text': texts[c['party']][i]['text'][:1200]} for i in top]
json.dump({'config': cfg['version'], 'config_sha256': h, 'k': cfg['k'], 'generado': time.strftime('%Y-%m-%dT%H:%M:%S'), 'cells': out}, open(out_dir / 'evidence_pack.json', 'w'), ensure_ascii=False)
print(json.dumps({'celdas': len(cells), 'segundos': round(time.time() - t0), 'config_sha256': h[:12], 'dispositivo': DEVICE}))
