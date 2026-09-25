import unittest

from app.kurs import KursError, parse_kurs

HTML_CONTOH = """
<div class="kurs">
  <span>KMK Nomor 45/MK/EF.2/2026</span>
  <span>Tanggal berlaku: 23 September 2026 - 29 September 2026</span>
  <table>
    <tbody>
      <tr>
        <td><span class='hidden-xs'>Dolar Amerika Serikat (USD)</span><span class='visible-xs-inline'>USD</span></td>
        <td><div class="m-l-5">17.707,00</div></td>
      </tr>
      <tr>
        <td><span class='hidden-xs'>Dolar Australia (AUD)</span><span class='visible-xs-inline'>AUD</span></td>
        <td><div class="m-l-5">12.604,12</div></td>
      </tr>
      <tr>
        <td><span class='hidden-xs'>Yen Jepang (JPY)</span><span class='visible-xs-inline'>JPY</span></td>
        <td><div class="m-l-5">11.644,57</div></td>
      </tr>
    </tbody>
  </table>
</div>
"""


class TestParseKurs(unittest.TestCase):
    def test_ambil_usd(self):
        hasil = parse_kurs(HTML_CONTOH, "USD")
        self.assertEqual(hasil["nilai"], 17707.00)
        self.assertEqual(hasil["currency"], "USD")
        self.assertEqual(hasil["nomor"], "45/MK/EF.2/2026")
        self.assertIn("23 September 2026", hasil["periode"])

    def test_semua_mata_uang(self):
        hasil = parse_kurs(HTML_CONTOH, "AUD")
        self.assertEqual(hasil["nilai"], 12604.12)
        self.assertIn("JPY", hasil["semua"])
        self.assertEqual(hasil["semua"]["JPY"], 11644.57)

    def test_mata_uang_tidak_ada(self):
        with self.assertRaises(KursError):
            parse_kurs(HTML_CONTOH, "BTC")

    def test_html_tanpa_tabel(self):
        with self.assertRaises(KursError):
            parse_kurs("<html><body>tidak ada kurs</body></html>", "USD")


if __name__ == "__main__":
    unittest.main()
