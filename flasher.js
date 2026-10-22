// DGVeLab Flash Center — experimental hardware flasher, esptool-js v0.7.0
import { ESPLoader, Transport } from "https://unpkg.com/esptool-js@0.7.0/bundle.js";
const $ = id => document.getElementById(id);
let transport = null, loader = null, port = null, busy = false, rowId = 0;
let selectedProject = null, selectedRelease = null, officialCatalog = null;
let unplugged = false;
const logEl = $("activityLog");
function log(message) {
  const time = new Date().toLocaleTimeString();
  logEl.textContent += "\n[" + time + "] " + String(message);
  if (logEl.textContent.length > 70000) logEl.textContent = logEl.textContent.slice(-60000);
  logEl.scrollTop = logEl.scrollHeight;
}
function showResult(id, state, heading, message) {
 const el=$(id);el.hidden=false;el.className="flash-result "+state;el.replaceChildren();
 const strong=document.createElement("strong");strong.textContent=heading;
 const p=document.createElement("p");p.textContent=message;el.append(strong,p);
}
function clearResult(id){$(id).hidden=true;$(id).replaceChildren();}
async function autoReset(){
  // After a successful write, return the serial port to Windows so JoyDeck Hub
  // or another desktop application can open it without unplugging the USB cable.
  if(!loader||unplugged)return "USB was disconnected; reconnect the device if needed.";
  let resetMessage;
  try{
    await loader.after("hard_reset");
    log("Hardware reset signal sent (RTS).");
    resetMessage="Reset signal sent.";
  }catch(e){
    log("Automatic reset unavailable: "+(e.message||e));
    resetMessage="Automatic reset unavailable; press EN/RST if needed.";
  }
  // Release the serial port even if the reset failed.
  try{
    await transport.disconnect();
    log("Serial port closed and released to other applications.");
    resetMessage+=" USB serial port released; you can now start JoyDeck Hub.";
  }catch(e){
    log("WARNING: Could not release serial port: "+(e.message||e));
    resetMessage+=" Could not confirm USB port release. Close this browser tab before opening JoyDeck Hub.";
  }finally{
    transport=null;loader=null;port=null;
    unplugged=false;
    $("detectedChip").textContent="Disconnected after flash — ready for JoyDeck Hub.";
  }
  return resetMessage;
}
function lostConnection(message){
 if(unplugged)return;
 unplugged=true; loader=null;transport=null;port=null;
 $("detectedChip").textContent="USB disconnected. Reconnect to continue.";
 log(message);
 showResult("advancedResult","warning","USB disconnected","Reconnect the board before the next operation.");
 showResult("officialResult","warning","USB disconnected","Reconnect the board before the next operation.");
 sync();
}
function sync() {
  const connected = !!loader && !unplugged;
  $("connectBtn").disabled = busy || connected || !("serial" in navigator);
  $("disconnectBtn").disabled = busy || !transport;
  $("flashBtn").disabled = busy || !connected;
  $("eraseBtn").disabled = busy || !connected;
  $("resetBtn").disabled = busy || !connected;
  $("addFileBtn").disabled = busy;
  if ($("officialConnectBtn")) $("officialConnectBtn").disabled = busy || connected || !("serial" in navigator);
  if ($("officialInstallBtn")) $("officialInstallBtn").disabled = busy || !connected || !selectedRelease;
  if ($("officialDeviceStatus")) $("officialDeviceStatus").textContent = connected ? $("detectedChip").textContent : busy ? "Connecting / programming…" : "Not connected";
  if ($("officialLed")) $("officialLed").classList.toggle("connected",connected);
  const projectSelect=$("officialProjectSelect");
  if (projectSelect) projectSelect.disabled=busy || !officialCatalog?.projects?.length;
  const versionSelect=$("officialRelease");
  if (versionSelect) versionSelect.disabled=busy || !selectedRelease;
  $("deviceStatus").textContent = busy ? "Working…" : connected ? "Connected" : "Disconnected";
  document.querySelectorAll(".filerows input,.filerows button,.settingsgrid select,#baud").forEach(el => el.disabled = busy);
}
const terminal = {
  clean() {},
  writeLine(s) { log(s); },
  write(s) { if (s && s.trim()) log(s.trim()); }
};
async function disconnect() {
  try { if (transport) await transport.disconnect(); }
  finally {
    transport = null;
    loader = null;
    port = null;
    unplugged=false;
    $("detectedChip").textContent = "Connect an ESP device via USB.";
    sync();
  }
}
$("connectBtn").addEventListener("click", async () => {
  if (!("serial" in navigator)) return log("Web Serial unavailable: use Chrome or Edge desktop over HTTPS.");
  busy = true; unplugged=false; sync();
  try {
    log("Select a serial port in the browser dialog.");
    port = await navigator.serial.requestPort();
    transport = new Transport(port, true);
    transport.setDeviceLostCallback?.(()=>lostConnection("USB connection lost during serial communication."));
    loader = new ESPLoader({ transport, baudrate: Number($("baud").value), terminal, debugLogging: false });
    const chipName = await loader.main();
    $("detectedChip").textContent = chipName + " · " + $("baud").value + " baud";
    log("Connected. Detected chip: " + chipName);
    // Use only chip-supported choices, defaulting to non-destructive 'keep' settings.
    const mode = $("flashMode"), freq = $("flashFreq"), size = $("flashSize");
    mode.innerHTML = ["keep","dio","qio","dout","qout"].map(v=>'<option value="'+v+'">'+v.toUpperCase()+'</option>').join("");
    const freqVals = Object.keys(loader.chip?.FLASH_FREQUENCY || {});
    freq.innerHTML = ["keep", ...freqVals].map(v=>'<option value="'+v+'">'+v+'</option>').join("");
    const sizeVals = Object.keys(loader.chip?.FLASH_SIZES || {});
    size.innerHTML = ["keep","detect", ...sizeVals].map(v=>'<option value="'+v+'">'+v+'</option>').join("");
  } catch (e) {
    log("Connection failed: " + (e.message || e));
    try { if (transport) await transport.disconnect(); } catch {}
    loader=null; transport=null; port=null;
  } finally { busy=false; sync(); }
});
$("disconnectBtn").addEventListener("click",async()=>{
  busy=true;sync();
  try {await disconnect(); log("Disconnected.");}
  catch(e){log("Disconnect error: "+e.message);}
  finally{busy=false;sync();}
});
function addRow(offset = "0x0") {
  const row = document.createElement("div");
  row.className = "filerow"; row.dataset.id=String(++rowId);
  const address = document.createElement("input");
  address.className = "fileoffset"; address.value=offset; address.setAttribute("aria-label","Flash offset (hex)");
  const file = document.createElement("input");
  file.className = "binfile"; file.type="file"; file.accept=".bin,.dgv,application/octet-stream"; file.setAttribute("aria-label","Firmware BIN file");
  const remove=document.createElement("button");
  remove.type="button";remove.className="secondary";remove.textContent="Remove";
  remove.addEventListener("click",()=>{if(!busy){row.remove();if(!$("fileRows").children.length)addRow();}});
  row.append(address,file,remove);
  $("fileRows").append(row);
}
$("addFileBtn").addEventListener("click",()=>addRow("0x10000"));
addRow();
function collectMetadata(){
  const files=[];
  for(const row of $("fileRows").children){
    const input=row.querySelector(".binfile"), raw=row.querySelector(".fileoffset").value.trim();
    if(!input.files.length){if(raw==="0x0" && $("fileRows").children.length===1) continue; throw Error("Choose a .bin file for each row.");}
    if(!/^0x[0-9a-f]+$/i.test(raw)) throw Error("Flash offsets must be hexadecimal, for example 0x0 or 0x10000.");
    const address=Number.parseInt(raw,16), file=input.files[0];
    if(!Number.isSafeInteger(address) || address<0 || address>0xFFFFFFFF) throw Error("Offset is outside the supported address range.");
    if(!/\.(bin|dgv)$/i.test(file.name) || file.size===0) throw Error("Choose a non-empty .bin or .dgv firmware file.");
    if(file.size > 32*1024*1024) throw Error("File exceeds the 32 MiB safety limit.");
    if(address % 4096 !== 0) throw Error("Flash offset must be 4 KiB-aligned: "+raw);
    files.push({address,file});
  }
  if(!files.length) throw Error("Select at least one BIN file.");
  files.sort((a,b)=>a.address-b.address);
  for(let i=1;i<files.length;i++){
    if(files[i].address < files[i-1].address+files[i-1].file.size) throw Error("Firmware images overlap in flash memory.");
  }
  return files;
}
async function action(fn){
  if(!loader || busy) return;
  busy=true;sync();
  try{await fn();}catch(e){const message=e.message||String(e); log("ERROR: "+message);
    showResult($("officialPanel").classList.contains("hidden")?"advancedResult":"officialResult","error","Operation failed",message);
  }
  finally{busy=false;sync();}
}
$("flashBtn").addEventListener("click",()=>action(async()=>{
  clearResult("advancedResult");
  const metadata=collectMetadata();
  const summary=metadata.map(f=>f.file.name+" at 0x"+f.address.toString(16)+" ("+f.file.size+" bytes)").join("\n");
  const approved=confirm("WARNING: Flashing may overwrite firmware and settings. Verify chip family and offsets.\n\n"+summary+"\n\nContinue with flashing?");
  if(!approved){log("Flash canceled.");return;}
  const fileArray=[];
  for(const item of metadata){
    const data=new Uint8Array(await item.file.arrayBuffer());
    if(item.file.name.toLowerCase().endsWith(".dgv")){
      if(data.length<0x10018 || data[0x1000]!==0xe9 || data[0x10000]!==0xe9){
        throw Error("DGV file does not match the expected merged ESP32 layout (bootloader at 0x1000, app at 0x10000).");
      }
      if(item.address!==0) throw Error("This DGVeLab merged firmware must be written at offset 0x0.");
      if(!/^ESP32(?:-|\\b)(?!S[23]|C[2356]|H[24]|P4)/.test(String($("detectedChip").textContent))){
        throw Error("DGV firmware requires an ESP32-family chip. Verify compatibility before flashing.");
      }
      log("Merged DGVeLab firmware detected: bootloader 0x1000; partitions 0x8000; application 0x10000.");
    }
    fileArray.push({address:item.address,data});
  }
  $("flashProgress").value=0;$("progressLabel").textContent="0%";
  log("Writing "+fileArray.length+" firmware image(s)...");
  const started=performance.now();
  const totals=fileArray.map(x=>x.data.length);
  const written=totals.map(()=>0);
  await loader.writeFlash({
    fileArray,
    flashMode:$("flashMode").value,
    flashFreq:$("flashFreq").value,
    flashSize:$("flashSize").value,
    eraseAll:false,
    compress:true,
    reportProgress:(i,done,total)=>{
      written[i]=Math.min(done,total);
      const pct=Math.floor(100*written.reduce((a,b)=>a+b,0)/totals.reduce((a,b)=>a+b,0));
      $("flashProgress").value=pct;$("progressLabel").textContent=pct+"%";
    }
  });
  $("flashProgress").value=100;$("progressLabel").textContent="100%";
  log("Flash operation completed.");
  const elapsed=performance.now()-started;
  const resetMessage=await autoReset();
  showResult("advancedResult","success","Firmware write completed",
    metadata.map(x=>x.file.name).join(", ")+" · "+totals.reduce((a,b)=>a+b,0).toLocaleString()+" bytes · "+(elapsed/1000).toFixed(1)+" s. "+resetMessage+" Application startup is not automatically verified.");
}));
$("eraseBtn").addEventListener("click",()=>action(async()=>{
  if(!confirm("ERASE ALL FLASH? This permanently deletes firmware, preferences, calibration and stored data on the connected chip."))return;
  const word=prompt("Type ERASE to confirm complete flash deletion:");
  if(word!=="ERASE"){log("Erase canceled.");return;}
  log("Erasing entire flash...");
  await loader.eraseFlash();
  log("Erase completed.");
}));
$("resetBtn").addEventListener("click",()=>action(async()=>{
  await loader.after("hard_reset");log("Hard reset requested. If the device remains in bootloader mode, disconnect and reconnect USB.");
}));
$("clearLogBtn").addEventListener("click",()=>{logEl.textContent="Log cleared.";});
if(!("serial" in navigator))log("Web Serial is unavailable. Open this page via HTTPS in desktop Chrome or Edge.");
sync();


