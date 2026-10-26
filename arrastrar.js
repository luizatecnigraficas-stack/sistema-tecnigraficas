/* Tecnigráficas · arrastrar y pegar archivos en cualquier "Seleccionar archivo".
   - Arrastra una foto o PDF encima del campo (o de su recuadro).
   - O cópiala (captura, WhatsApp Web, otra página) y pégala con Ctrl+V / Cmd+V.
   El archivo entra al campo como si lo hubieras seleccionado, así que todo lo demás funciona igual. */
(function(){
  var lastZone=null;
  var css='.tq-drop-zone{transition:box-shadow .15s,background-color .15s;border-radius:12px}'+
    '.tq-drop-zone.tq-over{box-shadow:0 0 0 3px #00a6d6 inset;background-color:#e9f7fc!important}'+
    '.tq-drop-zone.tq-target{box-shadow:0 0 0 2px #e6007e55 inset}'+
    '.tq-drop-hint{display:block;margin-top:4px;font-size:10px;color:#7b8494;font-weight:600}'+
    '.tq-drop-flash{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100001;background:#20222a;color:#fff;padding:11px 16px;border-radius:12px;font:700 13px Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)}';
  function addCss(){if(document.getElementById('tq-drop-css'))return;var s=document.createElement('style');s.id='tq-drop-css';s.textContent=css;document.head.appendChild(s)}
  function flash(t){var d=document.createElement('div');d.className='tq-drop-flash';d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove()},1800)}
  function zoneOf(input){return input.closest('label, .field, .qs-support, .dropzone, .upload, .upload-box, .photo-box')||input.parentElement}
  function visible(el){return !!(el&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length))}
  function accepts(input,file){
    var acc=(input.getAttribute('accept')||'').split(',').map(function(s){return s.trim().toLowerCase()}).filter(Boolean);
    if(!acc.length)return true;
    var type=(file.type||'').toLowerCase(),name=(file.name||'').toLowerCase();
    return acc.some(function(a){
      if(a.endsWith('/*'))return type.indexOf(a.slice(0,-1))===0;
      if(a.charAt(0)==='.')return name.slice(-a.length)===a;
      return type===a;
    });
  }
  function nameFor(file,i){
    if(file.name&&file.name!=='image.png')return file;
    var ext=(file.type.split('/')[1]||'png').replace('jpeg','jpg');
    try{return new File([file],'pegado-'+Date.now()+(i?'-'+i:'')+'.'+ext,{type:file.type})}catch(e){return file}
  }
  function put(input,files){
    files=[].slice.call(files).filter(function(f){return accepts(input,f)});
    if(!files.length){flash('Ese tipo de archivo no sirve aquí');return false}
    if(!input.multiple)files=[files[0]];
    try{var dt=new DataTransfer();files.forEach(function(f,i){dt.items.add(nameFor(f,i))});input.files=dt.files}catch(e){flash('Tu navegador no deja pegar aquí; usa Seleccionar archivo');return false}
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    var z=zoneOf(input);if(z){z.classList.add('tq-over');setTimeout(function(){z.classList.remove('tq-over')},500)}
    flash(files.length>1?'✓ '+files.length+' archivos agregados':'✓ Archivo agregado');
    return true;
  }
  function enhance(input){
    if(input.__tqDrop||input.disabled)return;input.__tqDrop=true;
    var z=zoneOf(input);if(!z)return;z.classList.add('tq-drop-zone');
    function hint(){if(visible(input)&&!z.querySelector('.tq-drop-hint')){var h=document.createElement('span');h.className='tq-drop-hint';h.textContent='También puedes arrastrar el archivo aquí o pegarlo con Ctrl+V';input.insertAdjacentElement('afterend',h)}}
    hint();if(!z.querySelector('.tq-drop-hint')&&window.IntersectionObserver){var io=new IntersectionObserver(function(en){if(en.some(function(x){return x.isIntersecting})){hint();if(z.querySelector('.tq-drop-hint'))io.disconnect()}});io.observe(z)}
    var depth=0;
    z.addEventListener('dragenter',function(e){if(!hasFiles(e))return;e.preventDefault();depth++;z.classList.add('tq-over')});
    z.addEventListener('dragover',function(e){if(!hasFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy'});
    z.addEventListener('dragleave',function(){depth=Math.max(0,depth-1);if(!depth)z.classList.remove('tq-over')});
    z.addEventListener('drop',function(e){if(!hasFiles(e))return;e.preventDefault();e.stopPropagation();depth=0;z.classList.remove('tq-over');lastZone=input;put(input,e.dataTransfer.files)});
    ['pointerdown','focusin','mouseenter'].forEach(function(ev){z.addEventListener(ev,function(){setTarget(input)})});
  }
  function setTarget(input){
    if(lastZone&&lastZone!==input){var oz=zoneOf(lastZone);oz&&oz.classList.remove('tq-target')}
    lastZone=input;
  }
  function hasFiles(e){var t=e.dataTransfer&&e.dataTransfer.types;return !!t&&[].indexOf.call(t,'Files')>=0}
  function scan(root){(root.querySelectorAll?root:document).querySelectorAll('input[type=file]').forEach(enhance)}
  function openLayer(){
    // la ventana abierta más arriba (modal / diálogo) manda
    var layers=[].slice.call(document.querySelectorAll('dialog[open], .modal-backdrop:not(.hidden), .nice-alert-back')).filter(visible);
    return layers.length?layers[layers.length-1]:document;
  }
  function pickTarget(){
    var layer=openLayer();
    if(lastZone&&document.contains(lastZone)&&!lastZone.disabled&&layer.contains(lastZone)&&visible(zoneOf(lastZone)))return lastZone;
    var inputs=[].slice.call(layer.querySelectorAll('input[type=file]')).filter(function(i){return !i.disabled&&visible(zoneOf(i))});
    return inputs.length===1?inputs[0]:(inputs.length?null:null);
  }
  document.addEventListener('paste',function(e){
    var files=e.clipboardData&&e.clipboardData.files;if(!files||!files.length)return;
    var target=pickTarget();
    if(!target){
      var layer=openLayer(),many=layer.querySelectorAll('input[type=file]').length;
      if(many){flash('Toca primero el campo donde va la foto y vuelve a pegar');}
      return;
    }
    e.preventDefault();put(target,files);
  });
  // evitar que soltar un archivo fuera de un campo abra la foto y saque del sistema
  window.addEventListener('dragover',function(e){if(hasFiles(e))e.preventDefault()});
  window.addEventListener('drop',function(e){if(hasFiles(e)&&!e.defaultPrevented){e.preventDefault();flash('Suelta la foto encima del campo donde va')}});
  function start(){addCss();scan(document);new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1){if(n.matches&&n.matches('input[type=file]'))enhance(n);else scan(n)}})})}).observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
