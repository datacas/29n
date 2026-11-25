#!/usr/bin/env python3
"""Recuperación con TRADUCCIÓN AUXILIAR al castellano (ERC, Compromís, BNG), solo celdas de DESARROLLO (E excluido). Compara el índice original, el traducido y
sus combinaciones (BM25, BGE-M3 denso, RRF). La referencia sigue siendo la cita registrada del documento ORIGINAL (mismos índices de párrafo);
la traducción solo sirve para encontrar candidatos. n pequeño (ca 57, gl 28): resultados orientativos."""
import json, re, math, unicodedata, pathlib, hashlib, glob
import numpy as np, torch
from sentence_transformers import SentenceTransformer
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
base = pathlib.Path('docs/methodology/local/out/spike'); data = json.load(open(base / 'cells.json')); meta = data['meta']
cells = [c for c in data['cells'] if c['hit_idx'] and c['language'] in ('ca', 'gl')]
STOP = set('de la el los las un una unos unas y o u e en a al del por para con sin que se su sus lo le les como mas ser debe deben deberia hacia sobre entre este esta estos estas ese esa es son ha han hay no si'.split())
SUF = re.compile(r'(aciones|acion|amientos|amiento|imientos|imiento|idades|idad|mente|ando|iendo|ados|adas|idos|idas|ado|ada|ido|ida|ares|eres|ires|ar|er|ir|es|os|as|s)$')
def stem(w):
    m = SUF.search(w); return w[:len(w) - len(m.group(0))] if m and len(w) - len(m.group(0)) >= 4 else w
def toks(s):
    s = unicodedata.normalize('NFD', s.lower()); s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn'); s = re.sub(r'[^a-z0-9ñ\s]', ' ', s)
    return [stem(w) for w in s.split() if len(w) > 2 and w not in STOP]
def bm25_index(docs):
    tf = [{} for _ in docs]
    for i, d in enumerate(docs):
        for w in toks(d): tf[i][w] = tf[i].get(w, 0) + 1
    df = {}
    for t in tf:
        for w in t: df[w] = df.get(w, 0) + 1
    ln = [sum(t.values()) for t in tf]; return {'tf': tf, 'df': df, 'ln': ln, 'avg': sum(ln) / len(ln), 'N': len(docs)}
def bm25(ix, q, k=200, k1=1.5, b=0.75):
    sc = []
    for i, t in enumerate(ix['tf']):
        s = 0
        for w in set(q):
            f = t.get(w)
            if not f: continue
            d = ix['df'].get(w, 0); s += math.log(1 + (ix['N'] - d + 0.5) / (d + 0.5)) * f * (k1 + 1) / (f + k1 * (1 - b + b * ix['ln'][i] / ix['avg']))
        if s > 0: sc.append((s, i))
    return [i for _, i in sorted(sc, reverse=True)[:k]]
def rrf(lists, k=200, c=60):
    s = {}
    for l in lists:
        for r, i in enumerate(l): s[i] = s.get(i, 0) + 1 / (c + r + 1)
    return [i for i, _ in sorted(s.items(), key=lambda x: -x[1])[:k]]
model = SentenceTransformer('BAAI/bge-m3', device=DEVICE); model.max_seq_length = 512
orig, trans, emb_o, emb_t, ix_t = {}, {}, {}, {}, {}
for party, info in meta['parties'].items():
    if info['language'] == 'es': continue
    ps = json.load(open(base / f"passages_{info['slug']}.json")); orig[party] = [p['text'] for p in ps]
    key = hashlib.sha256(('BAAI/bge-m3' + '\n' + '\n'.join(orig[party])).encode()).hexdigest()[:16]; emb_o[party] = np.load(base / 'cache' / f"BAAI_bge-m3_{info['slug']}_{key}.npy")
    tf = [json.load(open(f)) for f in glob.glob(str(base / 'cache' / f"translation_{info['slug']}_*.json"))][0]; trans[party] = [p['translation'] for p in tf['paragraphs']]
    emb_t[party] = model.encode(trans[party], batch_size=16, normalize_embeddings=True, show_progress_bar=False).astype(np.float32); ix_t[party] = bm25_index(trans[party])
KS = [6, 10, 15]; V = ['original_bm25_v7', 'original_denso', 'original_hibrido', 'trad_bm25', 'trad_denso', 'trad_hibrido', 'original+trad_denso', 'hibrido_4_listas']
acc = {v: {k: [] for k in KS} for v in V}; langs = []
for c in cells:
    q = c['item'] + ' ' + c['context']; hits = set(c['hit_idx']); p = c['party']
    qv = model.encode([q + ' ' + c['expansion_es'] + ' ' + c['expansion_lang']], normalize_embeddings=True, show_progress_bar=False)[0].astype(np.float32)
    d_o = [int(i) for i in np.argsort(-(emb_o[p] @ qv))[:200]]; d_t = [int(i) for i in np.argsort(-(emb_t[p] @ qv))[:200]]
    b_t = bm25(ix_t[p], toks(q + ' ' + c['expansion_es']))
    L = {'original_bm25_v7': c['bm25_v7'], 'original_denso': d_o, 'original_hibrido': rrf([c['bm25_v7'], d_o]), 'trad_bm25': b_t, 'trad_denso': d_t, 'trad_hibrido': rrf([b_t, d_t]), 'original+trad_denso': rrf([d_o, d_t]), 'hibrido_4_listas': rrf([c['bm25_v7'], d_o, b_t, d_t])}
    for v in V:
        for k in KS: acc[v][k].append(bool(set(L[v][:k]) & hits))
    langs.append(c['language'])
langs = np.array(langs); out = {'celdas': len(cells), 'por_idioma_n': {l: int((langs == l).sum()) for l in ('ca', 'gl')}, 'recall': {}}
for v in V:
    out['recall'][v] = {f'K{k}': {'todas': round(100 * float(np.mean(acc[v][k])), 1), 'ca': round(100 * float(np.mean(np.array(acc[v][k])[langs == 'ca'])), 1), 'gl': round(100 * float(np.mean(np.array(acc[v][k])[langs == 'gl'])), 1)} for k in KS}
json.dump(out, open(base / 'results_traduccion.json', 'w'), ensure_ascii=False, indent=1)
print(f"n={out['celdas']} {out['por_idioma_n']}"); print(f"{'variante':24}" + ''.join(f"  K{k}: todas/ca/gl      " for k in KS))
for v in V: print(f"{v:24}" + ''.join(f"  {out['recall'][v]['K%d' % k]['todas']:>5}/{out['recall'][v]['K%d' % k]['ca']:>5}/{out['recall'][v]['K%d' % k]['gl']:>5}" for k in KS))
