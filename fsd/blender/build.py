import sys, os; sys.path.insert(0, os.path.dirname(__file__))
import importlib, carlib as C, models as M
out = sys.argv[sys.argv.index('--') + 1]; which = sys.argv[sys.argv.index('--') + 2:] or ['m3']
for k in which:
    C.reset(); C.MATS.clear(); M.base_mats(); getattr(M, {'sedan': 'tsedan'}.get(k, k))(); C.export(os.path.join(out, k + '.glb'))
