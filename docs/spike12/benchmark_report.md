# SPIKE-12 — Informe de benchmark

Modelo: `jev-1.14.0` · n=30 · run 1463b37e-b71d-4edb-adcb-8ee7b2ba0db5

| Sistema | Acierto (respondidas) | Acierto total | Abstención | F1 macro | Falsos apoyos | Falsas oposiciones | Inversiones | p50 ms | p95 ms | Coste USD |
|---|---|---|---|---|---|---|---|---|---|---|
| jev:independent | 70.0% | 46.7% | 33.3% | 55.1% | 4 | 0 | 0 | 143 | 819 | 0.00134 |
| jev:with_proposal | 81.0% | 56.7% | 30.0% | 64.4% | 1 | 0 | 0 | 142 | 161 | 0.00145 |
| claude | 43.3% | 43.3% | 0.0% | 31.4% | 0 | 6 | 0 | — | — | 0.00000 |
