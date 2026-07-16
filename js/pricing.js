import Auth from './auth.js'; import UI from './ui.js'; import StorageService from './storage.js';
const Pricing = {
  renderPriceAlerts(){const el=document.getElementById('priceAlerts');if(!el)return;el.innerHTML=''},
  renderPriceHistory(){const tbody=document.getElementById('priceHistoryBody');if(!tbody)return;const d=Auth.state.db;if(!d||!d.priceHistory){tbody.innerHTML='<tr><td colspan="6">No price changes.</td></tr>';return}const items=[...d.priceHistory].reverse().slice(0,50);tbody.innerHTML=items.map(p=>`<tr><td>${p.date||''}</td><td>${p.productName||''}</td><td>${p.oldPrice||''}</td><td>${p.newPrice||''}</td><td>${p.change||''}</td><td>${p.user||''}</td></tr>`).join('')},
  checkPriceAlerts(){},
  attachPricePopovers(){},
  updateSinglePrice(id){UI.toast('Price update stub','info')},
  bulkPriceUpdate(){UI.toast('Bulk price update stub','info')}
};
export default Pricing;
