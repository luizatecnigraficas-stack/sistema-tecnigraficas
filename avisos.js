/* Tecnigráficas · avisos bonitos (reemplaza las ventanitas grises del navegador) */
(function(){
  var css='.nice-alert-back{position:fixed;inset:0;z-index:100000;background:rgba(20,22,30,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}'+
  '.nice-alert{background:#fff;color:#20222a;border-radius:20px;max-width:420px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,.3);overflow:hidden;animation:niceIn .18s ease-out}'+
  '.nice-alert:before{content:"";display:block;height:6px;background:linear-gradient(90deg,#00a6d6 0 34%,#e6007e 34% 68%,#ffd500 68%)}'+
  '.nice-alert .na-body{padding:20px 22px 8px;display:flex;gap:12px;align-items:flex-start}.nice-alert .na-ico{font-size:24px;line-height:1}'+
  '.nice-alert p{margin:0;font-size:15px;line-height:1.5;white-space:pre-line;font-weight:600}'+
  '.nice-alert details{margin:10px 0 0;font-size:12px;color:#5d6472}.nice-alert details summary{cursor:pointer;font-weight:700}'+
  '.nice-alert .na-foot{padding:12px 22px 18px;display:flex;justify-content:flex-end}'+
  '.nice-alert button{border:0;border-radius:12px;padding:11px 20px;font-weight:900;font-size:14px;cursor:pointer;color:#fff;background:linear-gradient(125deg,#00a6d6,#e6007e);min-height:44px;font-family:inherit}'+
  '@keyframes niceIn{from{transform:translateY(8px) scale(.97);opacity:0}to{transform:none;opacity:1}}';
  function addCss(){if(document.getElementById('nice-alert-css'))return;var s=document.createElement('style');s.id='nice-alert-css';s.textContent=css;(document.head||document.documentElement).appendChild(s)}
  var queue=[],open=false;
  function next(){
    var raw=queue.shift();if(raw===undefined){open=false;return}open=true;addCss();
    var tech=/SQL V\d|Supabase|function |relation |column |permission denied|violates|JWT|schema cache/i.test(raw);
    var err=tech||/no fue posible|no se pudo|no pude|error|fall[óo]|tard[óo]|no tienes permiso|bloque/i.test(raw);
    var back=document.createElement('div');back.className='nice-alert-back';
    back.innerHTML='<div class="nice-alert" role="alertdialog" aria-modal="true"><div class="na-body"><span class="na-ico">'+(err?'⚠️':'💬')+'</span><div><p></p>'+(tech?'<details><summary>Ver detalle técnico</summary><div class="na-tech" style="margin-top:6px;white-space:pre-wrap;word-break:break-word"></div></details>':'')+'</div></div><div class="na-foot"><button type="button">Entendido</button></div></div>';
    back.querySelector('p').textContent=tech?'Algo no funcionó como debía. Inténtalo otra vez; si sigue pasando, avísale a Lu con un pantallazo de este mensaje.':raw;
    if(tech)back.querySelector('.na-tech').textContent=raw;
    function key(e){if(e.key==='Escape'||e.key==='Enter'){e.preventDefault();e.stopPropagation();close()}}
    function close(){document.removeEventListener('keydown',key,true);back.remove();next()}
    back.querySelector('button').addEventListener('click',close);back.addEventListener('click',function(e){if(e.target===back)close()});
    document.addEventListener('keydown',key,true);document.body.appendChild(back);setTimeout(function(){back.querySelector('button').focus()},30);
  }
  window.alert=function(msg){queue.push(String(msg==null?'':msg));if(!open){if(document.body)next();else document.addEventListener('DOMContentLoaded',function(){if(!open)next()})}};
})();
