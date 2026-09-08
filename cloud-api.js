/* Public project configuration. No database passwords or secret keys. */
(() => {
  'use strict';
  const url = 'https://rsmudwmpcicobyasrbys.supabase.co';
  const key = 'sb_publishable_gK5PaPntOfQCcpAMi9oGfQ_mMrxaQcY';
  let client;
  const ready = new Promise(resolve => {
    document.addEventListener('DOMContentLoaded', async () => {
      const style = document.createElement('style');
      style.textContent = '#cloud-login{position:fixed;inset:0;z-index:99999;background:#000;color:#fff;display:grid;place-items:center;font:20px Arial}#cloud-login form{width:min(360px,85vw);display:grid;gap:16px}#cloud-login input,#cloud-login button{box-sizing:border-box;width:100%;padding:14px;font:18px Arial}#cloud-login p{font:15px Arial;white-space:normal}#cloud-tools{position:relative;display:flex;gap:12px;justify-content:flex-end;padding:12px;background:#000}#cloud-tools button{background:#000;color:#fff;border:1px solid #fff;padding:8px;cursor:pointer}#cloud-tools{align-items:center}#cloud-tools button.cloud-logout{border:0;padding:6px;width:56px;height:56px;display:grid;place-items:center;flex-shrink:0}#cloud-tools .cloud-logout svg{width:44px;height:44px;display:block}#cloud-tools .cloud-logout:hover{opacity:.8}#cloud-tools .cloud-logout:focus-visible{outline:2px solid #ffd633;outline-offset:3px;border-radius:8px}';
      style.textContent += '#cloud-tools.cloud-home-tools{display:grid;grid-template-columns:1fr auto 1fr;width:100%;padding:0;margin:0 0 24px;gap:12px}#cloud-tools.cloud-home-tools .cloud-logout{grid-column:2;grid-row:1}#cloud-tools.cloud-home-tools .cloud-export{grid-column:1;grid-row:1;justify-self:start}@media(max-width:480px){#cloud-tools.cloud-home-tools .cloud-export{grid-column:1 / -1;grid-row:2;justify-self:start}}';

      style.textContent += `
        #cloud-login {box-sizing:border-box;overflow-y:auto;padding:32px 20px;color-scheme:dark;text-transform:none;letter-spacing:normal}
        #cloud-login form {width:min(520px,100%);margin:auto;display:grid;gap:24px}
        #cloud-login .cloud-welcome {margin:0 0 8px;text-align:center;color:#ffd633;background:linear-gradient(45deg,#ff7827,#ffd633);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;font:600 clamp(30px,6vw,44px)/1.15 "Arial Narrow",Arial,sans-serif}
        #cloud-login h1 {margin:0 0 20px;text-align:center;color:#fff;font:700 clamp(32px,7.5vw,60px)/1.1 "Arial Narrow",Arial,sans-serif;letter-spacing:0;white-space:nowrap}
        #cloud-login input,#cloud-login button {box-sizing:border-box;display:block;width:100%;min-width:0;height:52px;margin:0;padding:12px 18px;border:2px solid transparent;border-radius:10px;background:linear-gradient(#000,#000) padding-box,linear-gradient(45deg,#ff7827,#ffd633) border-box;color:#fff;font:400 18px/1.2 Arial,sans-serif;letter-spacing:.4px;text-align:center;box-shadow:none}
        #cloud-login .cloud-field {display:block;min-width:0;padding:2px;border-radius:10px;background:linear-gradient(45deg,#ff7827,#ffd633)}
        #cloud-login .cloud-field input {height:48px;border:0;border-radius:8px;background:#000;text-transform:none;caret-color:#ffd633}
        #cloud-login .cloud-field:focus-within {outline:1px solid #ffd633;outline-offset:4px}
        #cloud-login .cloud-field input:focus-visible {outline:none}
        #cloud-login input::placeholder {color:#fff;opacity:1}
        #cloud-login button {margin-top:24px;background:#0b4f2c;border-color:#0b4f2c;color:#fff;cursor:pointer;text-transform:uppercase}
        #cloud-login button:hover {filter:brightness(1.12)}
        #cloud-login button:disabled {opacity:.55;cursor:wait}
        #cloud-login input:focus-visible,#cloud-login button:focus-visible {outline:1px solid #ffd633;outline-offset:4px}
        #cloud-login input:-webkit-autofill,#cloud-login input:-webkit-autofill:hover,#cloud-login input:-webkit-autofill:focus {-webkit-text-fill-color:#fff;-webkit-box-shadow:0 0 0 1000px #000 inset;caret-color:#ffd633}
        #cloud-login #cloud-login-message {margin:0;color:#ffb12b;text-align:center;font:15px/1.4 Arial,sans-serif;text-transform:none}
        #cloud-login #cloud-login-message:empty {display:none}
        @media(max-width:480px) {#cloud-login form {gap:20px}#cloud-login h1 {margin-bottom:12px}}
      `;
      document.head.appendChild(style);
      const gate = document.createElement('div'); gate.id = 'cloud-login';
      gate.innerHTML = '<form><div class="cloud-welcome">Welcome</div><h1>CLOUD DRIVE</h1><span class="cloud-field"><input name="email" type="email" autocomplete="username" placeholder="Enter Login Here" aria-label="Enter Login Here" autocapitalize="none" spellcheck="false" required></span><span class="cloud-field"><input name="password" type="password" autocomplete="current-password" placeholder="Enter Password Here" aria-label="Enter Password Here" required></span><button type="submit">SIGN IN</button><p role="alert" id="cloud-login-message"></p></form>';
      document.body.appendChild(gate);
      const form = gate.querySelector('form');
      const status = gate.querySelector('p');
      if (!window.supabase) { status.textContent = 'Не удалось загрузить подключение. Проверьте интернет и обновите страницу.'; return; }
      client = window.supabase.createClient(url,key);
      async function access() {
        const {error} = await client.rpc('cloud_read',{p_action:'access'});
        if (error) throw error;
        gate.remove();
        const bar = document.createElement('div'); bar.id='cloud-tools';
        const logout = document.createElement('button');
        logout.type='button';logout.className='cloud-logout';
        logout.setAttribute('aria-label','SIGN OUT');logout.title='SIGN OUT';
        logout.innerHTML='<svg viewBox="0 0 256 256" aria-hidden="true" focusable="false"><defs><linearGradient id="cloudExitGradient" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ff7827"/><stop offset="1" stop-color="#ffd633"/></linearGradient></defs><g fill="none" stroke="url(#cloudExitGradient)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"><path d="M86 67V64a48 48 0 0 1 48-48h48a48 48 0 0 1 48 48v128a48 48 0 0 1-48 48h-48a48 48 0 0 1-48-48v-3"/><path d="M148 128H18m32-38-34 38 34 38"/></g></svg>';
        logout.onclick=async()=>{await client.auth.signOut();location.reload();};bar.appendChild(logout);
        const home = document.querySelector('main.home');
        if (home) {bar.classList.add('cloud-home-tools');home.prepend(bar);}
        else {document.body.prepend(bar);}
        resolve();
      }
      form.onsubmit=async event=>{
        event.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='';
        try {
          const {error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});
          if(error) throw error;
          await access();
        } catch(e) {status.textContent=e.message||'Не удалось войти';}
        finally {button.disabled=false;}
      };
      try {const {data:{session}}=await client.auth.getSession();if(session) await access();}
      catch(e){status.textContent=e.message||'Не удалось проверить доступ';}
    },{once:true});
  });
  window.CloudAPI = {
    today() {
      const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
      const value=t=>parts.find(p=>p.type===t).value;
      return `${value('year')}-${value('month')}-${value('day')}`;
    },
    escape(value) {return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
    showError(error) {const el=document.createElement('p');el.setAttribute('role','alert');el.style.cssText='color:#fff;background:#900;padding:16px;font:18px Arial';el.textContent='ERROR: '+(error.message||error);document.body.prepend(el);},
    async read(action,barcode='') {
      await ready;
      const {data,error}=await client.rpc('cloud_read',{p_action:action,p_barcode:barcode});
      if(error) throw error;return data;
    },
    async send(options) {
      await ready;
      const body=options.body;
      const date=body.get('date'),items=JSON.parse(body.get('items'));
      const {data:{session}}=await client.auth.getSession();
      if(!session) throw new Error('SESSION EXPIRED. RELOAD AND SIGN IN.');
      const storageKey='cloud-pending-'+session.user.id+'-'+location.pathname;
      const signature=JSON.stringify({date,items});
      let pending;
      try {pending=JSON.parse(sessionStorage.getItem(storageKey));}catch(_){}
      if(!pending || pending.signature!==signature) pending={signature,id:crypto.randomUUID()};
      // Persist before sending; retries after an uncertain network result reuse the same ID.
      sessionStorage.setItem(storageKey,JSON.stringify(pending));
      const {data,error}=await client.rpc('cloud_submit',{p_request_id:pending.id,p_date:date,p_items:items});
      if(error) throw error;
      if(data!=='OK') throw new Error('UNEXPECTED RESPONSE');
      sessionStorage.removeItem(storageKey);
      return {text:async()=>data};
    }
  };
})();
