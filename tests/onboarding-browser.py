# Requires Python websockets, Chrome CDP on 9223, Vite on 5181, and onboarding-server.mjs on 8181.
import asyncio,json,base64,urllib.request,shutil
from pathlib import Path
import websockets
async def main():
 shutil.rmtree('/tmp/revbaze-onboarding-qr',ignore_errors=True)
 page=json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:9223/json/new?about:blank',method='PUT')))
 async with websockets.connect(page['webSocketDebuggerUrl'],max_size=20_000_000) as ws:
  seq=0
  async def call(method,params={}):
   nonlocal seq
   seq+=1;current=seq;await ws.send(json.dumps({'id':current,'method':method,'params':params}))
   while True:
    msg=json.loads(await ws.recv())
    if msg.get('method')=='Runtime.exceptionThrown':print(msg['params']['exceptionDetails'].get('exception',{}).get('description','runtime error'))
    if msg.get('id')==current:
     if 'error'in msg:raise Exception(msg['error'])
     return msg.get('result',{})
  async def run(code):
   r=await call('Runtime.evaluate',{'expression':code,'awaitPromise':True,'returnByValue':True})
   if 'exceptionDetails'in r:raise Exception(r['exceptionDetails'])
   return r['result'].get('value')
  async def clickText(text,selector='button'):
   for _ in range(80):
    if await run(f'[...document.querySelectorAll({json.dumps(selector)})].some(e=>e.textContent.trim()==={json.dumps(text)}&&!e.disabled)'):break
    await asyncio.sleep(.1)
   else: raise Exception('Button unavailable: '+text)
   await run(f'[...document.querySelectorAll({json.dumps(selector)})].find(e=>e.textContent.trim()==={json.dumps(text)}).click()');await asyncio.sleep(.35)
  async def field(label,value,root='document'):
   await run(f"(()=>{{const el=[...{root}.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith({json.dumps(label)})).querySelector('input,textarea,select');const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,{json.dumps(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{{bubbles:true}}))}})()");await asyncio.sleep(.15)
  async def navigate(path):await run('location.hash='+json.dumps(path));await asyncio.sleep(.7)
  await call('Page.enable')
  await call('Runtime.enable')
  await call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1100,'deviceScaleFactor':1,'mobile':False})
  await call('Page.addScriptToEvaluateOnNewDocument',{'source':"""
    const realFetch=fetch;
    const testPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';
    const imageSrc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
    Object.defineProperty(HTMLImageElement.prototype,'src',{...imageSrc,set(value){imageSrc.set.call(this,value.includes('/storage/v1/object/public/')?testPng:value)}});

    window.testUser={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',email:'test@example.com',user_metadata:{name:'Test Owner'},app_metadata:{},created_at:new Date().toISOString()};
    window.fetch=async(input,options={})=>{
      const url=typeof input==='string'?input:input.url;
      if(url.includes('/storage/v1/object/') && options.method==='POST') {
        window.testUploadUrl=url;
        return new Response(JSON.stringify({Key:url.split('/storage/v1/object/')[1],Id:crypto.randomUUID()}),{headers:{'Content-Type':'application/json'}});
      }
      if(url.includes('/auth/v1/')){
       if(url.includes('/logout'))return new Response('{}',{status:200});
       if(options.method==='PUT'){const body=JSON.parse(options.body);window.testUser.user_metadata={...window.testUser.user_metadata,...body.data};}
       return new Response(JSON.stringify(window.testUser),{headers:{'Content-Type':'application/json'}});
      }
      if(url.includes('/functions/v1/billing'))return new Response(JSON.stringify({error:'Billing is unavailable. Test fixture has no Stripe connection.'}),{status:503,headers:{'Content-Type':'application/json'}});
      if(url.includes('/rest/v1/rpc/')){const rpc=url.split('/rest/v1/rpc/')[1].split('?')[0];return realFetch('http://127.0.0.1:8181/'+rpc,{method:'POST',headers:{'Content-Type':'application/json','x-test-anon':String(Boolean(window.testAnonymous))},body:options.body});}
      if(url.includes('/rest/v1/'))return new Response('[]',{headers:{'Content-Type':'application/json'}});
      return realFetch(input,options);
    };
  """})
  async def waitText(text):
   for _ in range(60):
    if await run('document.body?.textContent.includes('+json.dumps(text)+')'):return
    await asyncio.sleep(.15)
   raise Exception('Missing text: '+text+' '+str(await run('document.body.textContent.slice(-1500)')))
  async def reload():await run('location.reload()');await asyncio.sleep(1.5)
  import base64,time
  payload=base64.urlsafe_b64encode(json.dumps({'sub':'11111111-1111-4111-8111-111111111111','aud':'authenticated','role':'authenticated','exp':int(time.time())+3600}).encode()).decode().rstrip('=')
  await call('Page.navigate',{'url':'http://127.0.0.1:5181/?auth_callback=signup#access_token=eyJhbGciOiJIUzI1NiJ9.'+payload+'.fake&refresh_token=fake&token_type=bearer&expires_in=3600&type=signup'})
  await waitText('Welcome to Revbaze.');await asyncio.sleep(1)
  assert await run("location.hash==='#/onboarding' && document.querySelector('.sidebar')===null")
  assert await run("document.querySelector('input[type=email]').value==='test@example.com'")
  await clickText('Get Started');await waitText('Tell us about your business.')
  await field('Business name','Cedar Studio');await field('Business category','Professional services');await field('Website','https://cedar.example.com');await field('Business description','A welcoming creative studio.');await asyncio.sleep(1.3)
  await run("(()=>{const input=document.querySelector('input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File(['bad'],'logo.webp',{type:'image/webp'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()");await waitText('under 10 MB')
  await run("(()=>{const input=document.querySelector('input[type=file]');const transfer=new DataTransfer();const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0));transfer.items.add(new File([bytes],'logo.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()");await asyncio.sleep(1.5)
  assert await run("window.testUploadUrl.includes('/storage/v1/object/business-assets/')")
  await reload();await waitText('Tell us about your business.');assert await run("document.querySelector('input[autocomplete=organization]').value==='Cedar Studio'")
  await navigate('/overview');await waitText('Tell us about your business.');assert await run("location.hash==='#/onboarding'")
  await clickText('Continue');await waitText('Where should customers leave reviews?')
  for _ in range(60):
   if await run("[...document.querySelectorAll('.onboard-platform-grid button')].some(b=>b.textContent.includes('Google Reviews')&&!b.disabled)"):break
   await asyncio.sleep(.1)
  await run("[...document.querySelectorAll('.onboard-platform-grid button')].find(b=>b.textContent.includes('Google Reviews')).click()");await asyncio.sleep(.3)
  await field('Official review URL','https://google.com.evil.com/reviews');assert await run("document.querySelector('.onboard-actions button.primary').disabled")
  await field('Official review URL','https://g.page/r/cedar/review');await asyncio.sleep(.3)
  await run("[...document.querySelectorAll('.onboard-platform-grid button')].find(b=>b.textContent.includes('Trustpilot')).click()");await asyncio.sleep(.3)
  await field('Official review URL','https://www.trustpilot.com/review/cedar.example.com',"document.querySelectorAll('.onboard-destination')[1]")
  await run("document.querySelector('[aria-label=\"Move Trustpilot up\"]').click()");await asyncio.sleep(.3)
  assert await run("document.querySelector('.onboard-destination-heading strong').textContent==='Trustpilot'")
  await run("document.querySelector('[aria-label=\"Remove Google Reviews\"]').click()");await asyncio.sleep(.4)
  assert await run("document.querySelectorAll('.onboard-destination').length===1")
  for _ in range(60):
   if await run("[...document.querySelectorAll('.onboard-platform-grid button')].some(b=>b.textContent.includes('Google Reviews')&&!b.disabled)"):break
   await asyncio.sleep(.1)
  await run("[...document.querySelectorAll('.onboard-platform-grid button')].find(b=>b.textContent.includes('Google Reviews')).click()");await asyncio.sleep(.3)
  await field('Official review URL','https://g.page/r/cedar/review',"document.querySelectorAll('.onboard-destination')[1]")
  await clickText('Continue');await waitText('Make your review card yours.');await asyncio.sleep(1)
  for template in ['classic','left','split','grid']:
   await run(f"document.querySelector('.template-thumbnail-{template}').closest('button').click()");await asyncio.sleep(.2)
   assert await run(f"document.querySelector('.preview-card').classList.contains('template-{template}')")
  await field('Review card heading','A little feedback goes a long way.');await field('Short description','Choose a platform to share your experience.');await asyncio.sleep(.8)
  assert await run("document.querySelector('.preview-card h2').textContent==='A little feedback goes a long way.'")
  await clickText('Back');await waitText('Where should customers leave reviews?');assert await run("document.querySelectorAll('.onboard-destination').length===2")
  await clickText('Continue');await waitText('Make your review card yours.');await asyncio.sleep(1)
  assert await run("document.querySelector('.onboard-slug input').value==='cedar-studio'")
  await call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True});await asyncio.sleep(.4)
  assert await run('document.documentElement.scrollWidth<=390')
  await call('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]});await asyncio.sleep(.2)
  assert await run("matchMedia('(prefers-reduced-motion: reduce)').matches")
  shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':True});Path('/tmp/revbaze-onboarding-mobile.png').write_bytes(base64.b64decode(shot['data']))
  await call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1100,'deviceScaleFactor':1,'mobile':False});await run('scrollTo(0,0)');await asyncio.sleep(.5)
  shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':True});Path('/tmp/revbaze-onboarding-desktop.png').write_bytes(base64.b64decode(shot['data']))
  await run("fetch('http://127.0.0.1:8181/fail-publish',{method:'POST',body:JSON.stringify({fail:true})})")
  await clickText('Publish review card');await waitText('Connection interrupted during publication.')
  assert not await run("document.body.textContent.includes('Your review card is ready!')")
  await run("fetch('http://127.0.0.1:8181/fail-publish',{method:'POST',body:JSON.stringify({fail:false})})")
  await clickText('Publish review card');await waitText('Your review card is ready!');await asyncio.sleep(.6)
  publicUrl=await run("document.querySelector('.onboard-published-link input').value")
  assert publicUrl=='http://127.0.0.1:5181/#/review/cedar-studio'
  assert await run("document.querySelector('.qr-image img').src.startsWith('data:image/png')")
  await call('Browser.grantPermissions',{'origin':'http://127.0.0.1:5181','permissions':['clipboardReadWrite','clipboardSanitizedWrite']})
  await call('Page.bringToFront');await asyncio.sleep(.2)
  await clickText('Copy Link');assert await run("document.querySelector('.toast').textContent.includes('copied')")
  await call('Browser.setDownloadBehavior',{'behavior':'allow','downloadPath':'/tmp/revbaze-onboarding-qr'})
  await clickText('PNG');await clickText('SVG');await asyncio.sleep(.6)
  assert Path('/tmp/revbaze-onboarding-qr/revbaze-qr.png').read_bytes().startswith(b'\x89PNG')
  assert '<image href="data:image/png' in Path('/tmp/revbaze-onboarding-qr/revbaze-qr.svg').read_text()
  original=await run("document.querySelector('.qr-image img').src")
  await clickText('Rounded');await asyncio.sleep(.4)
  assert await run("document.querySelector('.qr-image img').src") != original
  await clickText('Dots');await asyncio.sleep(.4)
  assert await run("document.querySelector('.onboard-qr-styles button[aria-pressed=true]').textContent==='Dots'")
  Path('/tmp/revbaze-onboarding-qr/revbaze-qr.svg').unlink()
  await clickText('SVG');await asyncio.sleep(.4)
  styled=Path('/tmp/revbaze-onboarding-qr/revbaze-qr.svg').read_text()
  assert '<circle' in styled and '<image href="data:image/png' in styled
  await run("document.querySelector('.onboard-qr-logo-toggle input').click()");await asyncio.sleep(.4)
  Path('/tmp/revbaze-onboarding-qr/revbaze-qr.svg').unlink()
  await clickText('SVG');await asyncio.sleep(.4)
  assert '<image' not in Path('/tmp/revbaze-onboarding-qr/revbaze-qr.svg').read_text()
  await reload();await waitText('Your review card is ready!')
  assert await run("document.querySelector('.onboard-qr-styles button[aria-pressed=true]').textContent==='Dots' && !document.querySelector('.onboard-qr-logo-toggle input').checked")
  await run("fetch('http://127.0.0.1:8181/test-plan',{method:'POST',body:JSON.stringify({plan:'free'})})")
  await reload();await waitText('Your review card is ready!');await asyncio.sleep(.8)
  assert await run("document.querySelector('.qr-customizer-controls fieldset').disabled")
  Path('/tmp/revbaze-onboarding-qr/revbaze-qr.svg').unlink()
  await clickText('SVG');await asyncio.sleep(.4)
  basic=Path('/tmp/revbaze-onboarding-qr/revbaze-qr.svg').read_text();assert '<image' not in basic and '<circle' not in basic
  await run("fetch('http://127.0.0.1:8181/test-plan',{method:'POST',body:JSON.stringify({plan:'growth'})})")
  await reload();await waitText('Your review card is ready!');await asyncio.sleep(.6)
  await clickText('Go to Dashboard');await waitText('Performance overview');assert await run("location.hash==='#/overview'")
  await reload();await waitText('Performance overview')
  await navigate('/review/cedar-studio');await run('window.testAnonymous=true');await reload();await waitText('A little feedback goes a long way.')
  assert await run("document.querySelector('.preview-card').classList.contains('template-grid')")
  assert await run("document.querySelector('.sidebar')===null && document.querySelectorAll('.preview-destination[href]').length===2")
  assert await run("document.querySelector('.preview-destination').href==='https://www.trustpilot.com/review/cedar.example.com'")
  await navigate('/overview');await waitText('Performance overview')
  await run("fetch('http://127.0.0.1:8181/test-plan',{method:'POST',body:JSON.stringify({plan:'free'})})")
  await navigate('/analytics');await reload();await waitText('Analytics is included with Growth and Pro')
  await navigate('/integrations');await waitText('Integrations is included with Growth and Pro')
  await navigate('/settings?tab=billing');await waitText('Plans & billing');
  shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':True});Path('/tmp/revbaze-billing-desktop.png').write_bytes(base64.b64decode(shot['data']))
  assert await run("document.querySelector('.billing-current-price').textContent.includes('$0')")
  await navigate('/upgrade');await reload();await waitText('Choose your next chapter.');
  assert await run("[...document.querySelectorAll('.upgrade-plan button')].filter(e=>e.textContent.trim()==='Current plan'&&e.disabled).length===1"), 'Free plan must have a disabled Current plan button'
  shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':True});Path('/tmp/revbaze-upgrade-desktop.png').write_bytes(base64.b64decode(shot['data']))
  assert await run("[...document.querySelectorAll('.upgrade-price')].map(e=>e.textContent.replaceAll(/\\s/g,'')).join('|')==='$0/month|$10/month|$29/month'")
  await clickText('Choose Growth');await waitText('Billing is unavailable.');assert await run("location.hash.startsWith('#/upgrade')"), 'Failed Growth checkout must remain on the plan chooser'
  await clickText('Choose Pro');await waitText('Billing is unavailable.');assert await run("location.hash.startsWith('#/upgrade')"), 'Failed Pro checkout must remain on the plan chooser'
  await call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True});await asyncio.sleep(.3)
  assert await run('document.documentElement.scrollWidth<=innerWidth'), 'Upgrade screen overflows on mobile'
  await call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1100,'deviceScaleFactor':1,'mobile':False})

  await navigate('/checkout?result=cancelled&returnTo=%2Fupgrade%3Ffeature%3Danalytics');await waitText('Checkout was cancelled.')
  assert await run("location.hash==='#/upgrade?feature=analytics'"), 'Cancellation must restore the previous route'
  await navigate('/checkout?result=success&plan=pro');await waitText('Confirming your payment…');await asyncio.sleep(2.5)
  assert await run("location.hash.includes('/checkout') && !document.body.textContent.includes('Your Pro plan is ready.')"), 'Success URL cannot grant unpaid access'
  await run("fetch('http://127.0.0.1:8181/test-plan',{method:'POST',body:JSON.stringify({plan:'pro'})})")
  await waitText('Your Pro plan is ready.');await waitText('Performance overview')
  assert await run("location.hash==='#/overview'"), 'Verified plan activation must continue to dashboard'
  await run("fetch('http://127.0.0.1:8181/test-plan',{method:'POST',body:JSON.stringify({plan:'growth'})})")
  await navigate('/integrations');await reload();await waitText('Sample integrations')
  await navigate('/onboarding?new=1');await waitText('Welcome to Revbaze.')
  assert await run("document.querySelector('input[autocomplete=name]').value==='Test Owner'")
  await clickText('Get Started');await waitText('Tell us about your business.')
  assert await run("document.querySelector('input[autocomplete=organization]').value===''")
  print('PASS: confirmation to onboarding, verified account, server draft refresh/resume, dashboard bypass prevention, safe links and ordering, back navigation, live preview, mobile/reduced motion, failed and real successful publication, QR downloads, public card links, returning dashboard, isolated new business, Free QR fallback and feature locks, paid integration access, and Settings prices.')
asyncio.run(main())
