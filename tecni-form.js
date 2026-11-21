/* Motor de los formularios públicos con el estilo TecniBrand (encuesta, formulario de datos). V9.80
   Uso: TecniForm.start({order, last, peek, check, send, sendLabel}) — ver encuesta.html. */
(()=>{
const BASE="https://kqrfcdfygskzhsdzzcze.supabase.co",KEY="sb_publishable_KfkIr6TlW6ivuT5cD0g9Kg_EuZwDKJ9";
const $=id=>document.getElementById(id);
const RM=()=>matchMedia("(prefers-reduced-motion:reduce)").matches;
const T={step:0,cfg:null,timers:{}};

async function rpc(fn,body){
  const r=await fetch(BASE+"/rest/v1/rpc/"+fn,{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>null);
  if(!r.ok)throw new Error((j&&j.message)||"No se pudo enviar. Revisa tu internet e intenta otra vez.");
  return j;
}
const buzz=()=>{try{navigator.vibrate&&navigator.vibrate(8)}catch(_){}};
function splat(x,y){if(RM()||x==null)return;const col=["#00AEEF","#EC008C","#FFF200","#1A1A1A"];
  for(let i=0;i<8;i++){const d=document.createElement("i");d.className="splat";const a=Math.PI*2*i/8+Math.random()*.5,r=28+Math.random()*26;
    d.style.left=x+"px";d.style.top=y+"px";d.style.background=col[i%4];d.style.setProperty("--dx",Math.cos(a)*r+"px");d.style.setProperty("--dy",Math.sin(a)*r+"px");
    document.body.appendChild(d);setTimeout(()=>d.remove(),650)}}
function pop(el){if(!el)return;el.classList.remove("pop");void el.offsetWidth;el.classList.add("pop")}
// Stickers: list = [[texto, emoji]]; multi = varios; cb(valor, encendido)
function stickers(box,list,multi,cb){
  box.innerHTML=list.map(([t,e],k)=>`<button type="button" class="st" data-v="${t}" aria-pressed="false" style="--n:${k}"><span class="e">${e}</span>${t}</button>`).join("");
  box.addEventListener("click",ev=>{const b=ev.target.closest("button");if(!b)return;const on=!b.classList.contains("sel");
    if(!multi)box.querySelectorAll("button").forEach(x=>{x.classList.remove("sel");x.setAttribute("aria-pressed","false")});
    b.classList.toggle("sel",on);b.setAttribute("aria-pressed",on);buzz();
    if(on){pop(b);const r=b.getBoundingClientRect();splat(ev.clientX||r.left+r.width/2,ev.clientY||r.top)}
    cb(b.dataset.v,on)});
}
let errT;
function err(msg){const e=$("err");clearTimeout(errT);if(!msg){e.classList.remove("on");return}
  e.textContent=msg;e.classList.add("on");try{navigator.vibrate&&navigator.vibrate([20,40,20])}catch(_){}
  const n=$("next");n.classList.remove("miss");void n.offsetWidth;n.classList.add("miss");errT=setTimeout(()=>e.classList.remove("on"),3800)}
function grow(t){t.style.height="auto";t.style.height=Math.max(t.scrollHeight+4,+t.dataset.min||0)+"px"}
function confetti(){if(RM())return;const box=document.createElement("div");box.className="confetti";
  const col=["#00AEEF","#EC008C","#FFF200","#1A1A1A","#ffffff"];
  for(let i=0;i<70;i++){const d=document.createElement("i");d.style.left=Math.random()*100+"vw";d.style.background=col[i%5];d.style.animationDuration=(1.6+Math.random()*1.8)+"s";d.style.animationDelay=Math.random()*.5+"s";const s=6+Math.random()*10;d.style.width=d.style.height=s+"px";box.appendChild(d)}
  document.body.appendChild(box);setTimeout(()=>box.remove(),4200)}

const INKCOL=["var(--c)","var(--m)","var(--y)","var(--k)"];
const order=()=>T.cfg.order();
function inks(){const o=order().slice(1);$("inks").innerHTML=o.map((s,i)=>`<i style="--ink:${INKCOL[i%4]}"></i>`).join("")+`<span class="count"></span>`}
function peek(s){const p=$("peek"),b=$("bubble");if(!p)return;p.classList.remove("on");b.classList.remove("on");clearTimeout(T.timers.pk);
  const msg=(T.cfg.peek||{})[s];
  if(msg)T.timers.pk=setTimeout(()=>{b.textContent=msg;p.classList.add("on");b.classList.add("on");T.timers.pk=setTimeout(()=>{b.classList.remove("on");p.classList.remove("on")},3600)},900)}
function reveal(sec,back){
  document.querySelectorAll(".step").forEach(x=>{if(x!==sec)x.classList.remove("on","bk")});
  sec.classList.toggle("bk",!!back);sec.classList.remove("on");void sec.offsetWidth;sec.classList.add("on");
  window.scrollTo({top:0,behavior:"instant"in window?"instant":"auto"});
  sec.querySelectorAll("textarea").forEach(grow);
}
function setPlate(plate,from){
  if(document.body.dataset.plate===plate)return;
  const w=$("wipe"),r=from&&from.getBoundingClientRect();
  if(r){w.style.setProperty("--wx",(r.left+r.width/2)+"px");w.style.setProperty("--wy",(r.top+r.height/2)+"px")}
  w.style.background={m:"#EC008C",c:"#00AEEF",y:"#FFF200",k:"#1A1A1A"}[plate]||"#ffffff";
  w.classList.remove("go");void w.offsetWidth;w.classList.add("go");
  clearTimeout(T.timers.pt);T.timers.pt=setTimeout(()=>{document.body.dataset.plate=plate;w.classList.remove("go")},RM()?0:520);
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content={m:"#EC008C",c:"#00AEEF",y:"#FFF200",k:"#1A1A1A"}[plate]||"#ffffff";
}
function show(from,back){
  const sec=document.querySelector(`.step[data-s="${T.step}"]`),plate=sec.dataset.plate||"";
  const old=document.querySelector(".step.on");
  if(old&&old!==sec&&!RM()){old.classList.toggle("bk",!!back);old.classList.add("out");setTimeout(()=>{old.classList.remove("on","out","bk");reveal(sec,back)},200)}
  else reveal(sec,back);
  peek(T.step);setPlate(plate,from);
  const o=order(),i=o.indexOf(T.step);
  $("inks").querySelectorAll("i").forEach((d,k)=>{d.classList.toggle("on",k<i);d.classList.toggle("now",k===i-1)});
  $("inks").querySelector(".count").textContent=i?`${i}/${o.length-1}`:"";
  $("back").classList.toggle("hide",i===0);
  $("next").textContent=i===0?"Empezar ✨":T.step===T.cfg.last?(T.cfg.sendLabel||"Enviar ✨"):"Siguiente";
  const f=sec.querySelector("input:not([type=checkbox]):not([type=file]),textarea");
  if(f&&i>0&&matchMedia("(min-width:700px)").matches)setTimeout(()=>f.focus({preventScroll:true}),400);
}
function go(dir,from){
  const o=order(),i=o.indexOf(T.step);
  if(dir<0){if(i>0){T.step=o[i-1];show(from,true);buzz()}return}
  if(i<o.length-1){T.step=o[i+1];show(from)}
}
let autoT;
function autoNext(ms){clearTimeout(autoT);const s=T.step;autoT=setTimeout(()=>{if(T.step===s&&T.step!==T.cfg.last&&!T.cfg.check(s))go(1,$("next"))},ms||650)}
async function finish(){
  const n=$("next"),b=$("back");n.disabled=true;b.disabled=true;n.textContent="Enviando…";
  try{
    await T.cfg.send();
    document.querySelectorAll(".step").forEach(x=>x.classList.remove("on"));
    clearTimeout(T.timers.pt);$("wipe").classList.remove("go");document.body.dataset.plate="y";
    $("inks").classList.add("hide");$("nav").classList.add("hide");peek(-1);
    $("doneBox").classList.remove("hide");window.scrollTo({top:0});confetti();
    try{navigator.vibrate&&navigator.vibrate([30,60,30,60,80])}catch(_){}
  }catch(e){err(e.message);n.disabled=false;b.disabled=false;n.textContent=T.cfg.sendLabel||"Enviar ✨"}
}
function start(cfg){
  T.cfg=cfg;
  document.querySelectorAll(".step,.done").forEach(st=>[...st.children].forEach((c,k)=>c.style.setProperty("--i",k)));
  document.querySelectorAll("textarea").forEach(t=>{t.dataset.min=120;t.addEventListener("input",()=>grow(t))});
  $("err").addEventListener("click",()=>$("err").classList.remove("on"));
  $("back").addEventListener("click",e=>{err("");go(-1,e.currentTarget)});
  $("next").addEventListener("click",async e=>{
    clearTimeout(autoT);const m=cfg.check(T.step);err(m);if(m)return;buzz();
    if(T.step!==cfg.last){go(1,e.currentTarget);return}
    await finish();
  });
  // Deslizar a la derecha = volver
  let tx=null,ty=0;
  document.addEventListener("touchstart",e=>{const t=e.touches[0];tx=e.target.closest("textarea,input,select,.stickers,.nps,.stars,.faces")?null:t.clientX;ty=t.clientY},{passive:true});
  document.addEventListener("touchend",e=>{if(tx===null)return;const t=e.changedTouches[0],dx=t.clientX-tx,dy=Math.abs(t.clientY-ty);tx=null;
    if(dx>80&&dy<50&&!$("back").classList.contains("hide")&&!$("back").disabled)$("back").click()},{passive:true});
  document.addEventListener("focusin",e=>{if(e.target.matches("input[type=text],input[type=tel],input[type=email],textarea"))setTimeout(()=>e.target.scrollIntoView({block:"center",behavior:"smooth"}),300)});
  document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.matches("input[type=text],input[type=tel],input[type=email]")){e.preventDefault();$("next").click()}});
  inks();show();
}
function refresh(){inks();show()}
window.TecniForm={$,rpc,buzz,splat,pop,stickers,err,confetti,start,refresh,autoNext,go,get step(){return T.step}};
})();
