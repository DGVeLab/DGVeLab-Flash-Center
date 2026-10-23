// DGVeLab Flash Center — experimental hardware flasher, esptool-js v0.7.0
import { ESPLoader, Transport } from "./vendor/esptool-js/0.7.0/bundle.js";
const $ = id => document.getElementById(id);
let transport = null, loader = null, port = null, busy = false, rowId = 0;
let selectedProject = null, selectedRelease = null, officialCatalog = null;
let unplugged = false;
let peerPort=null, peerReader=null, peerWriter=null, peerPump=null;
let peerWait=null, peerBusy=false, peerConnected=false;
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
function connectionAlert(message){
  for(const id of ["officialConnectionAlert","advancedConnectionAlert"]){
    const el=$(id);
    if(!el)continue;
    el.hidden=!message;
    el.textContent=message||"";
  }
}
function connectionErrorMessage(error,stage){
  const name=String(error?.name||"");
  const message=String(error?.message||error||"");
  // A dismissed browser chooser is not a failed connection.
  if(stage==="selection"&&name==="NotFoundError")return "";
  if(stage==="opening" && /NetworkError|InvalidStateError|NotReadableError|AbortError/i.test(name))
    return "Unable to open the USB port. It may already be in use by a serial monitor or another application. Close the other program and try again.";
  if(/access denied|permission|in use|already open|busy|failed to open|could not open|cannot open|open failed/i.test(message))
    return "USB port unavailable or already in use. Close JoyDeck Hub, Arduino/PlatformIO serial monitor and other COM-port applications, then retry.";
  if(stage==="opening")return "Could not connect to the selected USB port. Check the cable, driver and other applications using the port, then retry.";
  return "Connection failed: "+message+". Check the USB connection and try again.";
}
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
    $("chipDetails").hidden=true;
  }
  return resetMessage;
}
function lostConnection(message){
 if(unplugged)return;
 unplugged=true; loader=null;transport=null;port=null;
 $("detectedChip").textContent="USB disconnected. Reconnect to continue.";
 $("chipDetails").hidden=true;
 log(message);
 showResult("advancedResult","warning","USB disconnected","Reconnect the board before the next operation.");
 showResult("officialResult","warning","USB disconnected","Reconnect the board before the next operation.");
 sync();
}
function sync() {
  const connected = !!loader && !unplugged;
  $("connectBtn").disabled = busy || connected || peerConnected || !("serial" in navigator);
  $("disconnectBtn").disabled = busy || !transport;
  $("flashBtn").disabled = busy || !connected;
  $("eraseBtn").disabled = busy || !connected;
  $("resetBtn").disabled = busy || !connected;
  $("addFileBtn").disabled = busy;
  $("autoOffsetsBtn").disabled = busy;
  $("mergeBtn").disabled = busy;
  $("readChipBtn").disabled = busy || !connected;
  $("readPeerBtn").disabled = busy || peerBusy || !peerConnected;
  $("writePeerBtn").disabled = busy || peerBusy || !peerConnected;
  $("advancedLed").classList.toggle("connected",connected);
  if ($("officialConnectBtn")) {
    $("officialConnectBtn").disabled = busy || connected || !("serial" in navigator);
    $("officialConnectBtn").textContent = peerConnected ? "Disconnect USB" : "Connect USB";
  }
  if ($("officialInstallBtn")) $("officialInstallBtn").disabled = busy || !connected || !selectedRelease;
  if ($("officialDeviceStatus")) $("officialDeviceStatus").textContent = peerConnected ? "Firmware serial · 115200 baud" : connected ? $("detectedChip").textContent : busy ? "Connecting / programming…" : "Not connected";
  if ($("officialLed")) $("officialLed").classList.toggle("connected",connected||peerConnected);
  const projectSelect=$("officialProjectSelect");
  if (projectSelect) projectSelect.disabled=busy || !officialCatalog?.projects?.length;
  const versionSelect=$("officialRelease");
  if (versionSelect) versionSelect.disabled=busy || !selectedRelease;
  $("deviceStatus").textContent = busy ? "Working…" : connected ? "Connected" : peerConnected ? "Firmware serial active in Projects" : "Disconnected";
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
    $("chipDetails").hidden=true;
    sync();
  }
}
$("connectBtn").addEventListener("click", async () => {
  if (!("serial" in navigator)) return log("Web Serial unavailable: use Chrome or Edge desktop over HTTPS.");
  busy = true; unplugged=false; connectionAlert(""); sync();
  let stage="selection";
  try {
    log("Select a serial port in the browser dialog.");
    port = await navigator.serial.requestPort();
    stage="opening";
    transport = new Transport(port, true);
    transport.setDeviceLostCallback?.(()=>lostConnection("USB connection lost during serial communication."));
    loader = new ESPLoader({ transport, baudrate: Number($("baud").value), terminal, debugLogging: false });
    const chipName = await loader.main();
    stage="connected";
    $("detectedChip").textContent = chipName + " · " + $("baud").value + " baud";
    $("chipDetails").hidden=true;
    log("Connected. Detected chip: " + chipName);
    connectionAlert("");
    // Use only chip-supported choices, defaulting to non-destructive 'keep' settings.
    const mode = $("flashMode"), freq = $("flashFreq"), size = $("flashSize");
    mode.innerHTML = ["keep","dio","qio","dout","qout"].map(v=>'<option value="'+v+'">'+v.toUpperCase()+'</option>').join("");
    const freqVals = Object.keys(loader.chip?.FLASH_FREQUENCY || {});
    freq.innerHTML = ["keep", ...freqVals].map(v=>'<option value="'+v+'">'+v+'</option>').join("");
    const sizeVals = Object.keys(loader.chip?.FLASH_SIZES || {});
    size.innerHTML = ["keep","detect", ...sizeVals].map(v=>'<option value="'+v+'">'+v+'</option>').join("");
  } catch (e) {
    const notice=connectionErrorMessage(e,stage);
    if(notice){
      log("Connection failed ("+stage+"): "+(e?.name||"Error")+" — "+(e?.message||e));
      connectionAlert(notice);
    }else{
      log("USB port selection canceled.");
    }
    try { if (transport) await transport.disconnect(); } catch (cleanupError) {
      log("Port cleanup warning: "+(cleanupError?.message||cleanupError));
    }
    loader=null; transport=null; port=null;
    $("detectedChip").textContent="Connect an ESP device via USB.";
  } finally { busy=false; sync(); }
});
$("disconnectBtn").addEventListener("click",async()=>{
  busy=true;sync();
  try {await disconnect(); connectionAlert(""); log("Disconnected.");}
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
  remove.addEventListener("click",()=>{if(!busy && $("fileRows").children.length>1){row.remove();updateRemoveButtons();}});
  row.append(address,file,remove);
  $("fileRows").append(row);
  updateRemoveButtons();
}
function updateRemoveButtons(){
  const rows=[...$("fileRows").children];
  rows.forEach((row,i)=>{
    const button=row.querySelector("button");
    // The first file is mandatory: no Remove button is needed.
    button.hidden=i===0;
  });
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

const mergeMaxSize=16*1024*1024;
async function proposeOffset(file, files){
  const filename=file.name;
  const name=filename.toLowerCase().replace(/[_\s-]+/g,"");
  // A classic ESP32 merged image includes bootloader and application at fixed offsets.
  // Inspect image bytes rather than trusting the filename alone.
  if(/merged/i.test(name) && /\.(bin|dgv)$/i.test(filename)){
    if(file.size>=0x10018){
      const header=new Uint8Array(await file.slice(0x1000,0x1001).arrayBuffer());
      const app=new Uint8Array(await file.slice(0x10000,0x10001).arrayBuffer());
      if(header[0]===0xe9 && app[0]===0xe9)return "0x0";
    }
    return null;
  }
  // Suggestions for separate images follow the classic ESP32 Arduino/ESP-IDF layout.
  if(/bootloader/.test(name))return "0x1000";
  if(/bootapp0/.test(name))return "0xe000";
  if(/partition/.test(name))return "0x8000";
  const names=files.map(f=>f.name.toLowerCase()).join(" ");
  if(/^(firmware|app|application)\.bin$/i.test(filename) &&
     /bootloader/.test(names) && /partition/.test(names))return "0x10000";
  return null;
}
$("autoOffsetsBtn").addEventListener("click",async()=>{
  if(busy)return;
  const rows=[...$("fileRows").children];
  const files=rows.map(row=>row.querySelector(".binfile").files[0]).filter(Boolean);
  if(files.length===0){
    showResult("advancedResult","warning","No files selected","Choose BIN files before requesting offset suggestions.");
    return;
  }
  if(loader && getChipFamily()!=="ESP32"){
    showResult("advancedResult","warning","Manual offsets required","Automatic suggestions are currently limited to classic ESP32. Enter and verify offsets manually for other chips.");
    return;
  }
  busy=true;sync();
  try{
    let changes=0;
    const uncertain=[];
    for(const row of rows){
      const file=row.querySelector(".binfile").files[0];
      if(!file)continue;
      const offset=await proposeOffset(file,files);
      if(offset!==null){row.querySelector(".fileoffset").value=offset;changes++;}
      else uncertain.push(file.name);
    }
    const note=changes+" offset(s) suggested. "+
      (uncertain.length?"Check offsets manually for: "+uncertain.join(", ")+". ":"")+
      "Verify all offsets against your firmware layout.";
    log(note);
    showResult("advancedResult",uncertain.length?"warning":"success",
      uncertain.length?"Offsets need verification":"Offsets suggested",note);
  }catch(e){
    const note="Could not inspect firmware files: "+(e.message||e);
    log(note);
    showResult("advancedResult","error","Offset check failed",note);
  }finally{busy=false;sync();}
});
$("mergeBtn").addEventListener("click",async()=>{
  if(busy)return;
  busy=true;sync();
  try{
    const meta=collectMetadata();
    if(meta.length<2)throw Error("Choose at least two BIN files to merge.");
    const end=Math.max(...meta.map(x=>x.address+x.file.size));
    if(end>mergeMaxSize)throw Error("Merged output exceeds the 16 MiB browser safety limit.");
    if(!confirm("Create a merged image with the selected offsets?\n\n"+
       meta.map(x=>x.file.name+" @ 0x"+x.address.toString(16)).join("\n")+
       "\n\nUnfilled regions will use 0xFF. Make sure the offset map matches your firmware build."))return;
    const merged=new Uint8Array(end);
    merged.fill(0xff);
    for(const entry of meta)merged.set(new Uint8Array(await entry.file.arrayBuffer()),entry.address);
    const blob=new Blob([merged],{type:"application/octet-stream"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="firmware-merged.bin";a.style.display="none";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    const msg="Merged "+meta.length+" files · "+end.toLocaleString()+" bytes. Check the output before flashing.";
    showResult("advancedResult","success","Merged BIN generated",msg);
    log(msg);
  }catch(e){
    log("Merge error: "+(e.message||e));
    showResult("advancedResult","error","Merge failed",e.message||String(e));
  }finally{busy=false;sync();}
});
$("readChipBtn").addEventListener("click",()=>action(async()=>{
  const details=[["Chip",loader.chip?.CHIP_NAME||$("detectedChip").textContent]];
  try {
    if(typeof loader.chip?.getChipDescription==="function")
      details[0][1]=await loader.chip.getChipDescription(loader);
  }catch(e){log("Chip description unavailable: "+(e.message||e));}
  try {
    if(typeof loader.chip?.readMac==="function")
      details.push(["Factory MAC",await loader.chip.readMac(loader)]);
    else details.push(["Factory MAC","Not supported by this chip"]);
  }catch(e){details.push(["Factory MAC","Unavailable"]);log("MAC read failed: "+(e.message||e));}
  try{
    const id=await loader.readFlashId();
    const n=Number(id)>>>0;
    details.push(["Flash ID","0x"+n.toString(16).padStart(6,"0")]);
    const size=loader.DETECTED_FLASH_SIZES?.[(n>>>16)&255];
    if(size)details.push(["Flash size",size]);
  }catch(e){details.push(["Flash ID","Unavailable"]);log("Flash ID read failed: "+(e.message||e));}
  try{
    if(typeof loader.chip?.getChipFeatures==="function"){
      const features=await loader.chip.getChipFeatures(loader);
      details.push(["Features",Array.isArray(features)?features.join(", "):String(features)]);
    }
  }catch(e){log("Chip feature read failed: "+(e.message||e));}
  const container=$("chipDetails");container.replaceChildren();
  for(const [name,value] of details){
    const item=document.createElement("div");
    const label=document.createElement("span");label.textContent=name;
    const val=document.createElement("strong");val.textContent=String(value);
    item.append(label,val);container.append(item);
  }
  container.hidden=false;
  const factory=details.find(([name])=>name==="Factory MAC")?.[1];
  log("Chip info: "+details.map(([k,v])=>k+" = "+v).join("; "));
}));


/* EspNowPeerProvisioner v1.2: GETPEER -> PEER <MAC> CH=n / PEER NONE,
   SETPEER <MAC> CH=n -> OK SAVED VER=n (and optional reboot).
   These are firmware-level settings, never hardware/eFuse MAC writes. */
function normalizePeerMac(value){
  if(typeof value!=="string")return "";
  const compact=value.trim().replace(/[:-]/g,"").toUpperCase();
  if(!/^[0-9A-F]{12}$/.test(compact))return "";
  return compact.match(/.{2}/g).join(":");
}
function peerLine(line){
  const value=line.trim();
  if(!value)return;
  log("Peer serial: "+value.slice(0,180));
  if(peerWait&&peerWait.matches(value)){
    const pending=peerWait;peerWait=null;
    clearTimeout(pending.timer);
    pending.resolve(value);
  }
}
function rejectPeerWait(reason){
  if(peerWait){
    const pending=peerWait;peerWait=null;
    clearTimeout(pending.timer);
    pending.reject(reason instanceof Error?reason:new Error(String(reason)));
  }
}
async function startPeerPump(){
  const serial=peerPort;
  let buffer="";
  try{
    peerReader=serial.readable.getReader();
    const decoder=new TextDecoder();
    while(peerConnected&&peerPort===serial){
      const {value,done}=await peerReader.read();
      if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      buffer=buffer.replace(/[^\x09\x0A\x0D\x20-\x7E]/g,"").slice(-2048);
      const lines=buffer.split(/\r\n|\n|\r/);
      buffer=lines.pop()||"";
      for(const line of lines)peerLine(line);
    }
  }catch(e){
    if(peerConnected&&peerPort===serial)log("Peer serial read stopped: "+(e.message||e));
  }finally{
    try{peerReader?.releaseLock()}catch{}
    peerReader=null;
    if(peerPort===serial && peerConnected){
      peerConnected=false;
      rejectPeerWait(Error("Firmware serial connection closed."));
      sync();
    }
  }
}
function waitPeerResponse(matches,ms=5000){
  if(peerWait)throw Error("Another peer command is in progress.");
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{
      peerWait=null;
      reject(Error("No response from the firmware. Check that it uses EspNowPeerProvisioner and is running at 115200 baud."));
    },ms);
    peerWait={matches,resolve,reject,timer};
  });
}
async function sendPeerCommand(command,accept){
  if(!peerConnected||!peerPort||!peerWriter)throw Error("Connect USB in firmware mode first.");
  const waiting=waitPeerResponse(line=>accept.test(line)||/^UNKNOWN CMD\b|^ERR\b/i.test(line));
  try{
    await peerWriter.write(new TextEncoder().encode(command+"\n"));
  }catch(e){
    rejectPeerWait(e);
    waiting.catch(()=>{});
    throw e;
  }
  const response=await waiting;
  if(/^UNKNOWN CMD\b|^ERR\b/i.test(response))throw Error("Device rejected command: "+response);
  return response;
}
async function closePeerPort(){
  const serial=peerPort;
  peerConnected=false;
  rejectPeerWait(Error("USB disconnected."));
  if(peerReader){try{await peerReader.cancel()}catch{}}
  if(peerPump){try{await peerPump}catch{}}
  if(peerWriter){try{peerWriter.releaseLock()}catch{}}
  peerWriter=null;peerReader=null;peerPump=null;peerPort=null;
  if(serial){try{await serial.close()}catch(e){log("Firmware serial close: "+(e.message||e))}}
  sync();
}
async function togglePeerConnection(){
  if(busy||peerBusy)return;
  busy=true;sync();connectionAlert("");
  let candidate=null;
  try{
    if(peerConnected){
      await closePeerPort();
      log("Firmware serial port disconnected.");
      return;
    }
    if(loader||transport)throw Error("Disconnect the bootloader flasher in Advanced before using the firmware protocol.");
    candidate=await navigator.serial.requestPort();
    await candidate.open({baudRate:115200});
    peerPort=candidate;
    peerWriter=candidate.writable.getWriter();
    peerConnected=true;
    peerPump=startPeerPump();
    log("Firmware serial connected at 115200 baud (GETPEER / SETPEER).");
    showResult("peerResult","success","Firmware USB connected","Use Read or Write to access the saved ESP-NOW peer.");
  }catch(e){
    if(e?.name==="NotFoundError")log("Firmware USB selection canceled.");
    else{
      const message=connectionErrorMessage(e,"opening");
      connectionAlert(message);
      log("Firmware serial connection failed: "+(e.message||e));
      showResult("peerResult","error","USB connection failed",message);
    }
    if(candidate&&candidate!==peerPort){try{await candidate.close()}catch{}}
  }finally{busy=false;sync();}
}
$("peerTools").addEventListener("toggle",()=>sync());
$("peerMacInput").addEventListener("input",()=>clearResult("peerResult"));
$("readPeerBtn").addEventListener("click",async()=>{
  if(!peerConnected||busy||peerBusy)return;
  peerBusy=true;sync();clearResult("peerResult");
  try{
    const line=await sendPeerCommand("GETPEER",/^PEER(?: NONE| [0-9A-Fa-f:-]{12,17}\b)/);
    if(/^PEER NONE\b/i.test(line)){
      $("peerMacInput").value="";
      showResult("peerResult","warning","No peer configured","The device has no saved peer address.");
    }else{
      const parsed=line.match(/^PEER\s+([0-9A-Fa-f:-]{12,17})\s+CH=(\d+)\b/i);
      if(!parsed)throw Error("Unexpected GETPEER reply: "+line);
      const mac=normalizePeerMac(parsed[1]);
      if(!mac)throw Error("Invalid MAC returned by firmware.");
      $("peerMacInput").value=mac;
      const ch=Number(parsed[2]);
      if(ch>=1&&ch<=13)$("peerChannel").value=String(ch);
      showResult("peerResult","success","Peer read",mac+" · Channel "+ch);
    }
  }catch(e){
    showResult("peerResult","error","Read failed",e.message||String(e));
  }finally{peerBusy=false;sync();}
});
$("writePeerBtn").addEventListener("click",async()=>{
  if(!peerConnected||busy||peerBusy)return;
  const mac=normalizePeerMac($("peerMacInput").value);
  const channel=Number($("peerChannel").value);
  if(!mac||!Number.isInteger(channel)||channel<1||channel>13){
    showResult("peerResult","error","Invalid data","Enter a valid MAC address and channel (1–13).");
    return;
  }
  if(!confirm("Save ESP-NOW peer "+mac+" on channel "+channel+"?\nThe firmware may restart after saving."))return;
  peerBusy=true;sync();clearResult("peerResult");
  try{
    const response=await sendPeerCommand("SETPEER "+mac+" CH="+channel,/^OK SAVED VER=\d+\b/i);
    showResult("peerResult","success","Peer saved",response+" · "+mac+" · Channel "+channel);
  }catch(e){showResult("peerResult","error","Write not confirmed",e.message||String(e))}
  finally{peerBusy=false;sync();}
});
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
      release.version,release.version));
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
$("officialConnectBtn").addEventListener("click",()=>{
  if(peerConnected || $("peerTools").open) return togglePeerConnection();
  if(!loader) $("connectBtn").click();
});
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
  showResult("officialResult","success","Firmware written",
    selectedProject.name+" · FW "+selectedRelease.version+
    (selectedRelease.hubVersion?" · Hub "+selectedRelease.hubVersion:"")+
    " · "+(elapsed/1000).toFixed(1)+" s. "+resetMessage+" Verify device startup.");
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
   if(peerPort && (event.port===peerPort || event.target===peerPort)){
     closePeerPort().catch(e=>log("Peer USB disconnect: "+(e.message||e)));
   }
   if(port && (event.port===port || event.target===port))lostConnection("USB device physically disconnected.");
 });
}
