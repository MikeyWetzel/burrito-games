import asyncio, sys
from playwright.async_api import async_playwright
async def route(r): await r.fulfill(json=dict(top=[]))
async def run(tag, scheme, w=390, h=844):
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx=await b.new_context(viewport={'width':w,'height':h},has_touch=True,color_scheme=scheme,device_scale_factor=2); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); await pg.route('**/stats/leaderboard.php*',route)
    await pg.goto('http://localhost:8931/index.html?test'); await pg.wait_for_function('window.FSD',timeout=60000)
    await pg.evaluate("localStorage.clear(); localStorage.setItem('fsdmm_passes','19')"); await pg.reload(); await pg.wait_for_function('window.FSD',timeout=60000)
    await pg.wait_for_timeout(2500); await pg.screenshot(path=f'shots/v21/{tag}-{scheme}.png')
    if len(sys.argv)>2:
      bb=await pg.locator('#thumb').bounding_box(); x=bb['x']+bb['width']/2; y=bb['y']+bb['height']/2
      await pg.mouse.move(x,y); await pg.mouse.down(); await pg.mouse.move(x,y-60,steps=6); await pg.wait_for_timeout(250); await pg.screenshot(path=f'shots/v21/{tag}-{scheme}-mid.png')
      await pg.mouse.move(x,y-200,steps=8); await pg.mouse.up(); await pg.wait_for_timeout(1500); print('state', await pg.evaluate('FSD.G.state'))
    print(tag,scheme,errs); await b.close()
async def main(): await asyncio.gather(run(sys.argv[1],'light'),run(sys.argv[1],'dark'))
asyncio.run(main())
