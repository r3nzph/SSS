import Auth from './auth.js'; import UI from './ui.js'; import Audit from './audit.js'; import StorageService from './storage.js';
const Backup = {
  renderBackupInfo(){const el=document.getElementById('backupInfo');if(!el)return;try{const data=StorageService.readRaw();const size=new Blob([JSON.stringify(data)]).size;el.innerHTML=`<p style="color:var(--text-muted);padding:8px 0;">Data size: ${(size/1024).toFixed(1)} KB | ${data ? Object.keys(data).length : 0} collections</p>`}catch(e){el.innerHTML='<p>Backup info unavailable</p>'}},
  async exportData(){const r=StorageService.exportData();if(!r.success){UI.toast('Export failed','error');return}const blob=new Blob([r.json],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`pos-backup-${Date.now()}.json`;a.click();UI.toast('Backup exported!','success')},
  async importData(){const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async(e)=>{const file=e.target.files[0];if(!file)return;try{const text=await file.text();const r=StorageService.importData(text);if(r.success){Auth.setDb(StorageService.readRaw());UI.toast('Data imported!','success');if(window.location)window.location.reload()}else{UI.toast(r.error||'Import failed','error')}}catch(err){UI.toast('Invalid file','error')}};input.click()}
};
export default Backup;
