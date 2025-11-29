let token = null;

async function api(path, method='GET', body) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const r = await api('/login', 'POST', { username, password });
  if (r.token) {
    token = r.token;
    showUser(r.user);
  } else alert(r.error || 'Error');
});

document.getElementById('registerBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const r = await api('/register', 'POST', { username, password });
  if (r.token) { token = r.token; showUser(r.user); } else alert(r.error || 'Error');
});

async function refreshUsers() {
  const r = await api('/users');
  if (r.users) {
    const ul = document.getElementById('usersList'); ul.innerHTML='';
    r.users.forEach(u => { const li = document.createElement('li'); li.textContent = `${u.username} — ${u.balance}`; ul.appendChild(li); });
  }
}

async function showUser(user) {
  document.getElementById('auth').style.display='none';
  document.getElementById('userPanel').style.display='block';
  document.getElementById('meName').textContent = user.username;
  document.getElementById('meBalance').textContent = user.balance;
  if (user.role === 'admin') document.getElementById('adminPanel').style.display='block';
  await refreshUsers();
  if (user.role === 'admin') {
    const r = await api('/admin/users');
    const ul = document.getElementById('allUsers'); ul.innerHTML='';
    r.users.forEach(u => { const li = document.createElement('li'); li.textContent = `${u.username} — ${u.balance} (${u.role})`; ul.appendChild(li); });
  }
}

document.getElementById('sendBtn').addEventListener('click', async () => {
  const to = document.getElementById('toUser').value;
  const amount = document.getElementById('amount').value;
  const r = await api('/transfer', 'POST', { toUsername: to, amount });
  if (r.success) { alert('Wysłano'); const me = await api('/me'); document.getElementById('meBalance').textContent = me.user.balance; refreshUsers(); }
  else alert(r.error || 'Error');
});

document.getElementById('adjBtn').addEventListener('click', async () => {
  const username = document.getElementById('adjUser').value;
  const newBalance = document.getElementById('adjBalance').value;
  const r = await api('/admin/adjust', 'POST', { username, newBalance });
  if (r.success) { alert('Zmieniono'); const ru = await api('/admin/users'); const ul = document.getElementById('allUsers'); ul.innerHTML=''; ru.users.forEach(u => { const li = document.createElement('li'); li.textContent = `${u.username} — ${u.balance} (${u.role})`; ul.appendChild(li); }); }
  else alert(r.error || 'Error');
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  token = null;
  document.getElementById('auth').style.display='block';
  document.getElementById('userPanel').style.display='none';
});
