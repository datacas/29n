#!/usr/bin/env python3
"""
Descubrimiento de temas SIN preguntas previas: agrupa los párrafos de los 18 programas por similitud léxica
(TF-IDF + KMeans). Solo lectura sobre docs/spike12/scan/*.json; no usa servicios externos.

  python3 scripts/spike12/discover_themes.py [k]   → docs/spike12/themes_discovery.json y .md
"""
import glob, json, re, sys, collections
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans

K = int(sys.argv[1]) if len(sys.argv) > 1 else 70
STOP = set("""de la que el en y a los del se las por un para con no una su al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras vosotros vosotras os mío mía míos mías tuyo tuya suyo suya nuestro nuestra vuestro vuestra es son será serán sea ser han ha hemos haremos haber vamos
la el els les amb per als dels aquest aquesta són però també més doncs
o os as non nos dun dunha unha uns umas polo pola polos polas máis cos coas
cada así parte través forma años año país españa español españoles españolas nuestro nuestra nuestros nuestras vez además mediante""".split())
paras = []
for f in sorted(glob.glob('docs/spike12/scan/*.json')):
    d = json.load(open(f))
    for p in d['paragraphs']:
        if len(p['text']) >= 120:
            paras.append((d['party'], p['page'], p['text']))
print(f'{len(paras)} párrafos de {len(set(p[0] for p in paras))} partidos')

vec = TfidfVectorizer(lowercase=True, stop_words=list(STOP), token_pattern=r'(?u)\b[^\W\d_]{4,}\b',
                      min_df=3, max_df=0.25, sublinear_tf=True, ngram_range=(1, 2), max_features=40000)
X = vec.fit_transform([p[2] for p in paras])
km = KMeans(n_clusters=K, n_init=5, random_state=29)
labels = km.fit_predict(X)
terms = np.array(vec.get_feature_names_out())
out = []
for c in range(K):
    idx = np.where(labels == c)[0]
    if len(idx) == 0: continue
    cen = km.cluster_centers_[c]
    top = terms[np.argsort(cen)[::-1][:8]]
    parties = collections.Counter(paras[i][0] for i in idx)
    # párrafo más central
    sims = X[idx] @ cen
    best = idx[int(np.argmax(np.asarray(sims).ravel()))]
    out.append({'cluster': c, 'size': int(len(idx)), 'parties': dict(parties), 'n_parties': len(parties),
                'top_terms': list(top), 'sample': paras[best][2][:260], 'sample_party': paras[best][0]})
out.sort(key=lambda r: -r['size'])
json.dump({'k': K, 'clusters': out}, open('docs/spike12/themes_discovery.json', 'w'), ensure_ascii=False, indent=1)
for r in out:
    print(f"#{r['cluster']:02d} n={r['size']:3d} partidos={r['n_parties']:2d} | {', '.join(r['top_terms'][:6])}")
