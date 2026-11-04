/* Tecnigráficas · reintenta solo cuando Supabase responde "JWT issued at future".
   Pasa cuando la sesión se acaba de renovar y el reloj del servidor va unos segundos atrás:
   esperamos un momentico y volvemos a pedir lo mismo, sin mostrar error. */
(function(){
  if(window.__tecniRetry)return;window.__tecniRetry=true;
  var orig=window.fetch.bind(window);
  function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
  window.fetch=async function(input,init){
    var url=typeof input==="string"?input:(input&&input.url)||"";
    if(url.indexOf("supabase.co")<0)return orig(input,init);
    var req=input instanceof Request?input.clone():null;
    var res=await orig(input,init);
    for(var i=0;i<3&&res.status===401;i++){
      var txt="";try{txt=await res.clone().text()}catch(e){}
      if(!/issued at future/i.test(txt))break;
      await wait(1200*(i+1));
      res=await orig(req?req.clone():input,init);
    }
    return res;
  };
})();
