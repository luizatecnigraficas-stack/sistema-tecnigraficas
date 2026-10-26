/* Tecnigráficas · puente entre calculadoras y la cotización en curso.
   Cualquier calculadora nueva solo necesita:
     <script src="quote-bridge.js"></script>
     <div data-quote-bridge></div>            (muestra a qué cotización se va a agregar)
     TecniQuote.send({source, quantity, unit, detail, description, unitPrice, total, ...}, "append"|"new", "nombre-de-la-calculadora")
*/
(function(){
  var KEY='tecniActiveQuoteContextV1';
  function active(){
    var stores=[window.sessionStorage,window.localStorage];
    for(var i=0;i<stores.length;i++){
      try{
        var a=JSON.parse(stores[i].getItem(KEY)||'null');
        if(!a||!a.snapshot)continue;
        var age=Date.now()-new Date(a.savedAt||0).getTime();
        if(!isFinite(age)||age>12*60*60*1000)continue;
        return a;
      }catch(e){}
    }
    return null;
  }
  function label(a){
    if(!a)return null;
    var f=(a.snapshot&&a.snapshot.fields)||{};
    var num=f.quoteNumber&&!/asignar|COT-$/i.test(f.quoteNumber)?f.quoteNumber:'Cotización sin guardar';
    var who=f.clientName||f.companyName||f.personName||'sin cliente todavía';
    var n=((a.snapshot&&a.snapshot.items)||[]).filter(function(i){return String(i.productName||i.detail||'').trim()}).length;
    return num+' · '+who+' · '+n+' producto'+(n===1?'':'s');
  }
  function paint(){
    var a=active(),txt=label(a);
    document.querySelectorAll('[data-quote-bridge]').forEach(function(el){
      el.style.cssText='margin:10px 0;padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.4;'+(a?'background:#e8f7f1;color:#0f6046;border:1px solid #b9e5d2':'background:#fff8e6;color:#8a5300;border:1px solid #f2d79b');
      el.textContent=a?('📄 Cotización en curso: '+txt):'📄 No hay cotización en curso: "Agregar" empezará una nueva con este producto.';
    });
  }
  function send(payload,mode,from){
    if(mode==='append'&&!active()){
      if(!confirm('No hay una cotización en curso.\n\n¿Empiezo una cotización nueva con este producto?'))return false;
      mode='new';
    }
    payload.version=payload.version||1;payload.mode=mode;payload.createdAt=new Date().toISOString();
    try{sessionStorage.setItem('tecniCalculatorQuoteItemV1',JSON.stringify(payload))}
    catch(e){payload.imageData='';sessionStorage.setItem('tecniCalculatorQuoteItemV1',JSON.stringify(payload))}
    location.href='cotizador.html?from='+encodeURIComponent(from||'calculadora');
    return true;
  }
  window.TecniQuote={active:active,label:label,send:send,paint:paint};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',paint);else paint();
  window.addEventListener('pageshow',paint);window.addEventListener('focus',paint);
})();
