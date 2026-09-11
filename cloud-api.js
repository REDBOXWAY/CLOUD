/* Public project configuration. No database passwords or secret keys. */
(() => {
  'use strict';
  const url = 'https://rsmudwmpcicobyasrbys.supabase.co';
  const key = 'sb_publishable_gK5PaPntOfQCcpAMi9oGfQ_mMrxaQcY';
  let client;

  // Product identity rule:
  // BARCODE = unique factory barcode.
  // CATEGORY = TYPE-SIZE-COLOR-BRAND-GENDER.
  // Older test data may still look like BARCODE-CATEGORY; keep it readable while
  // the database is migrated to separate fields.
  function splitLegacyCategory(value, explicitBarcode = '') {
    const raw = String(value ?? '').trim();
    let barcode = String(explicitBarcode ?? '').trim();
    let category = raw;

    if (barcode && raw.startsWith(barcode + '-')) {
      category = raw.slice(barcode.length + 1).trim();
      return {barcode, category};
    }

    const legacy = raw.match(/^(\d+)-(.+)$/);
    if (legacy) {
      if (!barcode) barcode = legacy[1];
      if (!explicitBarcode || barcode === legacy[1]) category = legacy[2].trim();
    }

    return {barcode, category};
  }

  function categoryParts(item) {
    const keys = ['type', 'size', 'color', 'brand', 'gender'];
    const parts = keys.map(key => String(item?.[key] ?? '').trim());
    return parts.every(Boolean) ? parts.join('-') : '';
  }

  function categorySource(item) {
    const composed = categoryParts(item);
    if (composed) return composed;

    const candidates = [item?.category, item?.article, item?.product]
      .map(value => String(value ?? '').trim())
      .filter(Boolean);

    if (!candidates.length) return '';

    const explicitBarcode = String(item?.barcode ?? '').trim();
    let best = candidates[0];
    let bestScore = -1;

    for (const candidate of candidates) {
      const cleaned = splitLegacyCategory(candidate, explicitBarcode).category;
      const score = (cleaned.match(/-/g) || []).length;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best;
  }

  function normalizeProductItem(item) {
    if (!item || typeof item !== 'object') return item;

    const source = categorySource(item);
    const parsed = splitLegacyCategory(source, item.barcode);
    const category = parsed.category || String(item.category ?? item.article ?? item.product ?? '').trim();

    return {
      ...item,
      barcode: parsed.barcode || String(item.barcode ?? '').trim(),
      category,
      // The current Supabase RPC still uses the legacy field name "article".
      // Keep the protocol compatible, but store/display the clean CATEGORY value.
      article: category || String(item.article ?? '').trim()
    };
  }

  function normalizeReadData(action, data) {
    if (Array.isArray(data)) {
      if (['stock', 'analytics', 'return'].includes(action)) {
        return data.map(normalizeProductItem);
      }
      return data;
    }

    if (action === 'product' && data) return normalizeProductItem(data);
    return data;
  }

  function installStockExportV2() {
    if (typeof window.stockZip !== 'function') return;

    window.exportStockExcel = function exportStockExcelV2() {
      const xml = value => String(value)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
      const rows = Array.from(document.querySelectorAll('table tr'));
      const quantities = [2, 5, 9];
      const sheetRows = rows.map((row, r) => '<row r="' + (r + 1) + '">' + Array.from(row.cells).map((cell, c) => {
        const address = String.fromCharCode(65 + c) + (r + 1);
        const value = cell.textContent.trim();
        if (r > 0 && c >= 2 && value !== '—' && value !== '') {
          const number = Number(value.replace(/\s|₼/g, ''));
          if (!Number.isFinite(number)) throw new Error('Invalid stock value: ' + value);
          return '<c r="' + address + '" s="' + (quantities.includes(c) ? 1 : 2) + '"><v>' + number + '</v></c>';
        }
        return '<c r="' + address + '" t="inlineStr"><is><t xml:space="preserve">' + xml(value) + '</t></is></c>';
      }).join('') + '</row>').join('');

      const files = {
        '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
        '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="STOCK" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
        'xl/styles.xml': '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;₼&quot;"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf xfId="0"/><xf xfId="0" numFmtId="1" applyNumberFormat="1"/><xf xfId="0" numFmtId="164" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
        'xl/worksheets/sheet1.xml': '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="48" customWidth="1"/><col min="3" max="12" width="23" customWidth="1"/></cols><sheetData>' + sheetRows + '</sheetData>' + (rows.length > 2 ? '<autoFilter ref="A1:L' + (rows.length - 1) + '"/>' : '') + '</worksheet>'
      };

      const blob = new Blob([window.stockZip(files)], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'STOCK_' + window.CloudAPI.today() + '.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    };
  }

  function prepareProductSchemaUI() {
    if (document.documentElement.dataset.cloudProductSchema === 'v2') return;
    document.documentElement.dataset.cloudProductSchema = 'v2';

    const page = (location.pathname.split('/').pop() || '').toUpperCase();

    if (page === 'STOCK.HTML') {
      const header = document.querySelector('table thead tr');
      if (header && !Array.from(header.cells).some(cell => cell.textContent.trim() === 'BARCODE')) {
        const barcodeHeader = document.createElement('th');
        barcodeHeader.textContent = 'BARCODE';
        header.insertBefore(barcodeHeader, header.firstElementChild);
      }

      if (typeof window.loadStock === 'function' && !window.loadStock.__barcodeCategoryV2) {
        const originalLoadStock = window.loadStock;
        const wrapped = function(data) {
          originalLoadStock(data);
          const rows = Array.from(document.querySelectorAll('#stockData tr'));
          const items = Array.isArray(data) ? data : [];

          items.forEach((item, index) => {
            const row = rows[index];
            if (!row) return;
            const cell = document.createElement('td');
            cell.textContent = String(item?.barcode ?? '');
            row.insertBefore(cell, row.firstElementChild);
          });

          const totalRow = rows[items.length];
          if (totalRow) {
            if (totalRow.cells[0]) totalRow.cells[0].textContent = '—';
            const totalCell = document.createElement('td');
            totalCell.textContent = 'TOTAL';
            totalRow.insertBefore(totalCell, totalRow.firstElementChild);
          }
        };
        wrapped.__barcodeCategoryV2 = true;
        window.loadStock = wrapped;
      }

      installStockExportV2();
    }

    if (page === 'ANALYTICS.HTML') {
      const headers = Array.from(document.querySelectorAll('table thead th'));
      const article = headers.find(cell => cell.textContent.trim() === 'ARTICLE');
      if (article) article.textContent = 'CATEGORY';
    }

    if (page === 'RETURN.HTML') {
      const headers = Array.from(document.querySelectorAll('table thead th'));
      const article = headers.find(cell => cell.textContent.trim() === 'ARTICLE');
      if (article) article.textContent = 'CATEGORY';
    }
  }

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
        #cloud-login .cloud-field {position:relative;display:block;min-width:0;padding:2px;border-radius:10px;background:linear-gradient(45deg,#ff7827,#ffd633)}
        #cloud-login .cloud-field input {height:48px;border:0;border-radius:8px;background:#000;font:400 24px/1.2 Arial,sans-serif !important;padding-top:8px;padding-bottom:8px;text-transform:none;caret-color:#ffd633}
        #cloud-login .cloud-field:focus-within {outline:1px solid #ffd633;outline-offset:4px}
        #cloud-login .cloud-field input:focus-visible {outline:none}
        #cloud-login .cloud-password-field {position:relative}
        #cloud-login .cloud-password-field input {padding-left:48px;padding-right:48px}
        #cloud-login #cloud-password-toggle {position:absolute;right:6px;top:6px;display:grid;place-items:center;width:40px;min-width:40px;height:40px;margin:0;padding:8px;border:0;border-radius:6px;background:#000;color:#ffb12b;box-shadow:none;cursor:pointer}
        #cloud-login #cloud-password-toggle svg {display:block;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
        #cloud-login #cloud-password-toggle .eye-slash {display:none}
        #cloud-login #cloud-password-toggle[aria-pressed="true"] .eye-slash {display:block}
        #cloud-login .cloud-password-field input::-ms-reveal,#cloud-login .cloud-password-field input::-ms-clear {display:none}
        #cloud-login .cloud-field input:autofill,#cloud-login .cloud-field input:-webkit-autofill {font:400 24px/1.2 Arial,sans-serif !important}
        #cloud-login .cloud-saved-value {position:absolute;inset:2px;display:flex;align-items:center;justify-content:center;padding:8px 18px;border-radius:8px;background:#000;color:#fff;font:400 24px/1.2 Arial,sans-serif;letter-spacing:.4px;text-transform:none;pointer-events:none;overflow:hidden;white-space:nowrap}
        #cloud-login .cloud-saved-value[hidden] {display:none}
        #cloud-login .cloud-password-field .cloud-saved-value {padding-left:48px;padding-right:48px}
        #cloud-login .cloud-saved-value span {display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis}
        #cloud-login #cloud-password-toggle {z-index:2}
        #cloud-login input::placeholder {color:#fff;opacity:1;font-size:18px}
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
      gate.innerHTML = '<form><div class="cloud-welcome">Welcome</div><h1>CLOUD DRIVE</h1><span class="cloud-field"><input name="email" type="email" autocomplete="username" placeholder="Enter Login Here" aria-label="Enter Login Here" autocapitalize="none" spellcheck="false" required></span><span class="cloud-field cloud-password-field"><input id="cloud-password" name="password" type="password" autocomplete="current-password" placeholder="Enter Password Here" aria-label="Enter Password Here" required><button id="cloud-password-toggle" type="button" aria-label="Show password" title="Show password" aria-controls="cloud-password" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="m3 3 18 18"/></svg></button></span><button type="submit">SIGN IN</button><p role="alert" id="cloud-login-message"></p></form>';
      document.body.appendChild(gate);
      const form = gate.querySelector('form');
      // Remember only the login address in this tab; never persist a password.
      try { form.elements.email.value = sessionStorage.getItem('cloud-login-email') || ''; } catch (_) {}
      function rememberLogin(email) {
        if (!email) return;
        try { sessionStorage.setItem('cloud-login-email', email); } catch (_) {}
      }
      const passwordInput = form.elements.password;
      const passwordToggle = form.querySelector('#cloud-password-toggle');
      passwordToggle.addEventListener('click', () => {
        const show = passwordInput.type === 'password';
        passwordInput.type = show ? 'text' : 'password';
        passwordToggle.setAttribute('aria-pressed', String(show));
        passwordToggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        passwordToggle.title = show ? 'Hide password' : 'Show password';
      });
      // Display committed saved values independently of the browser's autofill renderer.
      const savedFields = [form.elements.email, passwordInput].map(input => {
        const overlay = document.createElement('span');
        overlay.className = 'cloud-saved-value';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.hidden = true;
        const text = document.createElement('span');
        overlay.appendChild(text);
        input.parentElement.appendChild(overlay);
        const field = {input, overlay, text};
        for (const event of ['input', 'change', 'focus', 'blur']) {
          input.addEventListener(event, () => updateSavedField(field));
        }
        return field;
      });
      function updateSavedField({input, overlay, text}) {
        // Chromium may paint a saved password before exposing its value to JavaScript.
        let savedPasswordPreview = false;
        if (input === passwordInput && input.type === 'password' && !input.value) {
          try { savedPasswordPreview = input.matches(':autofill') || input.matches(':-webkit-autofill') || !input.matches(':placeholder-shown'); } catch (_) {}
        }
        const visible = (input.value.length > 0 || savedPasswordPreview) && document.activeElement !== input;
        overlay.hidden = !visible;
        const value = !visible ? '' : input.type === 'password' ? '•'.repeat(input.value.length || 8) : input.value;
        if (text.textContent !== value) text.textContent = value;
      }
      const syncSavedFields = () => savedFields.forEach(updateSavedField);
      passwordToggle.addEventListener('click', syncSavedFields);
      syncSavedFields();
      // Password managers may fill without input/change events.
      const savedValueTimer = setInterval(() => {
        if (!gate.isConnected) { clearInterval(savedValueTimer); return; }
        syncSavedFields();
      }, 250);
      const status = gate.querySelector('p');
      if (!window.supabase) { status.textContent = 'Не удалось загрузить подключение. Проверьте интернет и обновите страницу.'; return; }
      client = window.supabase.createClient(url,key);
      async function access() {
        const {error} = await client.rpc('cloud_read',{p_action:'access'});
        if (error) throw error;
        clearInterval(savedValueTimer);
        gate.remove();
        const bar = document.createElement('div'); bar.id='cloud-tools';
        const logout = document.createElement('button');
        logout.type='button';logout.className='cloud-logout';
        logout.setAttribute('aria-label','SIGN OUT');logout.title='SIGN OUT';
        logout.innerHTML='<svg viewBox="0 0 256 256" aria-hidden="true" focusable="false"><defs><linearGradient id="cloudExitGradient" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ff7827"/><stop offset="1" stop-color="#ffd633"/></linearGradient></defs><g fill="none" stroke="url(#cloudExitGradient)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"><path d="M86 67V64a48 48 0 0 1 48-48h48a48 48 0 0 1 48 48v128a48 48 0 0 1-48 48h-48a48 48 0 0 1-48-48v-3"/><path d="M148 128H18m32-38-34 38 34 38"/></g></svg>';
        logout.onclick=async()=>{const {data:{session}}=await client.auth.getSession();if(session) rememberLogin(session.user.email);await client.auth.signOut();location.reload();};bar.appendChild(logout);
        const home = document.querySelector('main.home');
        if (home) {bar.classList.add('cloud-home-tools');home.prepend(bar);}
        else {document.body.prepend(bar);}
        prepareProductSchemaUI();
        resolve();
      }
      form.onsubmit=async event=>{
        event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;status.textContent='';
        try {
          const {error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});
          if(error) throw error;
          rememberLogin(form.elements.email.value.trim());
          await access();
        } catch(e) {status.textContent=e.message||'Не удалось войти';}
        finally {button.disabled=false;}
      };
      try {const {data:{session}}=await client.auth.getSession();if(session) { rememberLogin(session.user.email); await access(); }}
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
      if(error) throw error;
      return normalizeReadData(action, data);
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
