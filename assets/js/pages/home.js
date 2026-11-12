(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', async function () {
    var UI = global.TarakotaUI;
    var API = global.TarakotaAPI;
    UI.mountPublicChrome('home');

    var summaryNote = document.getElementById('home-live-summary');
    if (!summaryNote) return;

    try {
      var results = await Promise.all([
        API.events.list(false),
        API.schedule.list({})
      ]);
      var evtRes = results[0];
      var schRes = results[1];
      if (evtRes.ok && schRes.ok) {
        var evtTotal = (evtRes.data && evtRes.data.pagination && evtRes.data.pagination.total) || ((evtRes.data && evtRes.data.items) || []).length;
        var schTotal = (schRes.data && schRes.data.pagination && schRes.data.pagination.total) || ((schRes.data && schRes.data.items) || []).length;
        summaryNote.textContent =
          evtTotal + ' kategori tiket tersedia dan ' +
          schTotal + ' penampil terjadwal.';
      } else {
        summaryNote.textContent = 'Informasi tiket dan jadwal tersedia melalui menu navigasi.';
      }
    } catch (_err) {
      summaryNote.textContent = 'Informasi tiket dan jadwal tersedia melalui menu navigasi.';
    }
  });
})(window);

