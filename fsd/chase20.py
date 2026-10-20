import asyncio, json, os
from playwright.async_api import async_playwright
from shoot6 import route, touch_drag
OUT='shots/v20/'
async def run(name,w,h):
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx=await b.new_context(viewport={'width':w,'height':h},has_touch=True); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/stats/leaderboard.php*',route); E=pg.evaluate; cdp=await ctx.new_cdp_session(pg)
    await pg.goto('http://localhost:8931/index.html?test&god'); await pg.wait_for_function('window.FSD',timeout=60000)
    await E("localStorage.clear(); localStorage.setItem('fsdmm_passes','19')"); await pg.reload(); await pg.wait_for_function('window.FSD',timeout=60000); await E('FSD.noAdapt()')
    await pg.wait_for_timeout(1500)
    bb=await pg.locator('#thumb').bounding_box(); await touch_drag(cdp,bb['x']+bb['width']/2,bb['y']+bb['height']/2,0,-260)
    await pg.wait_for_timeout(2500); await E('FSDchase()')
    log=[]
    for i in range(24):
      await pg.wait_for_timeout(250)
      st=await E("(()=>{const c=FSD.G.cop;return c?{arr:c.arr,t:+c.t.toFixed(1),cr:c.crashed>0,v:Math.round(c.v*2.237),ev:Math.round(FSD.G.v*2.237),ind:document.querySelector('#copInd b').textContent,vis:!document.getElementById('copInd').classList.contains('hidden'),state:FSD.G.state}:{none:1,state:FSD.G.state,esc:FSD.G.copEscapes,wr:FSD.G.copWrecks}})()")
      log.append(st)
      if st.get('ind') and not st['cr'] and int(st['ind'].split()[0])<=9 and not os.path.exists(OUT+f'final-{name}.png'): await pg.screenshot(path=OUT+f'final-{name}.png'); print('GOT',name,st['ind'])
      if i in (2,4,6,8,12): await pg.screenshot(path=OUT+f'{name}-chase-{i*0.5:.1f}s.png')
    print(name,json.dumps(log),errs); await b.close()
async def main():
  for k in range(6):
    todo=[r for r in (('land',1280,720),('port',390,844)) if not os.path.exists(OUT+f'final-{r[0]}.png')]
    if not todo: break
    await asyncio.gather(*[run(*r) for r in todo])
asyncio.run(main())
