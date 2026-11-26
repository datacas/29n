import json, math, numpy as np, krippendorff
from sklearn.metrics import cohen_kappa_score
import pandas as pd
from irrCAC.raw import CAC
data = json.load(open('docs/methodology/local/out/verify_external.json'))
def fmt(x): return 'NaN' if x is None or (isinstance(x,float) and math.isnan(x)) else f'{x:.4f}'
rows = []
for d in data:
    cats = d['cats']; catsAC = d.get('catsAC', cats); units = d['units']; num = all(isinstance(c,(int,float)) for c in cats)
    code = {c:i for i,c in enumerate(cats)}
    M = np.array([[np.nan if v is None else (v if num else code[v]) for v in u] for u in units]).T  # evaluadores x unidades
    ext = {}
    for lvl in (['nominal','ordinal','interval'] if num else ['nominal']):
        try: ext[lvl] = krippendorff.alpha(reliability_data=M, level_of_measurement=lvl)
        except Exception as e: ext[lvl] = float('nan')
    df = pd.DataFrame([[None if v is None else (v if num else code[v]) for v in u] for u in units])
    for name, w in (('ac1','identity'),('ac2_lineal','linear'),('ac2_cuadratica','quadratic')):
        if name != 'ac1' and not num: continue
        try:
            c = CAC(df, weights=w, categories=list(range(len(cats))) if not num else cats, coeff_type=None) if False else CAC(df, weights=w, categories=(list(range(len(cats))) if not num else catsAC))
            ext[name] = c.gwet()['est']['coefficient_value']
        except Exception as e: ext[name] = f'ERR {type(e).__name__}'
    if len(units[0])==2 and not any(None in u for u in units):
        a=[u[0] for u in units]; b=[u[1] for u in units]
        ext['kappa_sin_ponderar']=cohen_kappa_score(a,b); ext['kappa_lineal']=cohen_kappa_score(a,b,weights='linear',labels=catsAC); ext['kappa_cuadratico']=cohen_kappa_score(a,b,weights='quadratic',labels=catsAC)
    for k, jsv in d['js'].items():
        if jsv is None: continue
        e = ext.get(k if k in ext else k)
        if e is None: continue
        diff = None if isinstance(e,str) or (isinstance(e,float) and math.isnan(e)) or (isinstance(jsv,float) and math.isnan(jsv)) else abs(e-jsv)
        rows.append((d['name'], k, fmt(jsv), e if isinstance(e,str) else fmt(e), 'AMBOS NaN' if (e!=e if not isinstance(e,str) else False) and (jsv!=jsv) else ('-' if diff is None else f'{diff:.1e}')))
print(f"{'conjunto':44} {'métrica':18} {'propia':>8} {'externa':>8} {'|dif|':>8}")
for r in rows: print(f"{r[0][:44]:44} {r[1]:18} {r[2]:>8} {r[3]:>8} {r[4]:>8}")
