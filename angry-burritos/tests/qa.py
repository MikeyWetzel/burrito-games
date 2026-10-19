# Angry Burritos QA: python3 qa.py [url]  (serve angry-burritos/ first). 390x844 touch, solver per level, topple test, screenshots.
import json, os, sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8811/index.html'
SH = os.environ.get('AB_SHOTS', '/workspace/ab-work/shots/')
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(800)
    pg.screenshot(path=SH + '1-title.png')
    pg.add_script_tag(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'solver.js'))
    pg.evaluate('AngryBurritos.manual=true')
    # --- per-level solver ---
    sols = []
    for L in range(8):
        r = pg.evaluate('L=>ABSolve.solve(L)', L)
        print('LEVEL', json.dumps(r), flush=True); sols.append(r)
    # --- all-blocks-toppled test (each level): topple every block, leave snacks alive, confirm clear ---
    for L in range(8):
        r = pg.evaluate('''L=>{const A=AngryBurritos;A.loadLevel(L);A.skipOverview();A.doneDelay=0;while(A.s.simTime<1.6)A.step();
          A.launch(-0.5,0.2); // dud shot (arms rule)
          A.blocks.forEach(d=>{d.body.setAngle(d.body.getAngle()+Math.PI/2);d.body.setAwake(true)});
          let k=0;while(A.s.state==='fly'&&k<600){A.step();k++}
          return {state:A.s.state,reason:A.s.clearReason,steps:k}}''', L)
        print('TOPPLE', L + 1, r, flush=True)
    # --- visual replay through real tick + clear screen check ---
    for L, s in enumerate(sols):
        r = pg.evaluate('''([L,shots,shoot])=>new Promise(res=>{const A=AngryBurritos;A.doneDelay=900;A.loadLevel(L);A.skipOverview();
          let i=0,k=-1,frames=0,shotAt=null,popAt=null;const nPop=A.s.avos;
          function f(){frames++;if(A.s.state==='aim'&&A.s.simTime>=1.6&&i<shots.length){A.launch(shots[i][0],shots[i][1]);k=0;i++}else if(A.s.state==='fly'&&i>0&&k===shots[i-1][2])A.ability();A.stepFrame();if(A.s.state==='fly')k++;
            if(shoot&&A.s.state==='fly'&&k===20&&shotAt===null)shotAt=frames;
            if(shoot&&popAt===null&&A.s.avos<nPop)popAt=frames;
            const d=document.getElementById('done');
            if(d.classList.contains('show')||frames>4000)return res({state:A.s.state,shown:d.classList.contains('show'),title:document.getElementById('doneTitle').textContent,stars:document.getElementById('doneStars').textContent,frames});
            requestAnimationFrame(f)}requestAnimationFrame(f)})''', [L, s['shots'], False])
        print('UI', L + 1, r, flush=True)
    # --- screenshots: mid-level shot, hit pop, cleared screen (level 2) ---
    L = 1; shots = sols[L]['shots']
    pg.evaluate('''([L,shots])=>{const A=AngryBurritos;A.doneDelay=900;A.loadLevel(L);A.skipOverview();window.__q={shots,i:0,k:0,popped:false,n:A.s.avos};for(let j=0;j<95;j++)A.stepFrame()}''', [L, shots])
    pg.wait_for_timeout(100)
    pg.screenshot(path=SH + '2-aim.png')
    done_mid = done_pop = False
    for fr in range(3000):
        st = pg.evaluate('''()=>{const A=AngryBurritos,q=__q;
          if(A.s.state==='aim'&&A.s.simTime>=1.6&&q.i<q.shots.length){A.launch(q.shots[q.i][0],q.shots[q.i][1]);q.k=0;q.i++}
          else if(A.s.state==='fly'&&q.k===q.shots[q.i-1][2])A.ability();
          A.stepFrame();if(A.s.state==='fly')q.k++;
          return {st:A.s.state,k:q.k,avos:A.s.avos,n:q.n}}''')
        if not done_mid and st['st'] == 'fly' and st['k'] >= 28:
            pg.screenshot(path=SH + '3-mid-shot.png'); done_mid = True
        if not done_pop and st['avos'] < st['n']:
            pg.wait_for_timeout(120); pg.screenshot(path=SH + '4-hit-pop.png'); done_pop = True
        if pg.evaluate("document.getElementById('done').classList.contains('show')"):
            pg.wait_for_timeout(300); pg.screenshot(path=SH + '5-cleared.png'); break
        pg.wait_for_timeout(16)
    pg.evaluate("()=>{const A=AngryBurritos;A.loadLevel(7);for(let j=0;j<80;j++)A.stepFrame()}"); pg.wait_for_timeout(100)
    pg.screenshot(path=SH + '6-level8-overview.png')
    # touch input sanity: real tap drag via touchscreen on level 1
    pg.evaluate('AngryBurritos.manual=false;AngryBurritos.loadLevel(0);AngryBurritos.skipOverview()'); pg.wait_for_timeout(1800)
    pg.tap('canvas', position={'x': 20, 'y': 600})
    print('ERRORS', errors)
    b.close()
