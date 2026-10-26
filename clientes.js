/* Tecnigráficas · Crear cliente desde cualquier parte del sistema.
   Uso: TecniClientes.init(clienteSupabase)
        TecniClientes.open({kind:'person'|'company', name:'Juan', onSaved: cliente => {...}})
   Al guardar también avisa a toda la página con el evento "tecni:cliente-creado". */
(function(){
  var db=null,opts={},kind='person';
  var css='.tqc-back{position:fixed;inset:0;z-index:100000;background:rgba(20,22,30,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,sans-serif}'+
  '.tqc{background:#fff;border-radius:20px;width:min(560px,100%);max-height:92vh;overflow:auto;box-shadow:0 30px 80px rgba(0,0,0,.3);color:#20222a}'+
  '.tqc-head{padding:18px 20px 6px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.tqc-head h3{margin:0;font-size:20px}.tqc-head p{margin:3px 0 0;color:#6b7280;font-size:12.5px}'+
  '.tqc-x{border:0;background:#eef1f6;border-radius:10px;width:36px;height:36px;font-size:18px;cursor:pointer}'+
  '.tqc-body{padding:10px 20px 4px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.tqc-full{grid-column:1/-1}'+
  '.tqc-kind{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tqc-kind button{border:2px solid #e3e7ee;background:#fff;border-radius:14px;padding:12px;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit}'+
  '.tqc-kind button small{display:block;font-size:11px;font-weight:600;color:#6b7280}.tqc-kind button.on{border-color:#00a6d6;background:#e9f7fc;color:#087a9a}'+
  '.tqc label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:800;color:#4a5160}'+
  '.tqc input,.tqc select{padding:11px 12px;border:1px solid #d9dde6;border-radius:11px;font-size:15px;font-family:inherit;width:100%;box-sizing:border-box}'+
  '.tqc input:focus,.tqc select:focus{outline:2px solid #00a6d6;border-color:#00a6d6}'+
  '.tqc-warn{grid-column:1/-1;background:#fff3dc;color:#7a4b00;border-radius:12px;padding:10px 12px;font-size:13px;font-weight:700}.tqc-warn button{margin-top:6px}'+
  '.tqc-foot{display:flex;gap:8px;justify-content:flex-end;padding:14px 20px 18px}.tqc-foot button,.tqc-warn button{border:0;border-radius:12px;padding:12px 18px;font-weight:900;font-size:14px;cursor:pointer;font-family:inherit}'+
  '.tqc-cancel{background:#eef1f6}.tqc-save{background:linear-gradient(125deg,#00a6d6,#e6007e);color:#fff}.tqc-use{background:#20222a;color:#fff}'+
  '@media(max-width:560px){.tqc-body{grid-template-columns:1fr}}';
  function addCss(){if(document.getElementById('tqc-css'))return;var s=document.createElement('style');s.id='tqc-css';s.textContent=css;document.head.appendChild(s)}
  function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function norm(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim()}
  function q(id){return document.getElementById(id)}
  function close(){var b=q('tqcBack');if(b)b.remove()}
  function paintKind(){var c=kind==='company';q('tqcBack').querySelectorAll('[data-k]').forEach(function(b){b.classList.toggle('on',b.dataset.k===kind)});
    q('tqcNameL').firstChild.textContent=c?'Nombre de la empresa *':'Nombre completo *';q('tqcName').placeholder=c?'Ej. Colegio Bethlemitas':'Ej. Juan Pérez';
    q('tqcDocType').value=c?'NIT':'CC';q('tqcPhoneL').firstChild.textContent=c?'Teléfono':'Celular';q('tqcDateL').style.display=c?'none':''}
  async function save(e){
    e&&e.preventDefault();var name=q('tqcName').value.trim();if(!name){q('tqcName').focus();return}
    var payload={kind:kind,name:name,document_type:q('tqcDocType').value||null,document_number:q('tqcDoc').value.trim()||null,phone:q('tqcPhone').value.trim()||null,email:q('tqcEmail').value.trim()||null,city:q('tqcCity').value.trim()||null,address:q('tqcAddress').value.trim()||null,birthday:kind==='person'&&q('tqcDate').value?q('tqcDate').value:null};
    var btn=q('tqcSave');btn.disabled=true;btn.textContent='Guardando…';
    try{
      if(!q('tqcForce').value){var ex=await db.from('clients').select('id,name,phone,email,kind,document_number').eq('kind',kind).ilike('name',name);var dup=(ex.data||[]).find(function(c){return norm(c.name)===norm(name)});
        if(dup){q('tqcWarn').innerHTML='Ya existe <b>'+esc(dup.name)+'</b>'+(dup.phone?' ('+esc(dup.phone)+')':'')+'. ¿Es el mismo?<br><button type="button" class="tqc-use" id="tqcUse">Sí, usar ese</button> <button type="button" class="tqc-cancel" id="tqcNew">No, es otro: crear nuevo</button>';q('tqcWarn').style.display='';
          q('tqcUse').onclick=function(){done(dup)};q('tqcNew').onclick=function(){q('tqcForce').value='1';save()};btn.disabled=false;btn.textContent='✓ Guardar cliente';return}}
      var r=await db.from('clients').insert(payload).select('*').single();if(r.error)throw r.error;done(r.data,true);
    }catch(err){btn.disabled=false;btn.textContent='✓ Guardar cliente';alert('No se pudo guardar el cliente: '+(err.message||err))}
  }
  function done(client,isNew){close();try{document.dispatchEvent(new CustomEvent('tecni:cliente-creado',{detail:client}))}catch(e){}
    if(isNew){var t=document.createElement('div');t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100001;background:#20222a;color:#fff;padding:11px 16px;border-radius:12px;font:700 13px Inter,system-ui,sans-serif';t.textContent='✓ Cliente '+client.name+' creado';document.body.appendChild(t);setTimeout(function(){t.remove()},2200)}
    if(typeof opts.onSaved==='function')opts.onSaved(client)}
  function open(o){
    if(!db){alert('El sistema todavía está cargando. Intenta de nuevo en un momento.');return}
    opts=o||{};kind=opts.kind==='company'?'company':'person';addCss();close();
    var b=document.createElement('div');b.className='tqc-back';b.id='tqcBack';
    b.innerHTML='<form class="tqc" id="tqcForm" autocomplete="off"><div class="tqc-head"><div><h3>＋ Cliente nuevo</h3><p>Queda guardado en Clientes y escogido aquí mismo.</p></div><button type="button" class="tqc-x" id="tqcX" aria-label="Cerrar">×</button></div>'+
      '<div class="tqc-body"><div class="tqc-full tqc-kind"><button type="button" data-k="person">👤 Persona<small>Una persona natural</small></button><button type="button" data-k="company">🏢 Empresa<small>Negocio, colegio, entidad…</small></button></div>'+
      '<label class="tqc-full" id="tqcNameL">Nombre<input id="tqcName" required></label>'+
      '<label>Tipo de documento<select id="tqcDocType"><option value="">Sin especificar</option><option>CC</option><option>NIT</option><option>CE</option><option>Pasaporte</option></select></label>'+
      '<label>Número de documento<input id="tqcDoc" inputmode="numeric" placeholder="Opcional"></label>'+
      '<label id="tqcPhoneL">Celular<input id="tqcPhone" inputmode="tel" placeholder="Ej. 300 000 0000"></label>'+
      '<label>Correo<input id="tqcEmail" type="email" placeholder="Opcional"></label>'+
      '<label>Ciudad<input id="tqcCity" value="Popayán"></label>'+
      '<label>Dirección<input id="tqcAddress" placeholder="Opcional"></label>'+
      '<label id="tqcDateL" class="tqc-full">Cumpleaños (opcional)<input id="tqcDate" type="date"></label>'+
      '<div class="tqc-warn" id="tqcWarn" style="display:none"></div><input type="hidden" id="tqcForce" value=""></div>'+
      '<div class="tqc-foot"><button type="button" class="tqc-cancel" id="tqcCancel">Cancelar</button><button type="submit" class="tqc-save" id="tqcSave">✓ Guardar cliente</button></div></form>';
    document.body.appendChild(b);
    q('tqcName').value=opts.name||'';paintKind();
    b.querySelectorAll('[data-k]').forEach(function(x){x.onclick=function(){kind=x.dataset.k;q('tqcForce').value='';q('tqcWarn').style.display='none';paintKind()}});
    q('tqcX').onclick=close;q('tqcCancel').onclick=close;q('tqcForm').onsubmit=save;
    b.addEventListener('mousedown',function(e){if(e.target===b)close()});
    setTimeout(function(){q('tqcName').focus();q('tqcName').select()},50);
  }
  window.TecniClientes={init:function(client){db=client},open:open};
})();
