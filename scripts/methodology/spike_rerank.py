#!/usr/bin/env python3
"""Spike · reordenación (reranking) local y gratuita con un cross-encoder multilingüe sobre los 25 mejores candidatos del híbrido
BM25 V7 + BGE-M3 (RRF). Solo preguntas de desarrollo; E no interviene. El reordenador solo mueve candidatos: no decide apoyo ni oposición.
Referencia = párrafos con la cita registrada (no independiente)."""
import json, sys, time, hashlib, pathlib, resource
import numpy as np
from sentence_transformers import SentenceTransformer, CrossEncoder
base = pathlib.Path('docs/methodology/local/out/spike'); data = json.load(open(base / 'cells.json')); meta = data['meta']; cells = [c for c in data['cells'] if c['hit_idx']]
RR = sys.argv[1] if len(sys.argv) > 1 else 'BAAI/bge-reranker-v2-m3'; POOL = 25; KS = [6, 10, 15]; C = 60
emb_model = SentenceTransformer('BAAI/bge-m3', device='cpu'); emb_model.max_seq_length = 512
emb = {}; passages = {}
for party, info in meta['parties'].items():
    texts = [p['text'] for p in json.load(open(base / f"passages_{info['slug']}.json"))]; passages[party] = texts
    key = hashlib.sha256(('BAAI/bge-m3' + '\n' + '\n'.join(texts)).encode()).hexdigest()[:16]; emb[party] = np.load(base / 'cache' / f"BAAI_bge-m3_{info['slug']}_{key}.npy")
ce = CrossEncoder(RR, device='cpu', max_length=512)
def rrf(lists, k=200):
    s = {}
    for l in lists:
        for r, i in enumerate(l): s[i] = s.get(i, 0) + 1 / (C + r + 1)
    return [i for i, _ in sorted(s.items(), key=lambda x: -x[1])[:k]]
res = {v: {k: 0 for k in KS} for v in ['hibrido', 'hibrido+reranker']}; mrr = {v: 0.0 for v in res}; times = []; strata = {}
for n, c in enumerate(cells):
    hits = set(c['hit_idx']); qtext = c['item'] + ' ' + c['context']
    q = emb_model.encode([qtext + ' ' + c['expansion_es']], normalize_embeddings=True, show_progress_bar=False)[0].astype(np.float32)
    dense = [int(i) for i in np.argsort(-(emb[c['party']] @ q))[:200]]
    hy = rrf([c['bm25_v7'], dense])[:POOL]
    t = time.time(); sc = ce.predict([(qtext, passages[c['party']][i]) for i in hy], batch_size=8, show_progress_bar=False); times.append(time.time() - t)
    rr = [hy[j] for j in np.argsort(-sc)]
    row = {'language': c['language'], 'intensity': c['intensity']}
    for name, lst in (('hibrido', hy), ('hibrido+reranker', rr)):
        first = next((r for r, i in enumerate(lst[:20]) if i in hits), None)
        if first is not None: mrr[name] += 1 / (first + 1)
        for k in KS:
            h = any(i in hits for i in lst[:k]); res[name][k] += h
            if k == 10: row[name] = h
    g = strata.setdefault((c['language']), {'n': 0, 'hibrido': 0, 'hibrido+reranker': 0}); g['n'] += 1; g['hibrido'] += row['hibrido']; g['hibrido+reranker'] += row['hibrido+reranker']
    g2 = strata.setdefault('±%d' % c['intensity'], {'n': 0, 'hibrido': 0, 'hibrido+reranker': 0}); g2['n'] += 1; g2['hibrido'] += row['hibrido']; g2['hibrido+reranker'] += row['hibrido+reranker']
    if n % 50 == 0: print(f'[{n}/{len(cells)}] {np.mean(times):.1f}s por celda', flush=True)
N = len(cells); pct = lambda x: round(100 * x / N, 1)
out = {'reranker': RR, 'celdas': N, 'pool': POOL, 'recall': {v: {f'K{k}': pct(res[v][k]) for k in KS} for v in res}, 'mrr': {v: round(mrr[v] / N, 3) for v in res}, 'segundos_por_celda_reranking': round(float(np.mean(times)), 2),
       'estratos_K10': {k: {'n': g['n'], 'hibrido': round(100 * g['hibrido'] / g['n'], 1), 'hibrido+reranker': round(100 * g['hibrido+reranker'] / g['n'], 1)} for k, g in strata.items()}, 'ram_pico_MB': round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024), 'coste_usd': 0.0}
json.dump(out, open(base / 'results_rerank.json', 'w'), ensure_ascii=False, indent=1); print(json.dumps(out, ensure_ascii=False))
