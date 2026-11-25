#!/usr/bin/env python3
"""Spike · celdas sin posición registrada (solo desarrollo). Compara la similitud densa máxima (BGE-M3) de las celdas SIN posición con la de las
celdas con posición registrada. Es una señal orientativa de celdas cuyo programa contiene un pasaje cercano; NO prueba omisiones ni dice nada
sobre apoyo u oposición. Candidatas a una futura auditoría de silencio documental con evaluadores independientes."""
import json, pathlib, numpy as np
from sentence_transformers import SentenceTransformer
base = pathlib.Path('docs/methodology/local/out/spike'); data = json.load(open(base / 'cells.json')); meta = data['meta']; cells = data['cells']; sil = json.load(open(base / 'silence.json'))
model = SentenceTransformer('BAAI/bge-m3', device='cpu'); model.max_seq_length = 512
import hashlib
emb = {}
for party, info in meta['parties'].items():
    texts = [p['text'] for p in json.load(open(base / f"passages_{info['slug']}.json"))]
    key = hashlib.sha256(('BAAI/bge-m3' + '\n' + '\n'.join(texts)).encode()).hexdigest()[:16]; emb[party] = np.load(base / 'cache' / f"BAAI_bge-m3_{info['slug']}_{key}.npy")
def top1(c):
    q = model.encode([c['item'] + ' ' + c['context'] + ' ' + c['expansion_es']], normalize_embeddings=True, show_progress_bar=False)[0].astype(np.float32)
    return float((emb[c['party']] @ q).max())
cod = np.array([top1(c) for c in cells if c['hit_idx']]); s = np.array([top1(c) for c in sil])
med, p25, p75 = float(np.median(cod)), float(np.percentile(cod, 25)), float(np.percentile(cod, 75))
bm = {c['cellId']: c['bm25_top1'] for c in sil}
out = {'codificadas_top1_coseno': {'n': len(cod), 'p25': round(p25, 3), 'mediana': round(med, 3), 'p75': round(p75, 3)}, 'sin_posicion_top1_coseno': {'n': len(s), 'p25': round(float(np.percentile(s, 25)), 3), 'mediana': round(float(np.median(s)), 3), 'p75': round(float(np.percentile(s, 75)), 3)},
       'sin_posicion_con_top1_>=_mediana_codificadas': int((s >= med).sum()), 'sin_posicion_con_top1_>=_p75_codificadas': int((s >= p75).sum()), 'sin_posicion_con_top1_>=_p25_codificadas': int((s >= p25).sum()),
       'nota': 'Solo orientativo: la similitud no demuestra que el programa tome posición. No son omisiones.'}
lex = json.load(open(base.parent / 'candidatas_silencio.json'))['celdas']; lexset = {c['cellId'] for c in lex if c.get('≥medianaV7')}
cand = [{'cellId': c['cellId'], 'party': c['party'], 'language': c['language'], 'coseno_top1': round(float(v), 3), 'denso_>=_mediana': bool(v >= med), 'lexico_>=_mediana_V7': c['cellId'] in lexset} for c, v in zip(sil, s)]
out['cruce_con_cercania_lexica'] = {'ambos': sum(c['denso_>=_mediana'] and c['lexico_>=_mediana_V7'] for c in cand), 'solo_denso': sum(c['denso_>=_mediana'] and not c['lexico_>=_mediana_V7'] for c in cand), 'solo_lexico': sum((not c['denso_>=_mediana']) and c['lexico_>=_mediana_V7'] for c in cand), 'ninguno': sum((not c['denso_>=_mediana']) and (not c['lexico_>=_mediana_V7']) for c in cand)}
by = {}
for c in cand: by.setdefault(c['language'], [0, 0]); by[c['language']][0] += 1; by[c['language']][1] += c['denso_>=_mediana']
out['por_idioma'] = {k: {'celdas': v[0], 'denso_>=_mediana': v[1]} for k, v in by.items()}
json.dump({'resumen': out, 'celdas': cand}, open(base / 'silencio_denso.json', 'w'), ensure_ascii=False, indent=1); print(json.dumps(out, ensure_ascii=False))
