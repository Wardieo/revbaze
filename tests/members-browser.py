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
   assert await run('Boolean(document.querySelector('+json.dumps(selector)+'))'),(path, await run('document.body.textContent.slice(-2200)'), errors)
   await asyncio.sleep(.2)
  await call('Page.enable');await call('Runtime.enable')
  await call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1000,'deviceScaleFactor':1,'mobile':False})
  await call('Page.addScriptToEvaluateOnNewDocument', {'source': """
    const uid='11111111-1111-4111-8111-111111111111';
    const bid='22222222-2222-4222-8222-222222222222';
    const user={id:uid,email:'owner@example.com',aud:'authenticated',user_metadata:{name:'Owner'},app_metadata:{},created_at:new Date().toISOString()};
    const business={id:bid,owner_id:uid,name:'Cedar Studio',slug:'cedar-studio',description:'',logo_url:'',website_url:'',category:'Services',contact_email:'',brand_color:'#042751',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const token='eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'}))+'.test';
    localStorage.setItem('sb-iutvtpnftgxkaeitirfa-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));
    window.fixtureRole='owner';window.fixtureInvites=[];window.fixtureMembers=[{user_id:uid,email:user.email,role:'owner',active:true}];
    const originalFetch=fetch;
    window.fetch=async(input,options={})=>{
      const url=typeof input==='string'?input:input.url;
      const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
      if(url.includes('/auth/v1/')) {if(options.method==='PUT')window.fixturePasswordWrites=(window.fixturePasswordWrites||0)+1;return respond(user);}
      if(url.includes('/functions/v1/workspace-invite')) {
        const body=JSON.parse(options.body);window.fixtureLastInvite=body;
        if(body.email==='existing@example.com')return respond({error:'This email already has an account. Invite a new email address.'},400);
        window.fixtureInvites.push({id:'invite-test',email:body.email,role:body.role,expires_at:new Date(Date.now()+86400000).toISOString()});return respond({success:true});
      }
      if(url.includes('/rest/v1/rpc/')){
        const rpc=url.split('/rpc/')[1].split('?')[0];
        if(rpc==='validate_workspace_invitation')return window.fixtureExpired ? respond({message:'This invitation has expired or was revoked',code:'P0001'},400) : respond(bid);
        if(rpc==='accept_workspace_invitation'){window.fixtureAccepted=JSON.parse(options.body).p_invitation;return respond(bid);}
        if(rpc==='onboarding_status')return respond({businesses:[{id:bid,name:business.name,complete:true,owner:true}],draft:{id:'draft-fixture',business_id:'44444444-4444-4444-8444-444444444444',completed_at:null}});
        if(rpc==='workspace_members')return respond({role:window.fixtureRole,limit:5,used:window.fixtureInvites.length,businesses:[{id:bid,name:business.name},{id:'33333333-3333-4333-8333-333333333333',name:'Second Studio'}],members:window.fixtureMembers,invitations:window.fixtureInvites});
        if(rpc==='account_plan_status')return respond({plan:'growth',workspace_plan:'growth',businesses:1,cards:0,workspace_cards:0});
        if(rpc==='downgrade_access_status')return respond({plan:'growth',businesses:[{id:bid,name:business.name,available:true}],cards:[],links:[]});
        if(rpc==='manage_workspace_member'){window.fixtureInvites=[];return respond(null);}
        return respond([]);
      }
      if(url.includes('/rest/v1/businesses'))return respond([business]);
      if(url.includes('/rest/v1/'))return respond([]);
      if(url.includes('/functions/v1/billing'))return respond({configured:true,hasCustomer:true});
      return originalFetch(input,options);
    };
  """})
  await go('/#/settings?tab=members','.members-invite-form')
  assert await run("document.querySelector('.members-seat-count').textContent.includes('0 / 5')")
  async def fill(email):
   await run(f"(()=>{{const el=document.querySelector('.members-invite-form input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,{json.dumps(email)});el.dispatchEvent(new Event('input',{{bubbles:true}}))}})()")
   await asyncio.sleep(.1)
   await run("document.querySelector('.members-invite-form').requestSubmit()")
   await asyncio.sleep(.7)
  await fill('existing@example.com')
  assert await run("document.querySelector('[role=alert]').textContent.includes('already has an account')")
  await run("(()=>{const el=document.querySelector('[aria-label=\"Business access\"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'33333333-3333-4333-8333-333333333333');el.dispatchEvent(new Event('change',{bubbles:true}))})()")
  await asyncio.sleep(.5)
  await fill('new@example.com')
  assert await run("window.fixtureLastInvite.business_id==='33333333-3333-4333-8333-333333333333'")
  assert await run("document.querySelector('.members-list').textContent.includes('new@example.com') && window.fixtureLastInvite.role==='editor'")
  assert await run("[...document.querySelectorAll('.members-row button')].some(b=>b.disabled && b.textContent.startsWith('Sent ·'))")
  before=await run("[...document.querySelectorAll('.members-row button')].find(b=>b.textContent.startsWith('Sent ·')).textContent")
  await asyncio.sleep(1.3)
  assert before!=await run("[...document.querySelectorAll('.members-row button')].find(b=>b.textContent.startsWith('Sent ·')).textContent")
  await run("(()=>{const originalNow=Date.now;Date.now=()=>originalNow()+61000})()")
  await asyncio.sleep(1.2)
  assert await run("[...document.querySelectorAll('.members-row button')].some(b=>!b.disabled && b.textContent==='Resend')")
  await run("[...document.querySelectorAll('.members-row button')].find(b=>b.textContent==='Revoke').click()")
  await asyncio.sleep(.5)
  assert await run("!document.querySelector('.members-list').textContent.includes('new@example.com')")
  for width in [768,390]:
   await call('Emulation.setDeviceMetricsOverride',{'width':width,'height':1000,'deviceScaleFactor':1,'mobile':True})
   await asyncio.sleep(.3)
   assert await run(f'document.documentElement.scrollWidth<={width}'),width
  await call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1000,'deviceScaleFactor':1,'mobile':False})
  await run("window.fixtureRole='viewer';location.hash='/settings?tab=profile'")
  await asyncio.sleep(.4)
  await run("location.hash='/settings?tab=members'")
  await asyncio.sleep(6)
  assert await run("!document.querySelector('.members-invite-form') && document.body.textContent.includes('Only the owner can invite')"),await run("document.body.textContent.slice(-2500)")
  await go('/pricing','.m-price-grid')
  assert await run("document.querySelector('.m-premium-plans').textContent.includes('5 invited members across all businesses') && document.querySelector('.m-premium-plans').textContent.includes('20 invited members across all businesses')")
  await go('/#/accept-invitation?invitation=test','.auth-content')
  assert await run("document.querySelector('.auth-content').textContent.includes('Your team is waiting') && Boolean(document.querySelector('.password-strength'))")
  await run("document.querySelectorAll('input[autocomplete=new-password]').forEach(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'TeamPassword123!');el.dispatchEvent(new Event('input',{bubbles:true}))})")
  await asyncio.sleep(.2)
  await run("window.fixtureExpired=true;document.querySelector('.stack-form').requestSubmit()")
  await asyncio.sleep(.6)
  assert await run("!window.fixturePasswordWrites && document.body.textContent.includes('expired or was revoked')")
  await run("window.fixtureExpired=false;document.querySelector('.stack-form').requestSubmit()")
  for _ in range(100):
   if await run("location.hash==='#/overview'"):break
   await asyncio.sleep(.1)
  assert await run("location.hash==='#/overview' && window.fixtureAccepted==='test'"),await run("document.body.textContent.slice(-1500)")

  await go('/#/overview','.overview-share-grid')
  assert await run("location.hash==='#/overview'")
  await go('/#/overview','.overview-share-grid')
  assert await run("location.hash==='#/overview'")
  for path in ['/#/onboarding','/#/onboarding?new=1','/#/onboarding?published=manual']:
   await go(path,'.overview-share-grid')
   assert await run("location.hash==='#/overview'")
  assert not errors,errors
  print('PASS: owner invitations, duplicate email error, pending seats, revoke, viewer restrictions, desktop/mobile layouts, pricing, invitation password screen and acceptance into Overview.')
asyncio.run(main())
