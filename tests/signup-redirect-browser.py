import asyncio,json,urllib.request,base64
from pathlib import Path
import websockets
async def main():
 page=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9223/json/new?about:blank',method='PUT')))
 async with websockets.connect(page['webSocketDebuggerUrl'],max_size=20000000) as ws:
  seq=0; errors=[]
  async def call(method,params={}):
   nonlocal seq
   seq+=1; n=seq; await ws.send(json.dumps({'id':n,'method':method,'params':params}))
   while True:
    e=json.loads(await ws.recv())
    if e.get('method')=='Runtime.exceptionThrown':errors.append(e['params']['exceptionDetails'])
    if e.get('id')==n:return e.get('result',{})
  async def run(code):
   r=await call('Runtime.evaluate',{'expression':code,'returnByValue':True,'awaitPromise':True})
   assert 'exceptionDetails' not in r,r
   return r['result'].get('value')
  async def go(path,selector):
   await call('Page.navigate',{'url':'http://127.0.0.1:5181'+path})
   for _ in range(100):
    if await run('Boolean(document.querySelector('+json.dumps(selector)+'))'):break
    await asyncio.sleep(.1)
   assert await run('Boolean(document.querySelector('+json.dumps(selector)+'))'),path
   await asyncio.sleep(.2)
  await call('Page.enable');await call('Runtime.enable')
  await call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1000,'deviceScaleFactor':1,'mobile':False})
  await call('Page.addScriptToEvaluateOnNewDocument', {'source': """
    const originalFetch = window.fetch;
    window.fetch = async (input, options = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/auth/v1/signup')) {
        window.submittedSignup = JSON.parse(options.body);
        return new Response(JSON.stringify({id:'11111111-1111-4111-8111-111111111111',email:'signup-test@example.com',identities:[{id:'fixture'}],user_metadata:window.submittedSignup.data}), {headers:{'Content-Type':'application/json'}});
      }
      if (url.includes('/auth/v1/')) return new Response('{}', {status:401,headers:{'Content-Type':'application/json'}});
      return originalFetch(input, options);
    };
  """})
  for plan in ['free','growth','pro']:
   await go('/pricing','.m-price-grid')
   await run("localStorage.clear();sessionStorage.clear()")
   await run(f"document.querySelector('.m-premium-plans a[href=\"/#/signup?plan={plan}\"]').click()")
   for _ in range(100):
    if await run("Boolean(document.querySelector('.stack-form'))"):break
    await asyncio.sleep(.1)
   for selector,value in [('input[autocomplete=name]','Test User'),('input[type=email]','signup-test@example.com'),('input[autocomplete=new-password]','TestPassword123!')]:
    await run(f"document.querySelectorAll({json.dumps(selector)}).forEach(el=>{{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,{json.dumps(value)});el.dispatchEvent(new Event('input',{{bubbles:true}}))}})")
   await asyncio.sleep(.1)
   await run("document.querySelector('.stack-form').requestSubmit()")
   for _ in range(100):
    if await run("location.hash==='#/check-email'"):break
    await asyncio.sleep(.1)
   await asyncio.sleep(.5)
   assert await run("location.hash==='#/check-email'"),plan
   assert await run(f"window.submittedSignup.data.signup_plan==='{plan}'"),plan
   assert await run("sessionStorage.getItem('revbaze-signup-plan-choice')===null")
  await go('/#/signup?plan=pro','.m-price-grid')
  assert await run("location.pathname==='/pricing'")
  assert not errors,errors
  print('PASS: Free/Growth/Pro successful signup keeps selected metadata, reaches Check email without Pricing redirect, clears selection after leaving, and direct signup remains guarded.')
asyncio.run(main())
