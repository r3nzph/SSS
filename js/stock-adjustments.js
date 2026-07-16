import Auth from './auth.js'; import UI from './ui.js'; import Audit from './audit.js'; import { escapeHtml, formatCurrency, formatDate } from './utils.js'; import StorageService from './storage.js';
const StockAdjustments = { _filters:{search:'',type:''}, _sort:{field:'createdAt',dir:'desc'}, _page:1, _pageSize:15,
  renderAdjustmentHistory(){const tbody=document.getElementById('adjHistoryBody');if(!tbody)return;const d=Auth.state.db;if(!d||!d.stockAdjustments){tbody.innerHTML='<tr><td colspan="9">No adjustments.</td></tr>';return}let items=[...d.stockAdjustments];if(this._filters.search){const q=this._filters.search.toLowerCase();items=items.filter(x=>(x.productName||'').toLowerCase().includes(q))}if(this._filters.type)items=items.filter(x=>x.type===this._filters.type);items=items.reverse().slice(0,100);tbody.innerHTML=items.map(a=>`<tr><td>${escapeHtml(a.adjNumber||a.id||'')}</td><td>${escapeHtml(a.productName||'')}</td><td>${a.oldStock}</td><td>${a.newStock}</td><td class="${(a.difference||0)>=0?'adj-positive':'adj-negative'}">${a.difference>=0?'+':''}${a.difference}</td><td>${escapeHtml(a.type||'')}</td><td>${escapeHtml((a.reason||'').slice(0,30))}</td><td>${escapeHtml(a.user||'')}</td><td>${formatDate(a.createdAt)}</td></tr>`).join('')},
  setFilter(type,value){if(type==='search')this._filters.search=value;else if(type==='type')this._filters.type=value;this.renderAdjustmentHistory()},
  setSort(field){this._sort.field=field;this._sort.dir=this._sort.dir==='asc'?'desc':'asc';this.renderAdjustmentHistory()},
  showAdjustModal(){UI.toast('Show adjust modal stub','info')},
  closeModal(){},
  confirmAdjustment(){},
  _quickProductSearch(){},
  _onProductSelect(){},
  _previewAdjustment(){},
  exportCSV(){UI.toast('Export dummy','info')},
  closeTimelineModal(){}
};
export default StockAdjustments;
