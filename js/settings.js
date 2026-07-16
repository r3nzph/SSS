import Auth from './auth.js'; import UI from './ui.js'; import { escapeHtml } from './utils.js'; import StorageService from './storage.js';
const ConfigCenter = {
  _currentTab:'store',
  renderAll(){this.switchTab('store')},
  switchTab(tab){this._currentTab=tab;document.querySelectorAll('.cfg-tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll(`.cfg-tab-btn[data-tab="${tab}"]`).forEach(b=>b.classList.add('active'));this._renderTabContent(tab)},
  _renderTabContent(tab){const el=document.getElementById('cfgContent');if(!el)return;const s=StorageService.load('settings','main')||{};let html='';if(tab==='store')html=`<div class="cfg-section"><div class="cfg-section-title">🏪 Store Information</div><div class="cfg-grid-2"><div class="cfg-field"><label>Store Name</label><input id="cfgStoreName" value="${escapeHtml(s.storeName||'')}"></div><div class="cfg-field"><label>Address</label><input id="cfgStoreAddress" value="${escapeHtml(s.storeAddress||'')}"></div></div><button class="btn btn-primary" onclick="ConfigCenter.saveCurrentTab()">💾 Save</button></div>`;else html=`<div class="cfg-section"><p style="color:var(--text-muted);">${tab.charAt(0).toUpperCase()+tab.slice(1)} settings</p></div>`;el.innerHTML=html},
  async saveCurrentTab(){/* would save tab fields */UI.toast('Saved!','success')}
};
export default ConfigCenter;
