#!/usr/bin/env python3
"""Comparaciones PAREADAS del recall entre recuperadores sobre las mismas celdas de desarrollo (E excluido).
Para cada par y K: diferencia de recall, IC95 por bootstrap de celdas (10.000 remuestreos, semilla fija), celdas discordantes y p exacto de
McNemar (binomial bilateral). Aviso: son ~15 contrastes; no se corrige por comparaciones múltiples (Bonferroni orientativo: p < 0,05/15 ≈ 0,0033).
El recall se mide contra la cita REGISTRADA, que no es referencia independiente."""
import json, pathlib, math
import numpy as np
base = pathlib.Path('docs/methodology/local/out/spike')
dense = {r['cellId']: r for r in json.load(open(base / 'perc_BAAI_bge-m3.json'))}
rer = {r['cellId']: r for r in json.load(open(base / 'perc_rerank.json'))}
ids = [i for i in dense if i in rer]
def vec(sel, K): return np.array([sel(i, K) for i in ids], dtype=bool)
S = {'bm25_v7': lambda i, K: dense[i]['bm25_v7'][str(K)], 'denso_bge-m3': lambda i, K: dense[i]['denso_exp_idioma'][str(K)],
     'hibrido': lambda i, K: dense[i]['hibrido_v7+denso_exp_idioma'][str(K)], 'hibrido+reranker': lambda i, K: rer[i]['hibrido+reranker'][str(K)]}
def mcnemar(b, c):
    n = b + c
    if n == 0: return 1.0
    k = min(b, c); p = sum(math.comb(n, j) for j in range(0, k + 1)) / 2 ** n * 2
    return min(1.0, p)
rng = np.random.default_rng(29); out = []
PAIRS = [('hibrido', 'bm25_v7'), ('denso_bge-m3', 'bm25_v7'), ('hibrido+reranker', 'bm25_v7'), ('hibrido+reranker', 'hibrido'), ('hibrido', 'denso_bge-m3')]
for a, b in PAIRS:
    for K in (6, 10, 15):
        x, y = vec(S[a], K), vec(S[b], K); n = len(ids); d = x.astype(int) - y.astype(int)
        boots = [d[rng.integers(0, n, n)].mean() for _ in range(10000)]
        b01 = int(((~y) & x).sum()); b10 = int((y & (~x)).sum())
        out.append({'A': a, 'B': b, 'K': K, 'n': n, 'recall_A': round(100 * x.mean(), 1), 'recall_B': round(100 * y.mean(), 1), 'dif_pts': round(100 * d.mean(), 1), 'IC95': [round(100 * float(np.percentile(boots, 2.5)), 1), round(100 * float(np.percentile(boots, 97.5)), 1)], 'solo_A': b01, 'solo_B': b10, 'p_McNemar': round(mcnemar(b01, b10), 4)})
json.dump(out, open(base / 'stats_pareadas.json', 'w'), ensure_ascii=False, indent=1)
print(f"{'A':18}{'B':18}{'K':>3}{'A%':>7}{'B%':>7}{'dif':>6}  IC95           soloA soloB  p")
for r in out: print(f"{r['A']:18}{r['B']:18}{r['K']:>3}{r['recall_A']:>7}{r['recall_B']:>7}{r['dif_pts']:>6}  [{r['IC95'][0]:>5},{r['IC95'][1]:>5}]  {r['solo_A']:>5} {r['solo_B']:>5}  {r['p_McNemar']}")
