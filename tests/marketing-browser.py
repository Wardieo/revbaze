# Uses the isolated Chrome CDP profile on port 9223 and Vite on 5181.
import asyncio,json,urllib.request,base64
from pathlib import Path
import websockets
async def main():
 page=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9223/json/new?about:blank',method='PUT')))
 async with websockets.connect(page['webSocketDebuggerUrl'],max_size=20000000) as ws:
  seq=0; errors=[]
  async def call(method,params={}):
   nonlocal seq
   seq+=1; identifier=seq;await ws.send(json.dumps({'id':identifier,'method':method,'params':params}))
   while True:
    event=json.loads(await ws.recv())
    if event.get('method')=='Runtime.exceptionThrown':errors.append(event['params']['exceptionDetails'])
    if event.get('id')==identifier:
     if 'error' in event:raise Exception(event['error'])
     return event.get('result',{})
  async def run(code):
   result=await call('Runtime.evaluate',{'expression':code,'returnByValue':True,'awaitPromise':True})
   if 'exceptionDetails' in result:raise Exception(result['exceptionDetails'])
   return result['result'].get('value')
  async def wait(selector):
   for _ in range(70):
    if await run(f'Boolean(document.querySelector({json.dumps(selector)}))'):return
    await asyncio.sleep(.12)
   raise Exception('Missing '+selector)
  async def go(path):
   await call('Page.navigate',{'url':'http://127.0.0.1:5181'+path});await wait('#marketing-content h1');await asyncio.sleep(.35)
  async def click(selector,text):
   await run(f'[...document.querySelectorAll({json.dumps(selector)})].find(e=>e.textContent.trim()==={json.dumps(text)}).click()');await asyncio.sleep(.45)
  await call('Page.enable');await call('Runtime.enable')
  await call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1050,'deviceScaleFactor':1,'mobile':False})
  await go('/')
  assert await run("document.querySelector('h1').textContent.includes('Turn CustomerFeedback IntoBusiness Growth.')")
  assert await run("!document.querySelector('.sidebar') && Boolean(document.querySelector('a[href=\"/#/signup\"]'))")
  await wait('.m-float-qr .qr-image img')
  assert await run("(async()=>{const {brandLogos}=await import('/src/lib/brandLogos.ts'); return Object.keys(brandLogos).length===15 && (await Promise.all(Object.values(brandLogos).map(src=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth>0);img.onerror=()=>resolve(false);img.src=src})))).every(Boolean)})()")
  assert await run("document.querySelector('.platform-google img') && getComputedStyle(document.querySelector('.platform-google')).backgroundImage==='none'")
  await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
  shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False});Path('/tmp/revbaze-marketing-desktop.png').write_bytes(base64.b64decode(shot['data']))
  for path in ['/product','/features','/solutions','/pricing','/resources','/about','/contact','/resources/qr-codes','/privacy','/terms']:
   await go(path)
   assert await run("document.querySelector('.m-footer') && !document.querySelector('.sidebar')")
   assert await run("document.querySelector('link[rel=canonical]').href===location.origin+location.pathname")
  await go('/product');await click('.m-preview-controls button','Platform grid');assert await run("document.querySelector('.m-product-playground .template-grid')!==null")
  await go('/features');await click('.m-feature-tabs button','QR codes');await wait('.m-qr-playground .qr-image img');await click('.m-preview-controls button','Dots');await wait('.m-qr-playground .qr-image img')
  await click('.m-feature-tabs button','Review platforms');await click('.m-platform-picker button','Facebook');assert await run("document.querySelector('.m-platform-destination').textContent.includes('facebook.com') && !document.body.innerText.includes('Private feedback')")
  await go('/features');await click('.m-feature-tabs button','Integrations');assert await run("Boolean(document.querySelector('.platform-make img') && document.querySelector('.platform-n8n img'))")
  await go('/pricing');assert await run("!document.querySelector('.m-billing-toggle') && document.querySelector('.m-price-card.featured .m-price').textContent.includes('10') && document.querySelectorAll('.m-comparison-table tbody tr').length===9 && getComputedStyle(document.querySelector('.m-comparison-table thead th')).position==='sticky'");await run("document.querySelector('.m-pricing-faq details summary').click()");assert await run("document.querySelector('.m-pricing-faq details').open")
  await go('/');await run("document.querySelector('.m-faq summary').click()");assert await run("document.querySelector('.m-faq details').open")
  await go('/contact');await call('Browser.grantPermissions',{'origin':'http://127.0.0.1:5181','permissions':['clipboardReadWrite','clipboardSanitizedWrite']});await call('Page.bringToFront');await run("document.querySelector('input[name=name]').value='Demo';document.querySelector('input[name=email]').value='demo@example.com';document.querySelector('textarea[name=message]').value='A product question';document.querySelector('.m-contact form').requestSubmit()");await asyncio.sleep(.4);assert await run("document.querySelector('.m-contact-notice').textContent.includes('not been sent')")
  for width in [768,390]:
   await call('Emulation.setDeviceMetricsOverride',{'width':width,'height':844,'deviceScaleFactor':1,'mobile':width==390})
   for path in ['/','/product','/features','/solutions','/pricing','/about','/contact','/resources']:
    await go(path)
    overflow=await run('document.documentElement.scrollWidth')
    assert overflow<=width,(path,width,overflow)
   if width==390:
    await go('/');await run("document.querySelector('.m-menu').click()");assert await run("document.querySelector('.m-nav-links').classList.contains('open')")
    shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False});Path('/tmp/revbaze-marketing-mobile.png').write_bytes(base64.b64decode(shot['data']))
  await call('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]});await go('/');assert await run("getComputedStyle(document.querySelector('.m-floating-card')).animationName==='none'")
  await go('/')
  assert await run("!document.querySelector('.m-nav-cta')")
  assert await run("getComputedStyle(document.querySelector('.m-footer')).display==='block' && getComputedStyle(document.querySelector('.m-final')).alignItems==='center'")
  await run("localStorage.clear(); sessionStorage.clear(); document.querySelector('.m-login').click()")
  await wait('.auth-main')
  assert await run("location.hash==='#/login' && !document.querySelector('.marketing-site')")
  assert not errors,errors
  print('PASS: public pages/direct loads, metadata, auth links, card layout, QR styles, review platforms, pricing comparison, FAQ, contact copy, mobile menu, tablet/mobile widths, and reduced motion.')
asyncio.run(main())
