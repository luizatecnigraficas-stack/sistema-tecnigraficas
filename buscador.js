/* Tecnigráficas · Buscador en las listas largas.
   Toda lista (<select>) con muchas opciones se vuelve un campo donde escribes y busca desde la primera letra.
   - Se activa solo si la lista tiene 12 opciones o más, o si tiene data-buscar.
   - data-nuevo-cliente="person|company" agrega "＋ Crear cliente nuevo" (usa clientes.js).
   El <select> original sigue existiendo (oculto), así que el resto del sistema funciona igual. */
(function(){
  var MIN=12;
  var css='.tqb{position:relative;width:100%}.tqb select{display:none!important}'+
  '.tqb-in{width:100%;box-sizing:border-box;padding-right:34px!important;cursor:text}.tqb-in.tqb-has{font-weight:700}'+
  '.tqb-ic{position:absolute;right:11px;top:50%;transform:translateY(-50%);pointer-events:none;color:#8a919e;font-size:13px}'+
  '.tqb-list{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:9000;background:#fff;border:1px solid #d9dde6;border-radius:14px;box-shadow:0 16px 40px rgba(25,30,45,.18);max-height:300px;overflow:auto;padding:5px;display:none}'+
  '.tqb.open .tqb-list{display:block}'+
  '.tqb-opt{display:block;width:100%;text-align:left;border:0;background:transparent;padding:10px 11px;border-radius:10px;font:inherit;font-size:14px;cursor:pointer;color:#20222a}'+
  '.tqb-opt:hover,.tqb-opt.act{background:#e9f7fc}.tqb-opt.sel{font-weight:800}.tqb-opt mark{background:#fff1a8;color:inherit;border-radius:3px;padding:0 1px}'+
  '.tqb-new{color:#087a9a;font-weight:900;border-top:1px dashed #d9dde6;margin-top:4px;padding-top:12px}.tqb-empty{padding:12px;color:#6b7280;font-size:13px}';
  function addCss(){if(document.getElementById('tqb-css'))return;var s=document.createElement('style');s.id='tqb-css';s.textContent=css;document.head.appendChild(s)}
  function norm(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}
  function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function mark(text,q){if(!q)return esc(text);var n=norm(text),i=n.indexOf(q);if(i<0)return esc(text);return esc(text.slice(0,i))+'<mark>'+esc(text.slice(i,i+q.length))+'</mark>'+esc(text.slice(i+q.length))}
  function wants(sel){if(sel.__tqb||sel.multiple||sel.dataset.buscar==='no')return false;return sel.hasAttribute('data-buscar')||sel.hasAttribute('data-nuevo-cliente')||sel.options.length>=MIN}
  function enhance(sel){
    if(!wants(sel))return;sel.__tqb=true;addCss();
    var wrap=document.createElement('div');wrap.className='tqb';sel.parentNode.insertBefore(wrap,sel);wrap.appendChild(sel);
    var inp=document.createElement('input');inp.type='text';inp.className='tqb-in '+(sel.className||'');inp.autocomplete='off';inp.setAttribute('role','combobox');
    var ic=document.createElement('span');ic.className='tqb-ic';ic.textContent='🔍';
    var list=document.createElement('div');list.className='tqb-list';list.setAttribute('role','listbox');
    wrap.appendChild(inp);wrap.appendChild(ic);wrap.appendChild(list);
    if(sel.required){sel.required=false;inp.required=true}if(sel.id)inp.id=sel.id+'Buscar';var lab=sel.id&&document.querySelector('label[for="'+sel.id+'"]');if(lab)lab.htmlFor=inp.id;
    var active=-1,shown=[],lastVal=null,lastLen=-1;
    function placeholder(){var first=sel.options[0];return first&&!first.value?first.text:'Escribe para buscar…'}
    function label(){var o=sel.options[sel.selectedIndex];return o&&o.value?o.text:''}
    function syncFromSelect(force){if(!force&&document.activeElement===inp)return;if(force||sel.value!==lastVal||sel.options.length!==lastLen){lastVal=sel.value;lastLen=sel.options.length;inp.value=label();inp.classList.toggle('tqb-has',!!sel.value);inp.placeholder='🔎 '+placeholder().replace(/…$/,'')+' — escribe para buscar';inp.disabled=sel.disabled}}
    function render(){
      var qq=norm(inp.value.trim()),words=qq.split(/\s+/).filter(Boolean),opts=[].slice.call(sel.options).filter(function(o){return o.value!==''||!qq}).filter(function(o){if(!o.value&&qq)return false;var h=norm(o.text);return words.every(function(w){return h.indexOf(w)>=0})});
      opts.sort(function(a,b){if(!qq)return 0;var x=norm(a.text).indexOf(qq)===0?0:1,y=norm(b.text).indexOf(qq)===0?0:1;return x-y});
      shown=opts.slice(0,80);active=shown.length?0:-1;
      var html=shown.map(function(o,i){return '<button type="button" class="tqb-opt'+(o.value===sel.value&&o.value?' sel':'')+(i===active?' act':'')+'" data-i="'+i+'">'+mark(o.text,qq)+'</button>'}).join('');
      if(!shown.length)html='<div class="tqb-empty">No encontré “'+esc(inp.value.trim())+'”.</div>';
      if(opts.length>shown.length)html+='<div class="tqb-empty">Y '+(opts.length-shown.length)+' más… sigue escribiendo para afinar.</div>';
      if(sel.hasAttribute('data-nuevo-cliente')&&window.TecniClientes)html+='<button type="button" class="tqb-opt tqb-new" data-new="1">＋ Crear cliente nuevo'+(inp.value.trim()?': “'+esc(inp.value.trim())+'”':'')+'</button>';
      list.innerHTML=html;
    }
    function open(){if(sel.disabled)return;wrap.classList.add('open');render()}
    function closeL(){wrap.classList.remove('open');syncFromSelect(true)}
    function pick(o){sel.value=o.value;lastVal=null;sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}));closeL();inp.blur()}
    function create(){var name=inp.value.trim();if(name===label())name='';closeL();window.TecniClientes.open({kind:sel.getAttribute('data-nuevo-cliente')||'person',name:name,onSaved:function(c){
      if(![].some.call(sel.options,function(o){return o.value===c.id})){var op=document.createElement('option');op.value=c.id;op.textContent=c.name;sel.appendChild(op)}
      sel.value=c.id;lastVal=null;sel.dispatchEvent(new Event('change',{bubbles:true}));syncFromSelect(true)}})}
    inp.addEventListener('focus',function(){inp.select();open()});
    inp.addEventListener('input',function(){wrap.classList.add('open');render()});
    inp.addEventListener('blur',function(){setTimeout(function(){if(document.activeElement!==inp)closeL()},150)});
    inp.addEventListener('keydown',function(e){
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!wrap.classList.contains('open'))open();active=Math.max(0,Math.min(shown.length-1,active+(e.key==='ArrowDown'?1:-1)));list.querySelectorAll('.tqb-opt[data-i]').forEach(function(b,i){b.classList.toggle('act',i===active);if(i===active)b.scrollIntoView({block:'nearest'})})}
      else if(e.key==='Enter'){if(wrap.classList.contains('open')&&shown[active]){e.preventDefault();pick(shown[active])}}
      else if(e.key==='Escape'){closeL();inp.blur()}
    });
    list.addEventListener('mousedown',function(e){e.preventDefault();var b=e.target.closest('.tqb-opt');if(!b)return;if(b.dataset.new)return create();var o=shown[Number(b.dataset.i)];if(o)pick(o)});
    new MutationObserver(function(){syncFromSelect(true);if(wrap.classList.contains('open'))render()}).observe(sel,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
    sel.addEventListener('change',function(){syncFromSelect(true)});
    setInterval(function(){syncFromSelect(false)},400);
    syncFromSelect(true);
  }
  function scan(root){(root.querySelectorAll?root:document).querySelectorAll('select').forEach(enhance)}
  function start(){scan(document);new MutationObserver(function(ms){ms.forEach(function(m){if(m.type==='childList'){m.addedNodes.forEach(function(n){if(n.nodeType===1){if(n.tagName==='SELECT')enhance(n);else if(n.querySelectorAll)scan(n)}});if(m.target.tagName==='SELECT')enhance(m.target)}})}).observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.TecniBuscador={enhance:function(sel){sel.dataset.buscar='';enhance(sel)}};
})();
