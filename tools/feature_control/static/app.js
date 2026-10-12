"use strict";
const $=id=>document.getElementById(id);
const token=document.querySelector('meta[name="csrf"]').content;
const form=$("featureForm");
const stepPanels=[...document.querySelectorAll(".step")];
const stepButtons=[...document.querySelectorAll("[data-step]")];
let step=0,items=[],suggested="P1",manualOverride=false;
const probes={Maps:"What is the legal provenance of map imagery and candidate coordinates? How will accuracy be calibrated and verified?",Data:"Which data source, schema, version and license are authoritative?",Native:"What Windows/Linux runtime, packaging and performance checks prove delivery?",UX:"How will keyboard-only navigation, contrast, and responsiveness be tested?",Infrastructure:"Which CI gates or permissions must be verified without breaking main?",Progression:"Which Frozen Trail version and evidence support each milestone?",Planning:"What dependencies, scope and acceptance gates prevent overlapping agents?"};
function payload(){const data=Object.fromEntries(new FormData(form).entries());return data;}
function setStep(n){
  step=Math.max(0,Math.min(3,n));
  stepPanels.forEach((p,i)=>{p.hidden=i!==step;p.classList.toggle("active",i===step);});
  stepButtons.forEach((b,i)=>b.classList.toggle("active",i===step));
  $("back").disabled=step===0;$("next").hidden=step===3;$("submit").hidden=step!==3;
  if(step===3){$("review").textContent=JSON.stringify(payload(),null,2);}
}
async function api(path,data){
  const opts=data===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json","X-MRaiders-CSRF":token},body:JSON.stringify(data)};
  const r=await fetch(path,opts);let body=await r.json();
  if(!r.ok)throw Error(body.error||"Request failed");
  return body;
}
function heuristic(){
  const data=payload(),weights={High:4,Medium:2,Low:0},effort={Small:0,Medium:1,Large:2};
  let score=weights[data.impact]+weights[data.urgency]-effort[data.effort];
  if(data.category==="Security"&&data.impact==="High")score+=2;
  if(data.risk==="High")score-=1;
  suggested=score>=7?"P0":score>=3?"P1":"P2";
  $("suggestion").textContent="Suggested: "+suggested;
  $("why").textContent="Deterministic score "+score+" · High risk slows delivery; it does not silently elevate priority.";
  if(!manualOverride)form.elements.priority.value=suggested;
}
async function loadBoard(){
  $("board").textContent="Refreshing from GitHub Project #2…";
  try{
    const result=await api("/api/board");items=result.items||[];
    renderBoard();
  }catch(e){$("board").textContent="Unable to read Project: "+e.message;}
}
function renderBoard(){
  const priority=$("priorityFilter").value,status=$("statusFilter").value;
  const visible=items.filter(x=>(priority==="All"||x.priority===priority)&&(status==="All"||x.status===status));
  visible.sort((a,b)=>["P0","P1","P2"].indexOf(a.priority)-["P0","P1","P2"].indexOf(b.priority));
  const counts=items.reduce((acc,x)=>{acc[x.priority]=(acc[x.priority]||0)+1;return acc;},{});
  $("metrics").replaceChildren();
  for(const label of ["P0","P1","P2"]){const span=document.createElement("span");span.textContent=label+": "+(counts[label]||0);$("metrics").append(span);}
  $("board").replaceChildren();
  if(!visible.length){$("board").textContent="No items match these filters.";return;}
  for(const item of visible){
    const card=document.createElement("article");card.className="card";
    const link=document.createElement("a");link.href=item.url||"https://github.com/users/MulattoTech/projects/2";
    link.target="_blank";link.rel="noopener";link.textContent=item.title;card.append(link);
    const meta=document.createElement("div");meta.className="meta";
    for(const [value,kind] of [[item.priority,"priority"],[item.status,"stage"],[item.workstream,"workstream"],[item.acceptance,"acceptance"]]){
      const tag=document.createElement("span");tag.className="tag "+(value||"").toLowerCase();tag.textContent=value||"—";meta.append(tag);
    }
    card.append(meta);$("board").append(card);
  }
}

async function loadAuditHealth(){
  $("auditSummary").textContent="Checking GitHub at the exact main revision…";
  $("auditChecks").replaceChildren();
  try {
    const state=await api("/api/audit-health");
    const sha=state.sha || "";
    $("auditSummary").textContent="main @ "+sha.slice(0,12)+" · "+(state.checks||[]).length+" reported checks";
    const expected=["MRaiders Quality Gate","Validate AI provenance","Feature Control tests","Qt/Linux build and CTest","Qt 6.12/Windows package","analyze-cpp"];
    const runs=new Map((state.checks||[]).map(c=>[c.name,c]));
    for(const name of expected){
      const item=runs.get(name);
      const card=document.createElement("article");card.className="card";
      const nameEl=document.createElement("strong");nameEl.textContent=name;card.append(nameEl);
      const status=document.createElement("div");status.className="meta";
      const value=item?((item.conclusion==="NOT_RUN")?item.status:item.conclusion):"MISSING";
      status.textContent=" · "+value;
      card.append(status);
      if(item && item.url && item.url.startsWith("https://github.com/")){
        const link=document.createElement("a");link.href=item.url;link.target="_blank";
        link.rel="noopener";link.textContent=" View run ↗";card.append(link);
      }
      $("auditChecks").append(card);
    }
  } catch(error) {
    $("auditSummary").textContent="Unable to load audit checks: "+error.message;
  }
}

async function submit(ev){
  ev.preventDefault();$("submit").disabled=true;$("message").textContent="Creating GitHub issue and linking Project fields…";
  try{
    const result=await api("/api/features",payload());
    $("message").replaceChildren();
    const text=document.createTextNode(result.ok?"Created ":"Created with incomplete Project update: ");
    const link=document.createElement("a");link.href=result.issue_url;link.textContent=result.feature_id||"View issue";link.target="_blank";link.rel="noopener";
    $("message").append(text,link);
    if(result.warning)$("message").append(document.createTextNode(" — "+result.warning));
    await loadBoard();
  }catch(e){$("message").textContent="Not submitted: "+e.message;}
  finally{$("submit").disabled=false;}
}
$("back").addEventListener("click",()=>setStep(step-1));
$("next").addEventListener("click",()=>{
  const required=stepPanels[step].querySelectorAll("input[required],textarea[required]");
  for(const input of required){if(!input.reportValidity())return;}
  setStep(step+1);
});
stepButtons.forEach(b=>b.addEventListener("click",()=>{const next=Number(b.dataset.step);if(next<=step)setStep(next);}));
form.addEventListener("submit",submit);
["impact","urgency","effort","risk","category"].forEach(n=>form.elements[n].addEventListener("change",heuristic));
form.elements.priority.addEventListener("change",()=>{manualOverride=true;});
$("workstream").addEventListener("change",()=>{$("probe").textContent=probes[$("workstream").value];});
$("priorityFilter").addEventListener("change",renderBoard);
$("statusFilter").addEventListener("change",renderBoard);
$("refresh").addEventListener("click",loadBoard);
$("refreshAudit").addEventListener("click",loadAuditHealth);
async function boot(){try{const info=await api("/api/health");$("health").textContent="Connected · @"+info.signed_in_as;}catch(e){$("health").textContent="GitHub CLI login required: "+e.message;}heuristic();$("probe").textContent=probes[$("workstream").value];setStep(0);loadBoard();loadAuditHealth();}
boot();
