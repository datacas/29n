#!/usr/bin/env python3
"""Modalidad B · paso 2: recuperador híbrido CONGELADO (BM25 V7 + BGE-M3 por RRF, 25 candidatos, bge-reranker-v2-m3, K=10) → paquete de B.
Lee la configuración de docs/methodology/fase1/retriever-config-B.json (con su huella) y se niega a ejecutar si cambia. No usa E."""
import json, sys, hashlib, pathlib, time
import numpy as np, torch
from sentence_transformers import SentenceTransformer, CrossEncoder
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
cfgp = pathlib.Path('docs/methodology/fase1/retriever-config-B.json'); cfg = json.load(open(cfgp)); frozen = json.load(open('docs/methodology/local/retriever_frozen.json')) if pathlib.Path('docs/methodology/local/retriever_frozen.json').exists() else None
h = hashlib.sha256(json.dumps(cfg, sort_keys=True).encode()).hexdigest()
if not frozen or frozen['sha256'] != h: sys.exit('La configuración del recuperador no está congelada o ha cambiado (retriever_frozen.json).')
SET = sys.argv[1] if len(sys.argv) > 1 else 'S'
if SET == 'E': sys.exit('E está sellado.')
base = pathlib.Path('docs/methodology/local/out'); sp = base / 'spike'
cells = json.load(open(base / 'packB' / f'cells_{SET}.json'))['cells']; pack = json.load(open(base / 'benchmark_pack.json'))
meta = json.load(open(sp / 'cells.json'))['meta']
emb_model = SentenceTransformer(cfg['dense']['model'], device=DEVICE); emb_model.max_seq_length = cfg['dense']['max_seq_length']; ce = CrossEncoder(cfg['reranker']['model'], device=DEVICE, max_length=cfg['reranker']['max_length'])
emb, texts = {}, {}
for party, info in meta['parties'].items():
    ps = json.load(open(sp / f"passages_{info['slug']}.json")); texts[party] = ps
    key = hashlib.sha256((cfg['dense']['model'] + '\n' + '\n'.join(p['text'] for p in ps)).encode()).hexdigest()[:16]; emb[party] = np.load(sp / 'cache' / f"{cfg['dense']['model'].replace('/', '_')}_{info['slug']}_{key}.npy")
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
newpack = {'meta': {**pack['meta'], 'retriever': cfg['name'], 'retriever_config_sha256': h, 'k': cfg['k'], 'generado': [SET], 'cells': {SET: len(cells)}, 'note': 'Modalidad B: passagesB sustituido por la recuperación híbrida congelada. passagesA no se usa en B.'}, 'S': [], 'D': [], 'E': []}
for c in pack[SET]:
    n = {k: v for k, v in c.items() if k != 'passagesA'}; n['passagesB'] = out[c['cellId']]; n['passagesA'] = None; n['evidence_scope'] = {'B': 'passages_retrieved_hybrid_reranked', 'A': None}; newpack[SET].append(n)
json.dump(newpack, open(base / f'benchmark_pack_B_{SET}.json', 'w'), ensure_ascii=False)
print(json.dumps({'celdas': len(cells), 'segundos': round(time.time() - t0), 'config_sha256': h[:12], 'dispositivo': DEVICE}))
