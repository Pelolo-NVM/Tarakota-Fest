(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', async function () {
    var UI = global.TarakotaUI;
    var API = global.TarakotaAPI;

    var sessionRes = await API.auth.getSession();
    if (sessionRes.ok && sessionRes.data) {
      global.location.replace('dashboard.html');
      return;
    }

    var form = document.getElementById('admin-login-form');
    var errorBox = document.getElementById('admin-login-error');
    var submitBtn = document.getElementById('admin-login-btn');

    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      UI.clearFieldErrors(form);
      if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = '';
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memeriksa Kredensial...';
      }

      var fd = new FormData(form);
      var res = await API.auth.login(fd.get('email'), fd.get('password'));

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Masuk ke Dashboard Admin';
      }

      if (!res.ok) {
        if (errorBox) {
          errorBox.textContent = res.message || 'Gagal masuk ke portal admin.';
          errorBox.hidden = false;
        }
        return;
      }

      global.location.href = 'dashboard.html';
    });
  });
})(window);

