import Auth from './auth.js'; import UI from './ui.js'; import Audit from './audit.js'; import { escapeHtml, formatDate, getInputValue, clearInput } from './utils.js'; import StorageService from './storage.js';
const Accounts = { _editingUserId:null,
  renderUsers(){const tbody=document.getElementById('usersTable');if(!tbody)return;const users=StorageService.load('users');if(!users){tbody.innerHTML='<tr><td colspan="5">No users.</td></tr>';return}tbody.innerHTML=users.map(u=>`<tr><td>${escapeHtml(u.id)}</td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.role)}</td><td>${formatDate(u.createdAt)}</td><td><button class="btn-icon btn-sm" onclick="editUser('${u.id}')">✎</button><button class="btn-icon btn-sm" onclick="deleteUser('${u.id}')" style="color:var(--danger);">🗑</button></td></tr>`).join('')},
  async saveUser(){const username=getInputValue('uName');const password=getInputValue('uPassword');const role=document.getElementById('uRole')?.value||'cashier';if(!username){UI.toast('Username required','error');return}if(this._editingUserId){// update existing user
    const user=StorageService.load('users',this._editingUserId);if(!user){UI.toast('User not found','error');return}
    const updates={username,role};if(password){updates.password=await StorageService.hashPassword(password)}
    const r=StorageService.update('users',this._editingUserId,updates);if(r.success){UI.toast('User updated!','success')}else{UI.toast(r.error||'Update failed','error')}
  }else{// add new user
    if(!password){UI.toast('Password required for new users','error');return}
    if(StorageService.load('users').find(u=>u.username===username)){UI.toast('Username already exists','error');return}
    const newUser={id:'u'+Date.now().toString(36),username,password:await StorageService.hashPassword(password),role,createdAt:new Date().toISOString(),status:'active',fullName:'',email:'',contactNumber:'',loginAttempts:0,lockedUntil:null,forcePasswordChange:false,profilePicture:'',permissions:{}};
    const r=StorageService.save('users',newUser);if(r.success){UI.toast('User added!','success')}else{UI.toast(r.error||'Add failed','error')}
  }Auth.setDb(StorageService.readRaw());this.cancelEdit();this.renderUsers()},
  editUser(id){this._editingUserId=id;const u=StorageService.load('users',id);if(!u)return;document.getElementById('uName').value=u.username;document.getElementById('uPassword').value='';document.getElementById('uRole').value=u.role;document.getElementById('userPasswordHint').classList.remove('hidden');const btn=document.querySelector('.btn-save-user');if(btn)btn.textContent='Update User';document.getElementById('cancelUserEditBtn').classList.remove('hidden')},
  cancelEdit(){this._editingUserId=null;clearInput('uName');clearInput('uPassword');document.getElementById('userPasswordHint').classList.add('hidden');const btn=document.querySelector('.btn-save-user');if(btn)btn.textContent='Add User';document.getElementById('cancelUserEditBtn').classList.add('hidden')},
  async deleteUser(id){const ok=await UI.confirm('Delete this user?');if(!ok)return;const user=StorageService.load('users',id);if(!user||user.username===Auth.state.user){UI.toast('Cannot delete your own account','error');return}const r=StorageService.delete('users',id);if(r.success){Auth.setDb(StorageService.readRaw());this.renderUsers();UI.toast('User deleted.','info')}else{UI.toast(r.error||'Delete failed','error')}},
  async resetUserPassword(id){const pwd=await UI.prompt('Enter new password:','','Reset Password');if(!pwd||pwd.length<4){if(pwd!==null)UI.toast('Password must be 4+ chars','error');return}const hash=await StorageService.hashPassword(pwd);StorageService.update('users',id,{password:hash});UI.toast('Password reset!','success')}
};
export default Accounts;