// Official firmware installer. Catalog entries remain unavailable until signed-off images are published.
const projectsEl=$("officialProjectSelect");
const releaseEl=$("officialRelease");
function getChipFamily(){
  const label=$("detectedChip").textContent;
  if(/^ESP8266\b/.test(label))return "ESP8266";
  if(/^ESP32(?:-D|-W| \(|\b)/.test(label) && !/^ESP32-(?:S2|S3|C2|C3|C5|C6|H2|P4)\b/.test(label))return "ESP32";
  const other=label.match(/^ESP32-(?:S2|S3|C2|C3|C5|C6|H2|P4)\b/);
  return other?.[0] ?? "UNKNOWN";
}
function hex(b){return Array.from(b).map(x=>x.toString(16).padStart(2,"0")).join("");}
function catalogUpdate(){
  const projects=officialCatalog?.projects??[];
  if(!selectedProject && projects.length)selectedProject=projects[0];
  projectsEl.replaceChildren();
  for(const project of projects){
    const released=(project.releases||[]).some(r=>r.published===true);
    projectsEl.add(new Option(project.name+(released?"":" · Coming soon"),project.id));
  }
  projectsEl.disabled=busy||projects.length===0;
  if(selectedProject)projectsEl.value=selectedProject.id;
  const releases=(selectedProject?.releases??[]).filter(r=>r.published===true);
  selectedRelease=releases.find(r=>r.version===selectedRelease?.version)??releases[0]??null;
  releaseEl.replaceChildren();
  if(!selectedRelease){
    releaseEl.add(new Option("Not available",""));
    releaseEl.disabled=true;
    $("officialState").textContent="COMING SOON";
    $("officialNotice").textContent="No firmware available for this project.";
  }else{
    for(const release of releases)releaseEl.add(new Option(
      release.version+(release.hubVersion?" · Hub "+release.hubVersion:""),release.version));
    releaseEl.value=selectedRelease.version;
    releaseEl.disabled=busy;
    $("officialState").textContent="AVAILABLE";
    $("officialNotice").textContent="Flashing may overwrite calibration and saved settings. Verify your device.";
  }
  $("officialProjectName").textContent=selectedProject?.name??"";
  $("officialDescription").textContent=selectedProject?.description??"";
  $("officialCompatibility").textContent=selectedProject?.chipFamily??"";
  $("officialReleaseInfo").textContent=selectedRelease?.hubVersion??"";
  $("officialChip").textContent=selectedProject?.chipFamily??"ESP";
  const hubEl=$("officialHub");
  hubEl.hidden=!selectedRelease?.hubVersion;
  hubEl.textContent=selectedRelease?.hubVersion?"Hub "+selectedRelease.hubVersion:"";
  const link=$("officialSourceLink");
  const url=selectedRelease?.sourceRelease;
  if(typeof url==="string"&&/^https:\/\/github\.com\/DGVeLab\/[A-Za-z0-9_.-]+\/releases\/tag\/[a-zA-Z0-9._-]+$/.test(url)){
    link.href=url;link.hidden=false;
  }else link.hidden=true;
  sync();
}
projectsEl.addEventListener("change",()=>{
  selectedProject=(officialCatalog?.projects??[]).find(p=>p.id===projectsEl.value)??null;
  selectedRelease=null;
  clearResult("officialResult");
  $("officialProgress").value=0;$("officialProgressLabel").textContent="0%";
  catalogUpdate();
});
releaseEl.addEventListener("change",()=>{
  selectedRelease=(selectedProject?.releases??[]).find(r=>r.version===releaseEl.value&&r.published===true)??null;
  clearResult("officialResult");
  $("officialProgress").value=0;$("officialProgressLabel").textContent="0%";
  catalogUpdate();
});
$("officialConnectBtn").addEventListener("click",()=> $("connectBtn").click());
$("officialInstallBtn").addEventListener("click",()=>action(async()=>{
  clearResult("officialResult");
  if(!selectedProject || !selectedRelease || selectedRelease.published!==true)throw Error("No official firmware available.");
  const family=getChipFamily();
  if(family!==selectedProject.chipFamily)throw Error("Chip mismatch. Connected "+family+", expected "+selectedProject.chipFamily+".");
  const parts=selectedRelease.parts;
  if(!Array.isArray(parts)||!parts.length)throw Error("Release has no firmware images.");
  const fileArray=[];
  for(const part of parts){
    if(!Number.isSafeInteger(part.offset)||part.offset<0||part.offset%4096!==0)throw Error("Invalid release flash address.");
    if(typeof part.path!=="string" || !part.path.startsWith("./firmware/") || part.path.includes(".."))throw Error("Firmware must be hosted under ./firmware/.");
    if(!/^[0-9a-f]{64}$/i.test(part.sha256||""))throw Error("Missing SHA-256 for official firmware.");
    const response=await fetch(part.path,{cache:"no-store"});
    if(!response.ok)throw Error("Firmware download failed: HTTP "+response.status);
    const data=new Uint8Array(await response.arrayBuffer());
    if(data.length===0||data.length>32*1024*1024)throw Error("Invalid firmware size.");
    const digest=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",data)));
    if(digest.toLowerCase()!==part.sha256.toLowerCase())throw Error("SHA-256 mismatch: firmware image is not verified.");
    fileArray.push({address:part.offset,data});
  }
  fileArray.sort((a,b)=>a.address-b.address);
  for(let i=1;i<fileArray.length;i++)if(fileArray[i].address<fileArray[i-1].address+fileArray[i-1].data.length)throw Error("Overlapping official firmware parts.");
  const descriptions=fileArray.map(f=>"0x"+f.address.toString(16)+" ("+f.data.length+" bytes)").join("\n");
  if(!confirm("Install official "+selectedProject.name+" firmware "+selectedRelease.version+"?\n\nConnected: "+$("detectedChip").textContent+"\n\n"+descriptions+"\n\nThis may overwrite device settings. Continue?"))return;
  log("Official install: "+selectedProject.name+" "+selectedRelease.version+" SHA-256 verified.");
  const started=performance.now();
  const sizes=fileArray.map(f=>f.data.length),progress=sizes.map(()=>0);
  $("officialProgress").value=0;$("officialProgressLabel").textContent="0%";
  await loader.writeFlash({
    fileArray,flashMode:"keep",flashFreq:"keep",flashSize:"keep",eraseAll:false,compress:true,
    reportProgress:(i,done,total)=>{
      progress[i]=Math.min(done,total);
      const pct=Math.floor(100*progress.reduce((a,b)=>a+b,0)/sizes.reduce((a,b)=>a+b,0));
      $("officialProgress").value=pct;$("officialProgressLabel").textContent=pct+"%";
    }
  });
  $("officialProgress").value=100;$("officialProgressLabel").textContent="100%";
  log("Official firmware write completed.");
  const elapsed=performance.now()-started;
  const resetMessage=await autoReset();
  showResult("officialResult","success","Firmware write completed",
    selectedProject.name+" v"+selectedRelease.version+" · "+sizes.reduce((a,b)=>a+b,0).toLocaleString()+" bytes · "+(elapsed/1000).toFixed(1)+" s. "+resetMessage+" Application startup is not automatically verified.");
}));
async function loadCatalog(){
  try{
    const response=await fetch("./firmware/catalog.json",{cache:"no-store"});
    if(!response.ok)throw Error("HTTP "+response.status);
    const data=await response.json();
    if(data.schemaVersion!==1||!Array.isArray(data.projects))throw Error("Unsupported catalog schema.");
    officialCatalog=data;
    selectedProject=data.projects[0]??null;
    catalogUpdate();
  }catch(e){
    $("officialProjectSelect").replaceChildren(new Option("Catalog unavailable",""));
    $("officialProjectSelect").disabled=true;
    $("officialProjectName").textContent="Catalog unavailable";
    $("officialNotice").textContent="Cannot load official catalog: "+e.message;
    log("Catalog error: "+e.message);
  }
}
loadCatalog();

if("serial" in navigator){
 navigator.serial.addEventListener("disconnect",event=>{
   if(port && (event.port===port || event.target===port))lostConnection("USB device physically disconnected.");
 });
}
