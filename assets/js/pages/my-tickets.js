(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var UI = global.TarakotaUI;
    var API = global.TarakotaAPI;
    UI.mountPublicChrome('tiket-saya');

    var authPrompt = document.getElementById('wallet-auth-prompt');
    var userBanner = document.getElementById('wallet-user-banner');
    var userNameEl = document.getElementById('wallet-user-name');
    var userEmailEl = document.getElementById('wallet-user-email');
    var ticketsContainer = document.getElementById('wallet-tickets-container');
    var btnWalletLogin = document.getElementById('btn-wallet-login');
    var btnWalletDemo = document.getElementById('btn-wallet-demo');
    var btnRefresh = document.getElementById('btn-refresh-tickets');

    var guestLookupForm = document.getElementById('wallet-guest-lookup-form');
    var guestLookupInput = document.getElementById('wallet-lookup-query');
    var guestLookupResult = document.getElementById('wallet-guest-lookup-result');

    // Proof Modal
    var proofModalCtrl = UI.createModalController('proof-upload-modal-backdrop');
    var proofModalClose = document.getElementById('proof-modal-close');
    var proofForm = document.getElementById('wallet-upload-proof-form');
    var proofTargetInput = document.getElementById('proof-target-trx-code');
    var proofMetaEl = document.getElementById('proof-modal-trx-meta');
    var proofTotalEl = document.getElementById('proof-modal-total-display');
    var proofFileInput = document.getElementById('proof-modal-file');
    var proofDropzone = document.getElementById('wallet-proof-dropzone');
    var proofPreviewBox = document.getElementById('wallet-proof-preview-box');
    var proofPreviewImg = document.getElementById('wallet-proof-preview-img');
    var proofFileName = document.getElementById('wallet-proof-file-name');
    var proofErrorBox = document.getElementById('proof-modal-errors');
    var proofSubmitBtn = document.getElementById('wallet-submit-proof-btn');

    var selectedProofFile = null;
    var countdownTimers = [];

    function clearCountdownTimers() {
      for (var i = 0; i < countdownTimers.length; i += 1) {
        clearInterval(countdownTimers[i]);
      }
      countdownTimers = [];
    }

    function generateSvgQr(codeText) {
      // Clean SVG QR Mock Graphic with standard corners & data matrix
      return (
        '<svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="QR Pass ' + UI.escapeHtml(codeText) + '">' +
          '<rect width="140" height="140" fill="white" rx="8"/>' +
          '<!-- Top-Left Target -->' +
          '<rect x="14" y="14" width="32" height="32" fill="#292524" rx="4"/>' +
          '<rect x="18" y="18" width="24" height="24" fill="white" rx="2"/>' +
          '<rect x="22" y="22" width="16" height="16" fill="#292524" rx="2"/>' +
          '<!-- Top-Right Target -->' +
          '<rect x="94" y="14" width="32" height="32" fill="#292524" rx="4"/>' +
          '<rect x="98" y="18" width="24" height="24" fill="white" rx="2"/>' +
          '<rect x="102" y="22" width="16" height="16" fill="#292524" rx="2"/>' +
          '<!-- Bottom-Left Target -->' +
          '<rect x="14" y="94" width="32" height="32" fill="#292524" rx="4"/>' +
          '<rect x="18" y="98" width="24" height="24" fill="white" rx="2"/>' +
          '<rect x="22" y="102" width="16" height="16" fill="#292524" rx="2"/>' +
          '<!-- Matrix Data Points -->' +
          '<rect x="54" y="18" width="8" height="8" fill="#292524"/>' +
          '<rect x="70" y="18" width="12" height="8" fill="#292524"/>' +
          '<rect x="54" y="34" width="12" height="8" fill="#292524"/>' +
          '<rect x="74" y="34" width="8" height="8" fill="#292524"/>' +
          '<rect x="18" y="54" width="10" height="10" fill="#292524"/>' +
          '<rect x="36" y="54" width="14" height="8" fill="#292524"/>' +
          '<rect x="58" y="52" width="24" height="24" fill="#292524" rx="3"/>' +
          '<rect x="90" y="54" width="14" height="8" fill="#292524"/>' +
          '<rect x="112" y="54" width="10" height="10" fill="#292524"/>' +
          '<rect x="20" y="74" width="14" height="8" fill="#292524"/>' +
          '<rect x="42" y="72" width="8" height="12" fill="#292524"/>' +
          '<rect x="90" y="72" width="8" height="12" fill="#292524"/>' +
          '<rect x="106" y="74" width="16" height="8" fill="#292524"/>' +
          '<rect x="54" y="94" width="8" height="14" fill="#292524"/>' +
          '<rect x="70" y="94" width="14" height="8" fill="#292524"/>' +
          '<rect x="94" y="94" width="12" height="10" fill="#292524"/>' +
          '<rect x="114" y="94" width="12" height="12" fill="#292524"/>' +
          '<rect x="54" y="116" width="16" height="10" fill="#292524"/>' +
          '<rect x="78" y="112" width="10" height="14" fill="#292524"/>' +
          '<rect x="96" y="114" width="14" height="12" fill="#292524"/>' +
          '<rect x="118" y="116" width="8" height="10" fill="#292524"/>' +
        '</svg>'
      );
    }

    function formatTimerSeconds(totalSec) {
      if (totalSec <= 0) return '00:00';
      var m = Math.floor(totalSec / 60);
      var s = totalSec % 60;
      return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }

    function openProofModal(trxCode, totalAmount) {
      if (!proofForm) return;
      proofForm.reset();
      UI.clearFieldErrors(proofForm);
      selectedProofFile = null;
      if (proofPreviewBox) proofPreviewBox.hidden = true;
      if (proofPreviewImg) proofPreviewImg.src = '';
      if (proofFileName) proofFileName.textContent = '';
      if (proofErrorBox) {
        proofErrorBox.hidden = true;
        proofErrorBox.textContent = '';
      }

      if (proofTargetInput) proofTargetInput.value = trxCode;
      if (proofMetaEl) proofMetaEl.textContent = 'Kode Transaksi: ' + trxCode;
      if (proofTotalEl) proofTotalEl.textContent = UI.formatRupiah(totalAmount);

      proofModalCtrl.open();
    }

    if (proofModalClose) {
      proofModalClose.addEventListener('click', proofModalCtrl.close);
    }

    if (proofFileInput) {
      proofFileInput.addEventListener('change', async function () {
        if (proofFileInput.files && proofFileInput.files[0]) {
          var f = proofFileInput.files[0];
          try {
            var dataUrl = await UI.readImagePreview(f);
            selectedProofFile = f;
            if (proofPreviewImg) proofPreviewImg.src = dataUrl;
            if (proofFileName) proofFileName.textContent = f.name;
            if (proofPreviewBox) proofPreviewBox.hidden = false;
          } catch (err) {
            UI.applyFieldErrors(proofForm, { proofFile: err.message });
          }
        }
      });
    }

    if (proofForm) {
      proofForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        UI.clearFieldErrors(proofForm);
        if (proofErrorBox) proofErrorBox.hidden = true;

        var trxCode = (proofTargetInput ? proofTargetInput.value : '').trim();
        if (!trxCode) return;

        if (!selectedProofFile && (!proofFileInput.files || !proofFileInput.files[0])) {
          UI.applyFieldErrors(proofForm, { proofFile: 'Pilih file bukti transfer terlebih dahulu.' });
          return;
        }

        if (proofSubmitBtn) {
          proofSubmitBtn.disabled = true;
          proofSubmitBtn.textContent = 'Mengunggah Bukti Bayar...';
        }

        var formData = new FormData();
        formData.set('proofFile', selectedProofFile || proofFileInput.files[0]);

        var res = await API.transactions.uploadProof(trxCode, formData);

        if (proofSubmitBtn) {
          proofSubmitBtn.disabled = false;
          proofSubmitBtn.textContent = 'Kirim Bukti Pembayaran';
        }

        if (!res.ok) {
          if (proofErrorBox) {
            proofErrorBox.textContent = res.message || 'Gagal mengunggah bukti bayar.';
            proofErrorBox.hidden = false;
          }
          UI.applyFieldErrors(proofForm, res.errors);
          return;
        }

        proofModalCtrl.close();
        UI.announce('Bukti pembayaran untuk ' + trxCode + ' berhasil dikirim.');
        loadMyTickets();
      });
    }

    function renderTicketCards(items) {
      clearCountdownTimers();
      if (!ticketsContainer) return;

      if (!items || items.length === 0) {
        ticketsContainer.innerHTML =
          '<div class="state-panel">' +
            '<h3>Belum ada riwayat pesanan tiket</h3>' +
            '<p>Anda belum memesan tiket untuk Tarakota Fest 2026. Pilih kategori tiket favoritmu sekarang.</p>' +
            '<a href="pemesanan.html" class="btn btn-primary" style="margin-top:0.75rem;">Beli Tiket Sekarang</a>' +
          '</div>';
        return;
      }

      var html = '<div class="eticket-wallet-grid">';

      items.forEach(function (trx, idx) {
        var statusCls = 'is-' + trx.status;
        var timerId = 'hold-timer-' + idx;

        html +=
          '<article class="eticket-pass-card ' + statusCls + '" id="trx-card-' + UI.escapeHtml(trx.id) + '">' +
            '<div class="eticket-pass-header">' +
              '<div>' +
                '<span class="mono" style="font-weight:700; font-size:var(--text-xs); color:var(--color-ink-muted);">' + UI.escapeHtml(trx.id) + '</span>' +
                '<h3 style="margin:0.2rem 0 0; font-size:var(--text-lg);">' + UI.escapeHtml(trx.eventTitle) + '</h3>' +
              '</div>' +
              '<div>' + UI.renderStatusBadge(trx.status) + '</div>' +
            '</div>' +
            '<div class="eticket-pass-body">';

        // 1. If PAID: Render Digital Gate E-Pass & QR
        if (trx.status === 'paid') {
          html +=
            '<div class="eticket-pass-qr">' +
              generateSvgQr(trx.ticketPassCode || trx.id) +
              '<div class="mono" style="font-size:var(--text-xs); font-weight:700; letter-spacing:1.5px; margin-top:0.25rem;">' +
                UI.escapeHtml(trx.ticketPassCode || trx.id) +
              '</div>' +
              '<span class="status-badge status-badge--mint" style="font-size:10px; padding:0.15rem 0.6rem;">GATE PASS ACTIVE</span>' +
            '</div>' +
            '<div style="text-align:center; font-size:var(--text-xs); color:var(--color-ink-muted);">' +
              'Tunjukkan QR Pass ini kepada petugas pintu gerbang saat masuk venue.' +
            '</div>' +
            '<div style="background:#FFFFFF; border:1.5px solid var(--color-border-ink); border-radius:10px; padding:0.75rem; font-size:var(--text-xs);">' +
              '<div><strong>Pemegang Tiket:</strong> ' + UI.escapeHtml(trx.buyerName) + '</div>' +
              '<div><strong>Jumlah:</strong> ' + trx.qty + ' Tiket | Total: ' + UI.formatRupiah(trx.totalAmount) + '</div>' +
              '<div><strong>Waktu Pembelian:</strong> ' + UI.formatDateTime(trx.createdAt) + '</div>' +
            '</div>';
        }

        // 2. If PENDING: Render 15-Minute Countdown & Unique Code Transfer Instructions
        else if (trx.status === 'pending') {
          var isUrgent = trx.remainingSeconds > 0 && trx.remainingSeconds < 180;
          html +=
            '<div class="hold-timer-card">' +
              '<div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap;">' +
                '<span style="font-size:var(--text-xs); font-weight:700; color:var(--color-accent-tangerine);">SISA WAKTU HOLD KUOTA:</span>' +
                '<div class="countdown-box ' + (isUrgent ? 'is-urgent' : '') + '" id="' + timerId + '" data-seconds="' + trx.remainingSeconds + '">' +
                  '⏱ ' + formatTimerSeconds(trx.remainingSeconds) +
                '</div>' +
              '</div>' +
              '<p style="margin:0.4rem 0 0; font-size:var(--text-xs); color:var(--color-ink-espresso);">' +
                'Kuota tiket telah dikunci untuk Anda selama 15 menit. Selesaikan transfer dan kirim bukti bayar sebelum waktu habis.' +
              '</p>' +
            '</div>' +
            '<div class="unique-amount-highlight">' +
              '<span style="font-size:var(--text-xs); font-weight:700; color:var(--color-ink-muted);">TOTAL TRANSFER TEPAT</span>' +
              '<span class="amount-val">' + UI.formatRupiah(trx.totalAmount) + '</span>' +
              '<span class="amount-note">Termasuk 3 digit unik: <strong>+' + (trx.uniqueCode || 0) + '</strong> agar transfer teridentifikasi otomatis.</span>' +
              '<div style="margin-top:0.5rem; font-size:var(--text-xs);">' +
                'Rekening Tujuan: <strong>Bank Mandiri 140-002-026-8888 a.n. Yayasan Tarakota Fest</strong>' +
              '</div>' +
            '</div>';

          if (trx.hasProof || trx.proofUrl) {
            html +=
              '<div class="alert-box alert-box--pending" style="margin:0; font-size:var(--text-xs);">' +
                '<strong>Bukti Bayar Terkirim</strong>. Menunggu admin memverifikasi transaksi Anda.' +
              '</div>';
          } else {
            html +=
              '<button type="button" class="btn btn-primary btn-sm" style="width:100%;" data-action-proof="' + UI.escapeHtml(trx.id) + '" data-amount="' + trx.totalAmount + '">' +
                'Unggah Bukti Bayar Sekarang' +
              '</button>';
          }
        }

        // 3. If EXPIRED or CANCELLED:
        else {
          html +=
            '<div class="alert-box alert-box--error" style="margin:0; font-size:var(--text-xs);">' +
              '<strong>Pesanan ' + (trx.status === 'expired' ? 'Kedaluwarsa' : 'Dibatalkan') + '</strong>' +
              '<p style="margin:0.25rem 0 0;">Batas waktu 15 menit telah habis atau pembayaran dibatalkan. Kuota tiket telah dilepas otomatis kembali ke publik.</p>' +
              (trx.adminNote ? '<p style="margin:0.25rem 0 0; color:var(--color-ink-muted);">Catatan Admin: ' + UI.escapeHtml(trx.adminNote) + '</p>' : '') +
            '</div>' +
            '<a href="pemesanan.html" class="btn btn-secondary btn-sm" style="width:100%; text-align:center; margin-top:0.5rem;">Pesan Tiket Ulang</a>';
        }

        html +=
            '</div>' + // eticket-pass-body
            '<div class="eticket-pass-footer">' +
              '<span class="mono" style="font-size:var(--text-xs); color:var(--color-ink-muted);">' + UI.escapeHtml(trx.buyerEmail) + '</span>' +
              (trx.status === 'paid' ? '<button type="button" class="btn btn-ghost btn-sm" onclick="window.print()">Cetak E-Pass</button>' : '') +
            '</div>' +
          '</article>';
      });

      html += '</div>';
      ticketsContainer.innerHTML = html;

      // Attach proof upload handlers
      var proofBtns = ticketsContainer.querySelectorAll('[data-action-proof]');
      for (var b = 0; b < proofBtns.length; b += 1) {
        proofBtns[b].addEventListener('click', function () {
          var code = this.getAttribute('data-action-proof');
          var amt = this.getAttribute('data-amount');
          openProofModal(code, amt);
        });
      }

      // Activate real-time countdown intervals for pending tickets
      items.forEach(function (trx, idx) {
        if (trx.status === 'pending' && trx.remainingSeconds > 0) {
          var timerEl = document.getElementById('hold-timer-' + idx);
          if (!timerEl) return;
          var secLeft = trx.remainingSeconds;

          var interval = setInterval(function () {
            secLeft -= 1;
            if (secLeft <= 0) {
              clearInterval(interval);
              timerEl.textContent = '⏱ WAKTU HABIS';
              timerEl.classList.add('is-urgent');
              loadMyTickets(); // Trigger automatic refresh
            } else {
              timerEl.textContent = '⏱ ' + formatTimerSeconds(secLeft);
              if (secLeft < 180) {
                timerEl.classList.add('is-urgent');
              }
            }
          }, 1000);

          countdownTimers.push(interval);
        }
      });
    }

    async function loadMyTickets() {
      if (!ticketsContainer) return;

      var profileRes = await API.auth.getProfile();
      if (!profileRes.ok || !profileRes.data) {
        if (authPrompt) authPrompt.hidden = false;
        if (userBanner) userBanner.hidden = true;
        ticketsContainer.innerHTML =
          '<div class="state-panel">' +
            '<h3>Akses E-Ticket Terbatas</h3>' +
            '<p>Masuk ke akun Anda untuk melihat tiket yang terdaftar atas nama Anda, atau gunakan formulir pencarian tamu di bawah.</p>' +
            '<div style="margin-top:0.75rem; display:flex; gap:0.5rem; justify-content:center;">' +
              '<button type="button" class="btn btn-primary" id="btn-state-login">Masuk Akun</button>' +
              '<button type="button" class="btn btn-ghost" id="btn-state-demo">⚡ Masuk Cepat Demo</button>' +
            '</div>' +
          '</div>';

        var sLogin = document.getElementById('btn-state-login');
        var sDemo = document.getElementById('btn-state-demo');
        if (sLogin) sLogin.addEventListener('click', UI.openAuthModal);
        if (sDemo) sDemo.addEventListener('click', quickDemoLogin);
        return;
      }

      var u = profileRes.data;
      if (authPrompt) authPrompt.hidden = true;
      if (userBanner) userBanner.hidden = false;
      if (userNameEl) userNameEl.textContent = u.nama;
      if (userEmailEl) userEmailEl.textContent = u.email + ' (Role: ' + u.role + ')';

      var res = await API.transactions.myTickets();
      if (!res.ok) {
        ticketsContainer.innerHTML =
          '<div class="state-panel" role="alert">' +
            '<h3>Gagal memuat e-ticket</h3>' +
            '<p>' + UI.escapeHtml(res.message) + '</p>' +
            '<button type="button" class="btn btn-primary" id="retry-my-tickets-btn">Coba Lagi</button>' +
          '</div>';
        var retry = document.getElementById('retry-my-tickets-btn');
        if (retry) retry.addEventListener('click', loadMyTickets);
        return;
      }

      var items = (res.data && res.data.items) || [];
      renderTicketCards(items);
    }

    async function quickDemoLogin() {
      var res = await API.auth.userLogin('raka.pratama@example.com', 'tarakota2026');
      if (res.ok) {
        UI.announce('Berhasil masuk sebagai demo: Raka Pratama');
        global.dispatchEvent(new CustomEvent('tarakota_auth_change', { detail: res.data }));
        loadMyTickets();
      }
    }

    if (btnWalletLogin) btnWalletLogin.addEventListener('click', UI.openAuthModal);
    if (btnWalletDemo) btnWalletDemo.addEventListener('click', quickDemoLogin);
    if (btnRefresh) btnRefresh.addEventListener('click', loadMyTickets);

    // Guest Lookup Handler
    if (guestLookupForm && guestLookupInput && guestLookupResult) {
      guestLookupForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        UI.clearFieldErrors(guestLookupForm);
        guestLookupResult.hidden = true;

        var query = (guestLookupInput.value || '').trim();
        if (!query) {
          UI.applyFieldErrors(guestLookupForm, { query: 'Masukkan kode transaksi atau email.' });
          return;
        }

        var res = await API.transactions.lookup(query);
        if (!res.ok) {
          UI.applyFieldErrors(guestLookupForm, res.errors);
          return;
        }

        guestLookupResult.hidden = false;
        var items = (res.data && res.data.items) || [];
        if (items.length === 0) {
          guestLookupResult.innerHTML =
            '<div class="alert-box alert-box--info" style="margin-top:1rem;">' +
              '<strong>Transaksi tidak ditemukan.</strong> Periksa kembali kode transaksi Anda.' +
            '</div>';
          return;
        }

        guestLookupResult.innerHTML = items.map(function (t) {
          return (
            '<div class="alert-box alert-box--info" style="margin-top:1rem;">' +
              '<div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap;">' +
                '<strong class="mono">' + UI.escapeHtml(t.id) + '</strong>' +
                UI.renderStatusBadge(t.status) +
              '</div>' +
              '<p style="margin:0.4rem 0 0; font-size:var(--text-sm);">' +
                UI.escapeHtml(t.buyerName) + ' | ' + UI.escapeHtml(t.eventTitle) + ' (' + t.qty + 'x) | ' + UI.formatRupiah(t.totalAmount) +
              '</p>' +
              (t.ticketPassCode ? '<div class="mono" style="margin-top:0.35rem; font-weight:700; color:var(--color-accent-mint);">PASS KODE: ' + UI.escapeHtml(t.ticketPassCode) + '</div>' : '') +
              (t.status === 'pending' && (!t.hasProof && !t.proofUrl) ? '<div style="margin-top:0.5rem;"><button type="button" class="btn btn-primary btn-sm" onclick="window.location.reload()">Buka Tiket Saya untuk Upload</button></div>' : '') +
            '</div>'
          );
        }).join('');
      });
    }

    global.addEventListener('tarakota_auth_change', function () {
      loadMyTickets();
    });

    API.onSync(function (topic) {
      if (topic === 'transactions') {
        loadMyTickets();
      }
    });

    loadMyTickets();
  });
})(window);
