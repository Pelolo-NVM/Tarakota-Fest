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

  function mountPublicChrome(activePage) {
    var header = document.getElementById('site-header');
    var footer = document.getElementById('site-footer');

    var navItems = [
      { id: 'home', label: 'Beranda', href: 'index.html' },
      { id: 'jadwal', label: 'Jadwal', href: 'jadwal.html' },
      { id: 'pemesanan', label: 'Pemesanan', href: 'pemesanan.html' },
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
              '<div class="nav-actions">' +
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
              '<li><a class="btn btn-primary" href="pemesanan.html">Beli Tiket</a></li>' +
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
    createModalController: createModalController,
    renderPagination: renderPagination,
    readImagePreview: readImagePreview,
    clearFieldErrors: clearFieldErrors,
    applyFieldErrors: applyFieldErrors
  };
})(window);

