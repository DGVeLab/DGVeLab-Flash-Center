// DGVeLab Flash Center — experimental hardware flasher, esptool-js v0.7.0
import { ESPLoader, Transport } from "https://unpkg.com/esptool-js@0.7.0/bundle.js";
const $ = id => document.getElementById(id);
let transport = null, loader = null, port = null, busy = false, rowId = 0;
const logEl = $("activityLog");
function log(message) {
  const time = new Date().toLocaleTimeString();
  logEl.textContent += "\n[" + time + "] " + String(message);
  if (logEl.textContent.length > 70000) logEl.textContent = logEl.textContent.slice(-60000);
  logEl.scrollTop = logEl.scrollHeight;
}
function sync() {
  const connected = !!loader;
  $("connectBtn").disabled = busy || connected || !("serial" in navigator);
  $("disconnectBtn").disabled = busy || !transport;
  $("flashBtn").disabled = busy || !connected;
  $("eraseBtn").disabled = busy || !connected;
  $("resetBtn").disabled = busy || !connected;
  $("addFileBtn").disabled = busy;
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
    $("detectedChip").textContent = "Connect an ESP device via USB.";
    sync();
  }
}
$("connectBtn").addEventListener("click", async () => {
  if (!("serial" in navigator)) return log("Web Serial unavailable: use Chrome or Edge desktop over HTTPS.");
  busy = true; sync();
  try {
    log("Select a serial port in the browser dialog.");
    port = await navigator.serial.requestPort();
    transport = new Transport(port, true);
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
  try{await fn();}catch(e){log("ERROR: "+(e.message||e));}
  finally{busy=false;sync();}
}
$("flashBtn").addEventListener("click",()=>action(async()=>{
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
      if(!loader.chip?.CHIP_NAME?.includes("ESP32") && !String($("detectedChip").textContent).includes("ESP32")){
        throw Error("DGV firmware requires an ESP32-family chip. Verify compatibility before flashing.");
      }
      log("Merged DGVeLab firmware detected: bootloader 0x1000; partitions 0x8000; application 0x10000.");
    }
    fileArray.push({address:item.address,data});
  }
  $("flashProgress").value=0;$("progressLabel").textContent="0%";
  log("Writing "+fileArray.length+" firmware image(s)...");
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
  log("Flash operation completed. Reset the device to boot the firmware.");
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
