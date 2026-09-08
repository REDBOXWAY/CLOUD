/* Public project configuration. No database passwords or secret keys. */
(() => {
  'use strict';
  const url = 'https://rsmudwmpcicobyasrbys.supabase.co';
  const key = 'sb_publishable_gK5PaPntOfQCcpAMi9oGfQ_mMrxaQcY';
  let client;
  const ready = new Promise(resolve => {
    document.addEventListener('DOMContentLoaded', async () => {
      const style = document.createElement('style');
      style.textContent = '#cloud-login{position:fixed;inset:0;z-index:99999;background:#000;color:#fff;display:grid;place-items:center;font:20px Arial}#cloud-login form{width:min(360px,85vw);display:grid;gap:16px}#cloud-login input,#cloud-login button{box-sizing:border-box;width:100%;padding:14px;font:18px Arial}#cloud-login p{font:15px Arial;white-space:normal}#cloud-tools{position:relative;display:flex;gap:12px;justify-content:flex-end;padding:12px;background:#000}#cloud-tools button{background:#000;color:#fff;border:1px solid #fff;padding:8px;cursor:pointer}';
      document.head.appendChild(style);
      const gate = document.createElement('div'); gate.id = 'cloud-login';
      gate.innerHTML = '<form><h1>CLOUD DRIVE</h1><label>EMAIL<input name="email" type="email" autocomplete="username" required></label><label>PASSWORD<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">SIGN IN</button><p role="alert" id="cloud-login-message"></p></form>';
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
        const logout = document.createElement('button');logout.textContent='SIGN OUT';
        logout.onclick=async()=>{await client.auth.signOut();location.reload();};bar.appendChild(logout);
        if (location.pathname.endsWith('HOME.html')) {
          const backup = document.createElement('button');backup.textContent='EXPORT DATA';
          backup.onclick=async()=>{try {
            const data=await window.CloudAPI.read('export');
            const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
            const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='CLOUD-operations-'+window.CloudAPI.today()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
          } catch(e) {window.CloudAPI.showError(e);}};bar.prepend(backup);
        }
        document.body.prepend(bar); resolve();
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
