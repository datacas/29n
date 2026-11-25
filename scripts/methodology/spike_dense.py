#!/usr/bin/env python3
"""Spike de recuperación semántica e híbrida (solo preguntas de DESARROLLO; el conjunto E no interviene).
Compara, sobre las mismas celdas y los mismos párrafos que BM25: recuperación densa (embeddings multilingües locales) y
recuperación híbrida BM25 V7 + denso mediante RRF. Los embeddings solo recuperan candidatos: no demuestran apoyo ni oposición.
Referencia = párrafos que contienen la cita REGISTRADA (no independiente; no es toda la evidencia relevante).
Uso: python spike_dense.py <modelo_hf> [--prefix-e5]    Cachea los embeddings por (modelo, huella del corpus)."""
import json, sys, time, hashlib, resource, pathlib
import numpy as np
import torch
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'   # usa la GPU si el entorno la ve (WSL2 + CUDA); si no, CPU
from sentence_transformers import SentenceTransformer

model_name = sys.argv[1]; e5 = ('e5' in model_name.lower())
base = pathlib.Path('docs/methodology/local/out/spike'); data = json.load(open(base / 'cells.json')); cells = data['cells']; meta = data['meta']
KS = [6, 10, 15, 20]; C = 60
t0 = time.time(); model = SentenceTransformer(model_name, device=DEVICE); model.max_seq_length = 512; load_s = time.time() - t0
qp, pp = ('query: ', 'passage: ') if e5 else ('', '')
tag = model_name.replace('/', '_'); cdir = base / 'cache'; cdir.mkdir(exist_ok=True)
emb = {}; enc_s = 0.0
for party, info in meta['parties'].items():
    texts = [p['text'] for p in json.load(open(base / f"passages_{info['slug']}.json"))]
    key = hashlib.sha256((model_name + '\n' + '\n'.join(texts)).encode()).hexdigest()[:16]; f = cdir / f"{tag}_{info['slug']}_{key}.npy"
    if f.exists(): emb[party] = np.load(f)
    else:
        t = time.time(); emb[party] = model.encode([pp + x for x in texts], batch_size=16, normalize_embeddings=True, show_progress_bar=False).astype(np.float32); enc_s += time.time() - t; np.save(f, emb[party])
manifest = {'model': model_name, 'dim': int(next(iter(emb.values())).shape[1]), 'corpus_passages': meta['totalPassages'], 'corpus_sha': meta['corpusSha'][:16], 'encode_seconds_this_run': round(enc_s, 1), 'load_seconds': round(load_s, 1), 'device': DEVICE, 'max_seq_length': 512}
passages = {p: [x['text'] for x in json.load(open(base / f"passages_{i['slug']}.json"))] for p, i in meta['parties'].items()}

def rrf(lists, k=200):
    s = {}
    for l in lists:
        for r, i in enumerate(l): s[i] = s.get(i, 0) + 1 / (C + r + 1)
    return [i for i, _ in sorted(s.items(), key=lambda x: -x[1])[:k]]
qtimes = []
def dense(c, text):
    t = time.time(); q = model.encode([qp + text], normalize_embeddings=True, show_progress_bar=False)[0].astype(np.float32); qtimes.append(time.time() - t)
    sims = emb[c['party']] @ q; return [int(i) for i in np.argsort(-sims)[:200]], sims
VARS = ['bm25_v7', 'denso_ctx', 'denso_exp', 'denso_exp_idioma', 'hibrido_v7+denso_exp', 'hibrido_v7+denso_exp_idioma']
res = {v: {k: {'hit': 0, 'tok': 0, 'prec': 0.0} for k in KS} for v in VARS}; mrr = {v: 0.0 for v in VARS}; n_eval = 0
perc = []; strata = {}
for c in cells:
    hits = set(c['hit_idx'])
    if not hits: continue
    n_eval += 1
    base_q = c['item'] + ' ' + c['context']
    r = {'bm25_v7': c['bm25_v7']}
    r['denso_ctx'], _ = dense(c, base_q)
    r['denso_exp'], _ = dense(c, base_q + ' ' + c['expansion_es'])
    r['denso_exp_idioma'], _ = dense(c, base_q + ' ' + c['expansion_es'] + ' ' + c['expansion_lang'])
    r['hibrido_v7+denso_exp'] = rrf([r['bm25_v7'], r['denso_exp']])
    r['hibrido_v7+denso_exp_idioma'] = rrf([r['bm25_v7'], r['denso_exp_idioma']])
    row = {'cellId': c['cellId'], 'language': c['language'], 'intensity': c['intensity'], 'sign': c['sign']}
    for v in VARS:
        lst = r[v]; first = next((rk for rk, i in enumerate(lst[:20]) if i in hits), None)
        if first is not None: mrr[v] += 1 / (first + 1)
        for k in KS:
            top = lst[:k]; h = any(i in hits for i in top)
            res[v][k]['hit'] += h; res[v][k]['tok'] += sum(len(passages[c['party']][i]) for i in top) / 4; res[v][k]['prec'] += (sum(i in hits for i in top) / max(1, len(top)))
        row[v] = {k: bool(any(i in hits for i in lst[:k])) for k in KS}
    perc.append(row)
def pct(x): return round(100 * x, 1)
out = {'modelo': manifest, 'celdasEvaluadas': n_eval, 'referencia': 'párrafos con la cita registrada (no independiente)'}
out['variantes'] = {v: {'mrr': round(mrr[v] / n_eval, 3), **{f'K{k}': {'recall': pct(res[v][k]['hit'] / n_eval), 'tokensMedios': round(res[v][k]['tok'] / n_eval), 'precision': pct(res[v][k]['prec'] / n_eval)} for k in KS}} for v in VARS}
def strat(keyf):
    g = {}
    for row in perc:
        a = g.setdefault(keyf(row), {'n': 0, **{v: 0 for v in VARS}}); a['n'] += 1
        for v in VARS: a[v] += row[v][15]
    return {k: {'n': a['n'], **{v: pct(a[v] / a['n']) for v in VARS}} for k, a in g.items()}
out['estratos_K15'] = {'idioma': strat(lambda r: r['language']), 'intensidad': strat(lambda r: '±%d' % r['intensity']), 'signo': strat(lambda r: r['sign'])}
for k in (15, 20):
    b = [r['bm25_v7'][k] for r in perc]; d = [r['denso_exp_idioma'][k] for r in perc]; hy = [r['hibrido_v7+denso_exp_idioma'][k] for r in perc]
    out[f'solapamiento_K{k}'] = {'ambos': sum(x and y for x, y in zip(b, d)), 'solo_bm25': sum(x and not y for x, y in zip(b, d)), 'solo_denso': sum(y and not x for x, y in zip(b, d)), 'ninguno': sum((not x) and (not y) for x, y in zip(b, d)), 'hibrido_recupera_lo_que_bm25_no': sum(h and not x for x, h in zip(b, hy))}
out['recursos'] = {'consulta_ms_media': round(1000 * float(np.mean(qtimes)), 1), 'ram_pico_MB': round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024), 'coste_usd': 0.0}
json.dump(out, open(base / f'results_{tag}.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'modelo': model_name, 'celdas': n_eval, **{v: {f'K{k}': out['variantes'][v][f'K{k}']['recall'] for k in KS} for v in VARS}, 'mrr': {v: out['variantes'][v]['mrr'] for v in VARS}, 'codificacion_s': manifest['encode_seconds_this_run'], 'recursos': out['recursos']}, ensure_ascii=False))
