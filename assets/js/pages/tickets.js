(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var UI = global.TarakotaUI;
    var API = global.TarakotaAPI;
    UI.mountPublicChrome('pemesanan');

    var catalogContainer = document.getElementById('event-catalog-container');
    var resultBanner = document.getElementById('order-result-banner');
    var modalCtrl = UI.createModalController('checkout-modal-backdrop');
    var closeModalBtn = document.getElementById('checkout-modal-close');
    var checkoutForm = document.getElementById('checkout-form');
    var modalErrorBox = document.getElementById('checkout-api-errors');
    var eventTitleEl = document.getElementById('checkout-event-title');
    var eventMetaEl = document.getElementById('checkout-event-meta');
    var eventIdInput = document.getElementById('checkout-event-id');
    var qtyInput = document.getElementById('checkout-qty');
    var qtyMinusBtn = document.getElementById('qty-minus-btn');
    var qtyPlusBtn = document.getElementById('qty-plus-btn');
    var totalPreviewEl = document.getElementById('checkout-total-preview');
    var dropzoneEl = document.getElementById('proof-dropzone');
    var fileInput = document.getElementById('checkout-proof-file');
    var proofPreviewBox = document.getElementById('proof-preview-box');
    var proofPreviewImg = document.getElementById('proof-preview-img');
    var proofFileNameEl = document.getElementById('proof-file-name');
    var removeProofBtn = document.getElementById('remove-proof-btn');
    var submitBtn = document.getElementById('checkout-submit-btn');

    var lookupForm = document.getElementById('ticket-lookup-form');
    var lookupInput = document.getElementById('lookup-query');
    var lookupResultBox = document.getElementById('ticket-lookup-result');

    async function syncAuthBanner() {
      var statusEl = document.getElementById('pemesanan-auth-status');
      var descEl = document.getElementById('pemesanan-auth-desc');
      var actionsEl = document.getElementById('pemesanan-auth-actions');
      if (!statusEl || !actionsEl) return;

      try {
        var res = await API.auth.getProfile();
        if (res.ok && res.data) {
          var u = res.data;
          statusEl.innerHTML = '👤 Halo, ' + UI.escapeHtml(u.nama) + '!';
          if (descEl) descEl.textContent = 'Akun terhubung (' + u.email + '). Data Anda akan otomatis terisi saat memilih tiket.';
          actionsEl.innerHTML =
            '<a href="tiket-saya.html" class="btn btn-primary btn-sm">Buka Tiket Saya</a>' +
            '<button type="button" class="btn btn-ghost btn-sm" id="btn-banner-logout">Ganti Akun</button>';
          var bOut = document.getElementById('btn-banner-logout');
          if (bOut) {
            bOut.addEventListener('click', async function () {
              await API.auth.logout();
              window.location.reload();
            });
          }
        } else {
          statusEl.textContent = 'Belum Masuk Akun?';
          if (descEl) descEl.innerHTML = 'Daftar akun baru atau masuk untuk menikmati fitur auto-fill formulir pemesanan dan memantau E-Pass tiket Anda di halaman <strong>Tiket Saya</strong>.';
          actionsEl.innerHTML =
            '<a href="register.html" class="btn btn-secondary btn-sm">Daftar User Baru</a>' +
            '<a href="login.html" class="btn btn-primary btn-sm">Masuk Akun</a>';
        }
      } catch (_e) {}
    }
    syncAuthBanner();
    global.addEventListener('tarakota_auth_change', syncAuthBanner);

    var activeEvent = null;
    var selectedProofFile = null;
    var currentPage = 1;
    var PAGE_LIMIT = 9;

    function updateTotalPreview() {
      if (!activeEvent || !totalPreviewEl || !qtyInput) return;
      var q = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      totalPreviewEl.textContent = UI.formatRupiah(activeEvent.price * q);
    }

    function clearProofSelection() {
      selectedProofFile = null;
      if (fileInput) fileInput.value = '';
      if (proofPreviewBox) proofPreviewBox.hidden = true;
      if (proofPreviewImg) proofPreviewImg.src = '';
      if (proofFileNameEl) proofFileNameEl.textContent = '';
    }

    async function handleSelectedFile(file) {
      if (!file) return;
      UI.clearFieldErrors(checkoutForm);
      try {
        var dataUrl = await UI.readImagePreview(file);
        selectedProofFile = file;
        if (proofPreviewImg) proofPreviewImg.src = dataUrl;
        if (proofFileNameEl) proofFileNameEl.textContent = file.name;
        if (proofPreviewBox) proofPreviewBox.hidden = false;
        UI.announce('File bukti transfer ' + file.name + ' siap dikirim.');
      } catch (err) {
        clearProofSelection();
        UI.applyFieldErrors(checkoutForm, { proofFile: err.message });
      }
    }

    async function openCheckoutModal(evtObj, triggerBtn) {
      activeEvent = evtObj;
      if (!checkoutForm) return;
      checkoutForm.reset();
      UI.clearFieldErrors(checkoutForm);
      clearProofSelection();
      if (modalErrorBox) {
        modalErrorBox.hidden = true;
        modalErrorBox.innerHTML = '';
      }
      if (eventIdInput) eventIdInput.value = evtObj.id;
      if (eventTitleEl) eventTitleEl.textContent = evtObj.title;
      if (eventMetaEl) {
        eventMetaEl.textContent = evtObj.dateLabel + ' | ' + UI.formatRupiah(evtObj.price) + ' | Sisa kuota: ' + evtObj.remainingQuota;
      }
      if (qtyInput) {
        qtyInput.value = '1';
        qtyInput.max = String(Math.min(10, evtObj.remainingQuota));
      }
      updateTotalPreview();

      try {
        var profileRes = await API.auth.getProfile();
        if (profileRes.ok && profileRes.data) {
          var nameField = document.getElementById('checkout-buyer-name');
          var emailField = document.getElementById('checkout-buyer-email');
          if (nameField && profileRes.data.nama) nameField.value = profileRes.data.nama;
          if (emailField && profileRes.data.email) emailField.value = profileRes.data.email;
        }
      } catch (_e) {}

      modalCtrl.open(triggerBtn);
    }

    async function renderCatalog() {
      if (!catalogContainer) return;
      catalogContainer.innerHTML =
        '<div class="state-panel" role="status">' +
          '<h3>Memuat katalog tiket...</h3>' +
          '<p>Mengambil informasi event dan sisa kuota terkini dari server.</p>' +
        '</div>';

      var res = await API.events.list(false, currentPage, PAGE_LIMIT);
      if (!res.ok) {
        catalogContainer.innerHTML =
          '<div class="state-panel" role="alert">' +
            '<h3>Gagal memuat katalog</h3>' +
            '<p>' + UI.escapeHtml(res.message) + '</p>' +
            '<button type="button" class="btn btn-primary" id="retry-catalog-btn">Muat Ulang Katalog</button>' +
          '</div>';
        var retry = document.getElementById('retry-catalog-btn');
        if (retry) retry.addEventListener('click', renderCatalog);
        return;
      }

      var events = (res.data && res.data.items) || [];
      var pagination = (res.data && res.data.pagination) || { page: 1, totalPages: 1, total: events.length };
      if (events.length === 0) {
        catalogContainer.innerHTML =
          '<div class="state-panel">' +
            '<h3>Belum ada event tiket aktif</h3>' +
            '<p>Seluruh kategori tiket sedang ditutup atau dibatalkan oleh panitia. Periksa kembali nanti.</p>' +
          '</div>';
        return;
      }

      var polaroidGallery = [
        'assets/images/polaroid-1.svg',
        'assets/images/polaroid-2.svg',
        'assets/images/polaroid-3.svg'
      ];

      catalogContainer.innerHTML = '<div class="ticket-grid">' + events.map(function (evt, idx) {
        var soldOut = evt.remainingQuota <= 0;
        var rawThumb = evt.thumbnail || 'assets/images/placeholder-ticket.svg';
        var displayThumb = rawThumb === 'assets/images/placeholder-ticket.svg'
          ? polaroidGallery[idx % polaroidGallery.length]
          : rawThumb;
        return (
          '<div class="ticket-glass-frame">' +
            '<article class="ticket-card">' +
              '<span class="ticket-washi-tape" aria-hidden="true"></span>' +
              '<div class="ticket-card-media">' +
                '<img src="' + UI.escapeHtml(UI.resolveAssetPath(displayThumb)) + '" alt="' + UI.escapeHtml(evt.title) + '" width="400" height="240">' +
              '</div>' +
              '<div class="ticket-perforation" aria-hidden="true"></div>' +
              '<div class="ticket-card-body">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">' +
                  '<span class="status-badge status-badge--lilac">' + UI.escapeHtml(evt.category) + '</span>' +
                  '<span class="mono" style="font-size:var(--text-xs);">' + UI.escapeHtml(evt.dateLabel) + '</span>' +
                '</div>' +
                '<h2 style="font-size:var(--text-xl); margin:0;">' + UI.escapeHtml(evt.title) + '</h2>' +
                '<p style="margin:0; color:var(--color-ink-muted); font-size:var(--text-sm);">' + UI.escapeHtml(evt.description) + '</p>' +
                '<div class="ticket-meta-row">' +
                  '<div>' +
                    '<div class="ticket-price">' + UI.escapeHtml(UI.formatRupiah(evt.price)) + '</div>' +
                    '<div class="ticket-quota">Sisa Kuota: ' + evt.remainingQuota + ' / ' + evt.totalQuota + '</div>' +
                  '</div>' +
                  '<button type="button" class="btn btn-primary" data-choose-event="' + UI.escapeHtml(evt.id) + '"' + (soldOut ? ' disabled' : '') + '>' +
                    (soldOut ? 'Kuota Habis' : 'Pilih Event') +
                  '</button>' +
                '</div>' +
              '</div>' +
            '</article>' +
          '</div>'
        );
      }).join('') + '</div>' +
      '<div class="pagination-bar" id="tickets-pagination" hidden></div>';

      UI.renderPagination(document.getElementById('tickets-pagination'), pagination, function (nextPage) {
        currentPage = nextPage;
        renderCatalog();
      });

      var buttons = catalogContainer.querySelectorAll('[data-choose-event]');
      for (var i = 0; i < buttons.length; i += 1) {
        buttons[i].addEventListener('click', function () {
          var id = this.getAttribute('data-choose-event');
          var found = events.find(function (e) { return e.id === id; });
          if (found) openCheckoutModal(found, this);
        });
      }
    }

    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', modalCtrl.close);
    }

    if (qtyMinusBtn && qtyInput) {
      qtyMinusBtn.addEventListener('click', function () {
        var val = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
        qtyInput.value = String(val);
        updateTotalPreview();
      });
    }

    if (qtyPlusBtn && qtyInput) {
      qtyPlusBtn.addEventListener('click', function () {
        var maxVal = activeEvent ? Math.min(10, activeEvent.remainingQuota) : 10;
        var val = Math.min(maxVal, (parseInt(qtyInput.value, 10) || 1) + 1);
        qtyInput.value = String(val);
        updateTotalPreview();
      });
    }

    if (qtyInput) {
      qtyInput.addEventListener('input', updateTotalPreview);
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) {
          handleSelectedFile(fileInput.files[0]);
        }
      });
    }

    if (dropzoneEl) {
      dropzoneEl.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropzoneEl.classList.add('is-dragover');
      });
      dropzoneEl.addEventListener('dragleave', function () {
        dropzoneEl.classList.remove('is-dragover');
      });
      dropzoneEl.addEventListener('drop', function (e) {
        e.preventDefault();
        dropzoneEl.classList.remove('is-dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleSelectedFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (removeProofBtn) {
      removeProofBtn.addEventListener('click', clearProofSelection);
    }

    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        UI.clearFieldErrors(checkoutForm);
        if (modalErrorBox) {
          modalErrorBox.hidden = true;
          modalErrorBox.innerHTML = '';
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Mengunci Kuota...';
        }

        var formData = new FormData(checkoutForm);
        if (selectedProofFile) {
          formData.set('proofFile', selectedProofFile);
        }

        var res = await API.transactions.create(formData);

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Kunci Kuota & Lanjut ke Pembayaran';
        }

        if (!res.ok) {
          UI.applyFieldErrors(checkoutForm, res.errors);
          if (modalErrorBox) {
            var errorItems = Object.keys(res.errors || {}).map(function (k) {
              return '<li>' + UI.escapeHtml(res.errors[k]) + '</li>';
            }).join('');
            modalErrorBox.innerHTML =
              '<strong>Validasi Gagal (HTTP ' + res.status + '):</strong> ' + UI.escapeHtml(res.message) +
              (errorItems ? '<ul>' + errorItems + '</ul>' : '');
            modalErrorBox.hidden = false;
          }
          UI.announce('Validasi transaksi gagal. Periksa pesan kesalahan pada formulir.');
          return;
        }

        modalCtrl.close();
        var trx = res.data;
        if (resultBanner) {
          resultBanner.className = 'hold-timer-card';
          resultBanner.hidden = false;
          var secLeft = trx.remainingSeconds || 900;
          resultBanner.innerHTML =
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap;">' +
              '<div>' +
                '<span class="status-badge status-badge--amber" style="font-size:10px;">INVENTORY RESERVED</span>' +
                '<h3 style="margin:0.35rem 0 0.1rem; font-size:var(--text-xl);">Kuota Tiket Berhasil Dikunci (Hold 15 Menit)!</h3>' +
                '<div class="mono" style="font-size:var(--text-sm); color:var(--color-ink-muted);">Kode Transaksi: <strong>' + UI.escapeHtml(trx.id) + '</strong> | Event: ' + UI.escapeHtml(trx.eventTitle) + ' (' + trx.qty + ' tiket)</div>' +
              '</div>' +
              '<div class="countdown-box" id="banner-hold-timer">⏱ ' + Math.floor(secLeft / 60) + ':' + (secLeft % 60 < 10 ? '0' : '') + (secLeft % 60) + '</div>' +
            '</div>' +
            '<div class="unique-amount-highlight">' +
              '<span style="font-size:var(--text-xs); font-weight:700; color:var(--color-ink-muted);">TOTAL NOMINAL TRANSFER TEPAT</span>' +
              '<span class="amount-val">' + UI.formatRupiah(trx.totalAmount) + '</span>' +
              '<span class="amount-note">Termasuk 3 digit kode unik: <strong>+' + (trx.uniqueCode || 0) + '</strong> agar pembayaran Anda tidak tertukar dengan pembeli lain.</span>' +
              '<div style="margin-top:0.4rem; font-size:var(--text-xs);">' +
                'Transfer ke: <strong>Bank Mandiri 140-002-026-8888 a.n. Yayasan Tarakota Fest</strong>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem; align-items:center;">' +
              '<a href="tiket-saya.html" class="btn btn-primary">Buka Dompet E-Ticket (Tiket Saya)</a>' +
              (trx.hasProof ? '<span class="status-badge status-badge--mint">Bukti transfer terunggah</span>' : '<span style="font-size:var(--text-xs); color:var(--color-ink-muted);">Bukti bayar dapat diunggah di menu Tiket Saya sebelum 15 menit habis.</span>') +
            '</div>';

          var timerBox = document.getElementById('banner-hold-timer');
          if (timerBox) {
            var bInterval = setInterval(function () {
              secLeft -= 1;
              if (secLeft <= 0) {
                clearInterval(bInterval);
                timerBox.textContent = '⏱ WAKTU HABIS';
                timerBox.classList.add('is-urgent');
              } else {
                var m = Math.floor(secLeft / 60);
                var s = secLeft % 60;
                timerBox.textContent = '⏱ ' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
                if (secLeft < 180) timerBox.classList.add('is-urgent');
              }
            }, 1000);
          }
          resultBanner.focus();
        }
        UI.announce('Tiket berhasil di-hold selama 15 menit. Kode transaksi ' + trx.id);
        renderCatalog();
      });
    }

    if (lookupForm && lookupInput && lookupResultBox) {
      lookupForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        UI.clearFieldErrors(lookupForm);
        lookupResultBox.hidden = true;
        var res = await API.transactions.lookup(lookupInput.value);
        if (!res.ok) {
          UI.applyFieldErrors(lookupForm, res.errors);
          return;
        }
        lookupResultBox.hidden = false;
        var matches = (res.data && res.data.items) || [];
        if (matches.length === 0) {
          lookupResultBox.innerHTML =
            '<div class="alert-box alert-box--info" style="margin-top:1rem; margin-bottom:0;">' +
              '<strong>Transaksi tidak ditemukan.</strong> Pastikan kode transaksi (contoh: TRX-2026-0001) atau email sesuai.' +
            '</div>';
          return;
        }
        lookupResultBox.innerHTML = matches.map(function (t) {
          return (
            '<div class="alert-box alert-box--info" style="margin-top:1rem; margin-bottom:0;">' +
              '<div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:0.5rem; align-items:center;">' +
                '<strong class="mono">' + UI.escapeHtml(t.id) + '</strong>' +
                UI.renderStatusBadge(t.status) +
              '</div>' +
              '<p style="margin:0.45rem 0 0; font-size:var(--text-sm);">' +
                UI.escapeHtml(t.buyerName) + ' | ' + UI.escapeHtml(t.eventTitle) + ' (' + t.qty + 'x) | ' + UI.formatRupiah(t.totalAmount) +
              '</p>' +
              (t.adminNote ? '<p style="margin:0.3rem 0 0; font-size:var(--text-xs); color:var(--color-ink-muted);">Catatan Admin: ' + UI.escapeHtml(t.adminNote) + '</p>' : '') +
            '</div>'
          );
        }).join('');
      });
    }

    API.onSync(function (topic) {
      if (topic === 'events' || topic === 'transactions') {
        renderCatalog();
      }
    });

    renderCatalog();
  });
})(window);

