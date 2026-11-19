(function (global) {
  'use strict';

  var IN_ADMIN_DIR = /\/admin(?:\/|$)/.test(global.location.pathname || '');

  function resolveAssetPath(path) {
    if (!path) return '';
    if (path.indexOf('data:') === 0 || path.indexOf('http://') === 0 || path.indexOf('https://') === 0) {
      return path;
    }
    var clean = path.replace(/^\//, '');
    if (IN_ADMIN_DIR && clean.indexOf('../') !== 0) {
      return '../' + clean;
    }
    return clean;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatRupiah(amount) {
    var num = Number(amount) || 0;
    return 'Rp ' + num.toLocaleString('id-ID');
  }

  function formatDateTime(iso) {
    try {
      var normalized = String(iso || '').replace(' ', 'T');
      var d = new Date(normalized);
      if (isNaN(d.getTime())) return String(iso || '');
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) + ' ' + d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_err) {
      return String(iso || '');
    }
  }

  function renderStatusBadge(status) {
    var key = String(status || '').toLowerCase();
    var map = {
      paid: { cls: 'status-badge--mint', label: 'Paid (Terverifikasi)' },
      active: { cls: 'status-badge--mint', label: 'Active' },
      accepted: { cls: 'status-badge--mint', label: 'Accepted (Lineup)' },
      approved: { cls: 'status-badge--mint', label: 'Accepted (Lineup)' },
      reviewed: { cls: 'status-badge--lilac', label: 'Reviewed' },
      completed: { cls: 'status-badge--lilac', label: 'Completed' },
      pending: { cls: 'status-badge--amber', label: 'Pending' },
      cancelled: { cls: 'status-badge--red', label: 'Cancelled' },
      rejected: { cls: 'status-badge--red', label: 'Rejected' }
    };
    var info = map[key] || { cls: 'status-badge--lilac', label: status };
    return '<span class="status-badge ' + info.cls + '">' + escapeHtml(info.label) + '</span>';
  }

  function announce(message) {
    var region = document.getElementById('live-announcer');
    if (!region) {
      region = document.createElement('div');
      region.id = 'live-announcer';
      region.className = 'sr-only';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      document.body.appendChild(region);
    }
    region.textContent = '';
    global.requestAnimationFrame(function () {
      region.textContent = message;
    });
  }

  function ensureAuthModal() {
    var existing = document.getElementById('tarakota-auth-modal-backdrop');
    if (existing) return existing;

    var backdrop = document.createElement('div');
    backdrop.id = 'tarakota-auth-modal-backdrop';
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'auth-modal-title');
    backdrop.hidden = true;

    backdrop.innerHTML =
      '<div class="modal-card" style="max-width:440px;">' +
        '<div class="modal-header">' +
          '<div>' +
            '<span class="status-badge status-badge--mint">Akun Pengunjung</span>' +
            '<h2 id="auth-modal-title" style="margin-top:0.4rem; margin-bottom:0.2rem;">Akses Tiket Saya</h2>' +
            '<p style="margin:0; font-size:var(--text-xs); color:var(--color-ink-muted);">Masuk atau buat akun untuk menyimpan &amp; memantau e-ticket Anda.</p>' +
          '</div>' +
          '<button type="button" class="modal-close-btn" id="auth-modal-close" aria-label="Tutup modal">&times;</button>' +
        '</div>' +
        '<div style="display:flex; gap:0.5rem; margin-bottom:1rem; border-bottom:1.5px solid var(--color-border-ink); padding-bottom:0.5rem;">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="auth-tab-login" style="font-weight:700; background:var(--color-accent-mint);">Masuk</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="auth-tab-register" style="font-weight:700;">Daftar Akun</button>' +
        '</div>' +
        '<div id="auth-api-error" class="alert-box alert-box--error" style="margin-bottom:1rem;" hidden></div>' +
        '<form id="auth-login-form" novalidate>' +
          '<div class="field-group">' +
            '<label class="field-label" for="auth-login-email">Email</label>' +
            '<input class="field-input" id="auth-login-email" name="email" type="email" required placeholder="raka.pratama@example.com" autocomplete="email">' +
          '</div>' +
          '<div class="field-group">' +
            '<label class="field-label" for="auth-login-pass">Kata Sandi</label>' +
            '<input class="field-input" id="auth-login-pass" name="password" type="password" required placeholder="tarakota2026" autocomplete="current-password">' +
          '</div>' +
          '<button type="submit" class="btn btn-primary" id="auth-login-btn" style="width:100%; margin-bottom:0.75rem;">Masuk ke Akun</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="auth-quick-demo-btn" style="width:100%; font-size:var(--text-xs); border:1.5px dashed var(--color-border-ink);">' +
            '⚡ Masuk Cepat Demo (Raka Pratama)' +
          '</button>' +
        '</form>' +
        '<form id="auth-register-form" novalidate hidden>' +
          '<div class="field-group">' +
            '<label class="field-label" for="auth-reg-name">Nama Lengkap</label>' +
            '<input class="field-input" id="auth-reg-name" name="nama" type="text" required placeholder="Febryano Putra" autocomplete="name">' +
          '</div>' +
          '<div class="field-group">' +
            '<label class="field-label" for="auth-reg-email">Alamat Email</label>' +
            '<input class="field-input" id="auth-reg-email" name="email" type="email" required placeholder="nama@domain.com" autocomplete="email">' +
          '</div>' +
          '<div class="field-group">' +
            '<label class="field-label" for="auth-reg-pass">Kata Sandi (Minimal 6 karakter)</label>' +
            '<input class="field-input" id="auth-reg-pass" name="password" type="password" required placeholder="Minimal 6 karakter" autocomplete="new-password">' +
          '</div>' +
          '<button type="submit" class="btn btn-primary" id="auth-reg-btn" style="width:100%;">Daftar &amp; Masuk</button>' +
        '</form>' +
      '</div>';

    document.body.appendChild(backdrop);

    var closeBtn = backdrop.querySelector('#auth-modal-close');
    var tabLogin = backdrop.querySelector('#auth-tab-login');
    var tabRegister = backdrop.querySelector('#auth-tab-register');
    var loginForm = backdrop.querySelector('#auth-login-form');
    var regForm = backdrop.querySelector('#auth-register-form');
    var errorBox = backdrop.querySelector('#auth-api-error');
    var demoBtn = backdrop.querySelector('#auth-quick-demo-btn');

    function hideModal() {
      backdrop.hidden = true;
      if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = '';
      }
    }

    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) hideModal();
    });

    if (tabLogin && tabRegister && loginForm && regForm) {
      tabLogin.addEventListener('click', function () {
        tabLogin.style.background = 'var(--color-accent-mint)';
        tabRegister.style.background = 'transparent';
        loginForm.hidden = false;
        regForm.hidden = true;
        if (errorBox) errorBox.hidden = true;
      });
      tabRegister.addEventListener('click', function () {
        tabRegister.style.background = 'var(--color-accent-mint)';
        tabLogin.style.background = 'transparent';
        loginForm.hidden = true;
        regForm.hidden = false;
        if (errorBox) errorBox.hidden = true;
      });
    }

    if (demoBtn) {
      demoBtn.addEventListener('click', function () {
        var emailInput = backdrop.querySelector('#auth-login-email');
        var passInput = backdrop.querySelector('#auth-login-pass');
        if (emailInput) emailInput.value = 'raka.pratama@example.com';
        if (passInput) passInput.value = 'tarakota2026';
        if (loginForm) loginForm.dispatchEvent(new Event('submit'));
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = (loginForm.querySelector('[name="email"]').value || '').trim();
        var pass = (loginForm.querySelector('[name="password"]').value || '').trim();
        if (errorBox) errorBox.hidden = true;

        var res = await global.TarakotaAPI.auth.userLogin(email, pass);
        if (!res.ok) {
          if (errorBox) {
            errorBox.textContent = res.message || 'Login gagal. Periksa email dan kata sandi Anda.';
            errorBox.hidden = false;
          }
          return;
        }

        hideModal();
        announce('Berhasil masuk sebagai ' + (res.data ? res.data.nama : 'User'));
        global.dispatchEvent(new CustomEvent('tarakota_auth_change', { detail: res.data }));
      });
    }

    if (regForm) {
      regForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var nama = (regForm.querySelector('[name="nama"]').value || '').trim();
        var email = (regForm.querySelector('[name="email"]').value || '').trim();
        var pass = (regForm.querySelector('[name="password"]').value || '').trim();
        if (errorBox) errorBox.hidden = true;

        var res = await global.TarakotaAPI.auth.register(nama, email, pass);
        if (!res.ok) {
          if (errorBox) {
            var msg = res.message;
            if (res.errors) {
              var errs = Object.values(res.errors).join(', ');
              if (errs) msg += ' (' + errs + ')';
            }
            errorBox.textContent = msg || 'Registrasi gagal.';
            errorBox.hidden = false;
          }
          return;
        }

        hideModal();
        announce('Pendaftaran berhasil! Selamat datang, ' + (res.data ? res.data.nama : ''));
        global.dispatchEvent(new CustomEvent('tarakota_auth_change', { detail: res.data }));
      });
    }

    return backdrop;
  }

  function openAuthModal() {
    var modal = ensureAuthModal();
    if (modal) {
      modal.hidden = false;
      var firstInput = modal.querySelector('input:not([hidden])');
      if (firstInput) firstInput.focus();
    }
  }

  function mountPublicChrome(activePage) {
    var header = document.getElementById('site-header');
    var footer = document.getElementById('site-footer');

    var navItems = [
      { id: 'home', label: 'Beranda', href: 'index.html' },
      { id: 'jadwal', label: 'Jadwal', href: 'jadwal.html' },
      { id: 'pemesanan', label: 'Pemesanan', href: 'pemesanan.html' },
      { id: 'tiket-saya', label: 'Tiket Saya', href: 'tiket-saya.html' },
      { id: 'daftar-band', label: 'Daftar Band', href: 'daftar-band.html' }
    ];

    if (header) {
      var linksHtml = navItems.map(function (item) {
        var current = item.id === activePage ? ' aria-current="page"' : '';
        return '<li><a class="nav-link" href="' + item.href + '"' + current + '>' + item.label + '</a></li>';
      }).join('');

      header.innerHTML =
        '<div class="container">' +
          '<div class="navbar-glass-pill">' +
            '<div class="navbar-inner">' +
              '<a class="brand-link" href="index.html" aria-label="Tarakota Fest Beranda">' +
                '<img class="brand-logo" src="assets/images/tarakota-logo.svg" alt="Tarakota Fest" width="108" height="65">' +
              '</a>' +
              '<nav aria-label="Navigasi Utama">' +
                '<ul class="nav-links">' + linksHtml + '</ul>' +
              '</nav>' +
              '<div class="nav-actions" id="navbar-actions-container">' +
                '<a class="btn btn-primary nav-desktop-cta" href="pemesanan.html">Beli Tiket</a>' +
                '<button type="button" class="btn btn-ghost menu-toggle-btn" id="mobile-menu-toggle" aria-expanded="false" aria-controls="mobile-nav-drawer">Menu</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="mobile-drawer" id="mobile-nav-drawer" hidden>' +
          '<nav aria-label="Navigasi Mobile">' +
            '<ul class="mobile-drawer-list">' +
              linksHtml +
              '<li id="mobile-auth-actions">' +
                '<a class="btn btn-primary" href="pemesanan.html">Beli Tiket</a>' +
              '</li>' +
            '</ul>' +
          '</nav>' +
        '</div>';

      var toggleBtn = document.getElementById('mobile-menu-toggle');
      var drawer = document.getElementById('mobile-nav-drawer');
      if (toggleBtn && drawer) {
        function setDrawer(open) {
          toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
          drawer.hidden = !open;
          drawer.classList.toggle('is-open', open);
        }
        toggleBtn.addEventListener('click', function () {
          var isOpen = toggleBtn.getAttribute('aria-expanded') === 'true';
          setDrawer(!isOpen);
        });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && toggleBtn.getAttribute('aria-expanded') === 'true') {
            setDrawer(false);
            toggleBtn.focus();
          }
        });
      }

      async function syncUserNav() {
        var actionsContainer = document.getElementById('navbar-actions-container');
        var mobileAuthContainer = document.getElementById('mobile-auth-actions');
        if (!actionsContainer) return;

        var profileRes = await global.TarakotaAPI.auth.getProfile();
        if (profileRes.ok && profileRes.data) {
          var u = profileRes.data;
          var firstName = escapeHtml(u.nama.split(' ')[0] || u.nama);
          actionsContainer.innerHTML =
            '<a href="tiket-saya.html" class="user-nav-badge" title="Buka Tiket Saya">👤 ' + firstName + '</a>' +
            '<button type="button" class="btn btn-ghost btn-sm" id="nav-btn-logout">Keluar</button>' +
            '<a class="btn btn-primary nav-desktop-cta" href="pemesanan.html">Beli Tiket</a>' +
            '<button type="button" class="btn btn-ghost menu-toggle-btn" id="mobile-menu-toggle" aria-expanded="false" aria-controls="mobile-nav-drawer">Menu</button>';

          if (mobileAuthContainer) {
            mobileAuthContainer.innerHTML =
              '<div style="padding:0.5rem 0; font-size:var(--text-sm); font-weight:700;">👤 ' + firstName + ' (' + escapeHtml(u.email) + ')</div>' +
              '<a class="btn btn-primary" href="pemesanan.html" style="margin-bottom:0.5rem;">Beli Tiket</a>' +
              '<button type="button" class="btn btn-ghost" id="mobile-btn-logout" style="width:100%;">Keluar (Logout)</button>';
          }

          var logoutBtn = document.getElementById('nav-btn-logout');
          var mobileLogoutBtn = document.getElementById('mobile-btn-logout');
          async function doLogout() {
            await global.TarakotaAPI.auth.logout();
            announce('Berhasil keluar akun.');
            global.dispatchEvent(new CustomEvent('tarakota_auth_change', { detail: null }));
          }
          if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
          if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', doLogout);
        } else {
          actionsContainer.innerHTML =
            '<a href="login.html" class="btn btn-ghost btn-sm" id="nav-btn-login">Masuk</a>' +
            '<a href="register.html" class="btn btn-secondary btn-sm" id="nav-btn-register">Daftar</a>' +
            '<a class="btn btn-primary nav-desktop-cta" href="pemesanan.html">Beli Tiket</a>' +
            '<button type="button" class="btn btn-ghost menu-toggle-btn" id="mobile-menu-toggle" aria-expanded="false" aria-controls="mobile-nav-drawer">Menu</button>';

          if (mobileAuthContainer) {
            mobileAuthContainer.innerHTML =
              '<div style="display:flex; gap:0.5rem; margin-bottom:0.5rem;">' +
                '<a href="login.html" class="btn btn-ghost" style="flex:1; text-align:center;">Masuk</a>' +
                '<a href="register.html" class="btn btn-secondary" style="flex:1; text-align:center;">Daftar</a>' +
              '</div>' +
              '<a class="btn btn-primary" href="pemesanan.html">Beli Tiket</a>';
          }
        }

        var reToggle = document.getElementById('mobile-menu-toggle');
        if (reToggle && drawer) {
          reToggle.addEventListener('click', function () {
            var isOpen = reToggle.getAttribute('aria-expanded') === 'true';
            reToggle.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
            drawer.hidden = isOpen;
            drawer.classList.toggle('is-open', !isOpen);
          });
        }
      }

      syncUserNav();
      global.addEventListener('tarakota_auth_change', syncUserNav);
    }

    if (footer) {
      footer.innerHTML =
        '<div class="container footer-inner">' +
          '<div>' +
            '<strong>Tarakota Fest 2026</strong>' +
            '<p style="margin:0.25rem 0 0; color: var(--color-ink-muted); font-size: var(--text-sm);">Festival Musik Pesisir dan Budaya Pantai</p>' +
          '</div>' +
          '<div class="footer-links">' +
            '<a href="jadwal.html">Jadwal Manggung</a>' +
            '<a href="pemesanan.html">Pemesanan Tiket</a>' +
            '<a href="daftar-band.html">Audisi Band</a>' +
            '<a href="admin/login.html">Portal Admin</a>' +
          '</div>' +
        '</div>';
    }
  }

  function createModalController(backdropId) {
    var backdrop = document.getElementById(backdropId);
    var openerEl = null;
    var keyListener = null;

    function getFocusable() {
      if (!backdrop) return [];
      return Array.prototype.slice.call(
        backdrop.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')
      );
    }

    function close() {
      if (!backdrop || backdrop.hidden) return;
      backdrop.hidden = true;
      if (keyListener) {
        document.removeEventListener('keydown', keyListener);
        keyListener = null;
      }
      if (openerEl && typeof openerEl.focus === 'function') {
        openerEl.focus();
      }
    }

    function open(triggerEl) {
      if (!backdrop) return;
      openerEl = triggerEl || document.activeElement;
      backdrop.hidden = false;

      keyListener = function (e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
          return;
        }
        if (e.key === 'Tab') {
          var items = getFocusable();
          if (items.length === 0) return;
          var first = items[0];
          var last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener('keydown', keyListener);
      var focusables = getFocusable();
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    }

    if (backdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) {
          close();
        }
      });
    }

    return {
      open: open,
      close: close
    };
  }

  function readImagePreview(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('File tidak dipilih.'));
        return;
      }
      var allowed = ['image/png', 'image/jpeg', 'image/webp'];
      if (allowed.indexOf(file.type) === -1) {
        reject(new Error('Format file harus berupa gambar PNG, JPG, atau WEBP.'));
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        reject(new Error('Ukuran file maksimal 2 MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = function () {
        reject(new Error('Gagal membaca file pratinjau.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function clearFieldErrors(formEl) {
    if (!formEl) return;
    var invalidInputs = formEl.querySelectorAll('[aria-invalid="true"]');
    for (var i = 0; i < invalidInputs.length; i += 1) {
      invalidInputs[i].removeAttribute('aria-invalid');
    }
    var errTexts = formEl.querySelectorAll('[data-field-error]');
    for (var j = 0; j < errTexts.length; j += 1) {
      errTexts[j].textContent = '';
      errTexts[j].hidden = true;
    }
  }

  function applyFieldErrors(formEl, errors) {
    if (!formEl || !errors) return;
    var firstInvalid = null;
    Object.keys(errors).forEach(function (fieldKey) {
      var input = formEl.querySelector('[name="' + fieldKey + '"]');
      var errorBox = formEl.querySelector('[data-field-error="' + fieldKey + '"]');
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        if (!firstInvalid) firstInvalid = input;
      }
      if (errorBox) {
        errorBox.textContent = errors[fieldKey];
        errorBox.hidden = false;
      }
    });
    if (firstInvalid && typeof firstInvalid.focus === 'function') {
      firstInvalid.focus();
    }
  }

  function renderPagination(containerEl, pagination, onPageChange) {
    if (!containerEl) return;
    if (!pagination || pagination.totalPages <= 1) {
      containerEl.hidden = true;
      containerEl.innerHTML = '';
      return;
    }

    containerEl.hidden = false;
    var page = pagination.page;
    var totalPages = pagination.totalPages;
    var total = pagination.total;

    containerEl.innerHTML =
      '<span class="pagination-info">Halaman ' + page + ' dari ' + totalPages + ' (' + total + ' item)</span>' +
      '<div class="pagination-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-page-nav="prev"' + (page <= 1 ? ' disabled' : '') + '>Sebelumnya</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-page-nav="next"' + (page >= totalPages ? ' disabled' : '') + '>Berikutnya</button>' +
      '</div>';

    var prevBtn = containerEl.querySelector('[data-page-nav="prev"]');
    var nextBtn = containerEl.querySelector('[data-page-nav="next"]');
    if (prevBtn && page > 1) {
      prevBtn.addEventListener('click', function () {
        onPageChange(page - 1);
      });
    }
    if (nextBtn && page < totalPages) {
      nextBtn.addEventListener('click', function () {
        onPageChange(page + 1);
      });
    }
  }

  global.TarakotaUI = {
    resolveAssetPath: resolveAssetPath,
    escapeHtml: escapeHtml,
    formatRupiah: formatRupiah,
    formatDateTime: formatDateTime,
    renderStatusBadge: renderStatusBadge,
    announce: announce,
    mountPublicChrome: mountPublicChrome,
    openAuthModal: openAuthModal,
    createModalController: createModalController,
    renderPagination: renderPagination,
    readImagePreview: readImagePreview,
    clearFieldErrors: clearFieldErrors,
    applyFieldErrors: applyFieldErrors
  };
})(window);

