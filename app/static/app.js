/* Buku Pajak - perilaku ringan: format angka, ambil kurs KMK, status tombol. */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Normalisasi angka gaya Indonesia.
     Titik = pemisah ribuan, koma = desimal. Titik tunggal yang diikuti
     bukan 3 digit dianggap desimal, jadi "1500.5" tetap terbaca 1500,5.
     ------------------------------------------------------------------ */
  function normalisasi(teks) {
    var t = String(teks == null ? "" : teks).replace(/[^\d.,]/g, "");
    t = t.replace(/\.(?=\d{3}(?:[.,]|$))/g, ""); // buang titik pemisah ribuan
    if (t.indexOf(",") === -1 && t.indexOf(".") !== -1) {
      t = t.replace(".", ","); // sisa titik tunggal -> pemisah desimal
    }
    var bagian = t.split(",");
    return {
      bulat: (bagian[0] || "").replace(/\D/g, ""),
      desimal: bagian.length > 1 ? bagian.slice(1).join("").replace(/\D/g, "").slice(0, 2) : null,
      adaKoma: bagian.length > 1
    };
  }

  function kelompokkan(digit) {
    return digit.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function formatRibuan(teks) {
    return kelompokkan(normalisasi(teks).bulat);
  }

  function formatDesimal(teks) {
    var p = normalisasi(teks);
    if (!p.bulat && !p.adaKoma) return "";
    var bulat = kelompokkan(p.bulat);
    return p.adaKoma ? bulat + "," + (p.desimal || "") : bulat;
  }

  function angkaDari(teks) {
    var p = normalisasi(teks);
    var n = parseFloat(p.bulat + (p.desimal !== null ? "." + p.desimal : ""));
    return isNaN(n) ? 0 : n;
  }

  function rupiah(n) {
    return "Rp " + Math.round(n).toLocaleString("id-ID");
  }

  function angkaID(n, desimal) {
    return Number(n).toLocaleString("id-ID", {
      minimumFractionDigits: desimal,
      maximumFractionDigits: desimal
    });
  }

  /* -------------------- format input sambil mengetik (jaga posisi kursor) */
  function digitSebelumKursor(el) {
    return el.value.slice(0, el.selectionStart).replace(/\D/g, "").length;
  }

  function taruhKursor(el, jumlahDigit) {
    var n = 0;
    var i = 0;
    for (; i < el.value.length && n < jumlahDigit; i++) {
      if (/\d/.test(el.value[i])) n += 1;
    }
    try {
      el.setSelectionRange(i, i);
    } catch (e) {
      /* input type tertentu tidak mendukung setSelectionRange */
    }
  }

  document.querySelectorAll("[data-format]").forEach(function (el) {
    var desimal = el.dataset.format === "desimal";
    var rapikan = desimal ? formatDesimal : formatRibuan;

    if (el.value) el.value = rapikan(el.value);

    el.addEventListener("input", function () {
      var posisi = digitSebelumKursor(el);
      el.value = rapikan(el.value);
      taruhKursor(el, posisi);
    });
  });

  /* ------------------------------------------- ambil kurs KMK di form input */
  var formPendapatan = document.querySelector("[data-kurs-form]");
  if (formPendapatan) {
    var fTanggal = formPendapatan.querySelector("#tanggal");
    var fMataUang = formPendapatan.querySelector("#mata_uang");
    var fValas = formPendapatan.querySelector("#jumlah_valas");
    var fKurs = formPendapatan.querySelector("#kurs_kmk");
    var fIdr = formPendapatan.querySelector("#idr");
    var kotak = formPendapatan.querySelector("#kotak-kurs");
    var tombolKurs = formPendapatan.querySelector("#btn-ambil-kurs");

    function isiKotak() {
      if (!kotak) return;
      var valas = angkaDari(fValas && fValas.value);
      var kurs = angkaDari(fKurs && fKurs.value);
      var idr = angkaDari(fIdr && fIdr.value);
      if (!valas || !kurs) {
        kotak.hidden = true;
        return;
      }

      var idrKmk = valas * kurs;
      var selisih = idr - idrKmk;
      var persenSelisih = idrKmk ? (selisih / idrKmk) * 100 : 0;

      kotak.querySelector("[data-idr-kmk]").textContent = rupiah(idrKmk);
      var elSelisih = kotak.querySelector("[data-selisih]");
      elSelisih.textContent =
        (selisih >= 0 ? "+" : "\u2212") +
        angkaID(Math.abs(selisih), 0) +
        " (" +
        (persenSelisih >= 0 ? "+" : "\u2212") +
        angkaID(Math.abs(persenSelisih), 2) +
        "%)";
      elSelisih.classList.toggle("nilai-negatif", selisih < 0);
      elSelisih.classList.toggle("nilai-positif", selisih > 0);
      kotak.hidden = false;
    }

    [fValas, fKurs, fIdr].forEach(function (el) {
      if (el) el.addEventListener("input", isiKotak);
    });
    isiKotak();

    function ambilKurs() {
      if (!fTanggal || !fMataUang || !fTanggal.value || !fMataUang.value) return;
      var status = formPendapatan.querySelector("#status-kurs");
      var semula = tombolKurs ? tombolKurs.textContent : "";

      if (tombolKurs) {
        tombolKurs.setAttribute("aria-busy", "true");
        tombolKurs.textContent = "Mengambil\u2026";
      }

      fetch(
        "/api/kurs?tanggal=" +
          encodeURIComponent(fTanggal.value) +
          "&currency=" +
          encodeURIComponent(fMataUang.value)
      )
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data.ok) {
            fKurs.value = formatDesimal(String(data.nilai));
            if (status) {
              status.textContent = data.nomor ? data.nomor + " \u00b7 " + data.periode : "";
            }
            isiKotak();
          } else if (status) {
            status.textContent = data.pesan || "Kurs tidak tersedia untuk tanggal ini.";
          }
        })
        .catch(function () {
          if (status) status.textContent = "Gagal mengambil kurs. Isi manual bila perlu.";
        })
        .finally(function () {
          if (tombolKurs) {
            tombolKurs.removeAttribute("aria-busy");
            tombolKurs.textContent = semula || "Ambil kurs KMK";
          }
        });
    }

    if (tombolKurs) tombolKurs.addEventListener("click", ambilKurs);
    if (fTanggal) {
      fTanggal.addEventListener("change", function () {
        if (!fMataUang || fMataUang.value !== "IDR") ambilKurs();
      });
    }
    if (fMataUang) {
      fMataUang.addEventListener("change", function () {
        if (fMataUang.value !== "IDR") ambilKurs();
      });
    }
  }

  /* --------------------------------------------- status tombol saat submit */
  document.querySelectorAll("form[data-tunggu]").forEach(function (form) {
    form.addEventListener("submit", function () {
      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.setAttribute("aria-busy", "true");
        btn.textContent = btn.dataset.tunggu || "Menyimpan\u2026";
      }
    });
  });

  /* ------------------------------------------------- konfirmasi hapus data */
  document.querySelectorAll("form[data-konfirmasi]").forEach(function (form) {
    form.addEventListener("submit", function (ev) {
      if (!window.confirm(form.dataset.konfirmasi)) ev.preventDefault();
    });
  });
})();
