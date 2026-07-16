import Auth from './auth.js'; import UI from './ui.js'; import Audit from './audit.js'; import { escapeHtml, formatDate } from './utils.js'; import StorageService from './storage.js';
const UserManager = { _filters:{search:'',role:'',status:''}, _page:1, _pageSize:20,
  renderAll(){this._renderCards();this._renderRoles()},
  _renderCards(){const el=document.getElementById('umCardsContainer');if(!el)return;const d=Auth.state.db;if(!d||!d.users){el.innerHTML='<p class="um-empty">No users.</p>';return}let users=[...d.users];if(this._filters.search){const q=this._filters.search.toLowerCase();users=users.filter(u=>(u.fullName||u.username||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q))}if(this._filters.role)users=users.filter(u=>u.role===this._filters.role);if(this._filters.status)users=users.filter(u=>u.status===this._filters.status);const total=users.length,pages=Math.ceil(total/this._pageSize)||1;if(this._page>pages)this._page=pages;const start=(this._page-1)*this._pageSize;const page=users.slice(start,start+this._pageSize);if(page.length===0){el.innerHTML='<p class="um-empty">No users match.</p>';return}el.innerHTML=page.map(u=>`<div class="um-user-card ${u.status==='disabled'?'um-card-disabled':''} ${u.status==='archived'?'um-card-archived':''}"><div class="um-card-header"><div class="um-avatar"><span class="um-avatar-initials">${(u.fullName||u.username||'?').charAt(0)}</span></div><div class="um-card-info"><div class="um-card-name">${escapeHtml(u.fullName||u.username)}</div><div class="um-card-username">@${escapeHtml(u.username)}</div></div></div><div class="um-card-body"><div class="um-card-row"><span class="um-card-label">Role</span><span>${escapeHtml(u.role)}</span></div><div class="um-card-row"><span class="um-card-label">Status</span><span class="um-status-${u.status||'active'}">${u.status||'active'}</span></div></div></div>`).join('');this._renderPagination(total,pages)},
  _renderPagination(total,pages){const el=document.getElementById('umPagination');if(!el)return;if(pages<=1){el.innerHTML='';return}let h='';const s=this._page;for(let i=1;i<=pages;i++)h+=`<button class="btn btn-sm ${i===s?'btn-primary':'btn-ghost'}" onclick="UserManager.setPage(${i})">${i}</button>`;el.innerHTML=h},
  _renderRoles(){/* stub - would render role filter options */},
  setFilter(type,value){if(type==='search')this._filters.search=value;else if(type==='role')this._filters.role=value;else if(type==='status')this._filters.status=value;this._page=1;this._renderCards()},
  setPage(p){this._page=p;this._renderCards()},
  showAddModal(){UI.toast('Add user stub','info')},
  closeModal(){},
  saveUser(){UI.toast('Save user stub','info')},
  changeOwnPassword(){UI.toast('Change password stub','info')},
  closePermsModal(){},
  closeProfileModal(){}
};
export default UserManager;
