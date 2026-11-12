(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var UI = global.TarakotaUI;
    var API = global.TarakotaAPI;
    UI.mountPublicChrome('daftar-band');

    var form = document.getElementById('band-register-form');
    var alertBox = document.getElementById('band-form-feedback');
    var submitBtn = document.getElementById('band-submit-btn');

    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      UI.clearFieldErrors(form);
      if (alertBox) {
        alertBox.hidden = true;
        alertBox.innerHTML = '';
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Mengirim Profil Band...';
      }

      var fd = new FormData(form);
      var payload = {
        bandName: String(fd.get('bandName') || ''),
        genre: String(fd.get('genre') || ''),
        originCity: String(fd.get('originCity') || ''),
        contact: String(fd.get('contact') || ''),
        demoUrl: String(fd.get('demoUrl') || ''),
        bio: String(fd.get('bio') || '')
      };

      var res = await API.bands.create(payload);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Daftarkan Band untuk Audisi';
      }

      if (!res.ok) {
        UI.applyFieldErrors(form, res.errors);
        if (alertBox) {
          var items = Object.keys(res.errors || {}).map(function (k) {
            return '<li>' + UI.escapeHtml(res.errors[k]) + '</li>';
          }).join('');
          alertBox.className = 'alert-box alert-box--error';
          alertBox.innerHTML =
            '<strong>Pendaftaran Ditolak (HTTP ' + res.status + '):</strong> ' + UI.escapeHtml(res.message) +
            (items ? '<ul>' + items + '</ul>' : '');
          alertBox.hidden = false;
        }
        UI.announce('Formulir pendaftaran band memiliki kesalahan validasi.');
        return;
      }

      form.reset();
      if (alertBox) {
        alertBox.className = 'alert-box alert-box--success';
        alertBox.innerHTML =
          '<strong>Audisi Terkirim (HTTP 201)</strong>' +
          '<p style="margin:0.4rem 0 0;">Band <strong>' + UI.escapeHtml(res.data.bandName) + '</strong> (<span class="mono">' + UI.escapeHtml(res.data.id) + '</span>) telah masuk ke antrean kurasi Admin Portal.</p>';
        alertBox.hidden = false;
        alertBox.focus();
      }
      UI.announce('Pendaftaran band berhasil dikirim.');
    });
  });
})(window);

