const supabase = require("./_supabase");

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return response(405, {
        success: false,
        message: "Method tidak diizinkan."
      });
    }

    const params = event.queryStringParameters || {};

    const mulai = String(params.mulai || "").trim();
    const akhir = String(params.akhir || "").trim();
    const tipe = String(params.tipe || "").trim().toLowerCase();
    const siswaId = String(params.siswaId || "").trim();
    const kelasId = String(params.kelasId || "").trim();

    // ==========================================
    // VALIDASI
    // ==========================================

    if (!mulai || !akhir) {
      return response(400, {
        success: false,
        message: "Tanggal mulai dan tanggal akhir wajib diisi."
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(mulai) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(akhir)) {
      return response(400, {
        success: false,
        message: "Format tanggal tidak valid."
      });
    }

    if (mulai > akhir) {
      return response(400, {
        success: false,
        message: "Tanggal mulai tidak boleh lebih besar dari tanggal akhir."
      });
    }

    if (!["siswa", "kelas", "sekolah"].includes(tipe)) {
      return response(400, {
        success: false,
        message: "Tipe rekap tidak valid."
      });
    }

    if (tipe === "siswa" && !siswaId) {
      return response(400, {
        success: false,
        message: "Siswa wajib dipilih."
      });
    }

    if (tipe === "kelas" && !kelasId) {
      return response(400, {
        success: false,
        message: "Kelas wajib dipilih."
      });
    }

    // ==========================================
    // AMBIL SISWA
    // ==========================================

    let siswaQuery = supabase
      .from("siswa")
      .select(`
        id,
        nisn,
        nama,
        kelas_id,
        status
      `);

    if (tipe === "siswa") {
      siswaQuery = siswaQuery.eq("id", siswaId);
    }

    if (tipe === "kelas") {
      siswaQuery = siswaQuery.eq("kelas_id", kelasId);
    }

    const {
      data: siswaRows,
      error: siswaError
    } = await siswaQuery;

    if (siswaError) {
      console.error("REPORT SISWA ERROR:", siswaError);

      return response(500, {
        success: false,
        message: "Gagal mengambil data siswa.",
        error: siswaError.message
      });
    }

    if (tipe === "siswa" && (!siswaRows || siswaRows.length === 0)) {
      return response(404, {
        success: false,
        message: "Siswa tidak ditemukan."
      });
    }

    // ==========================================
    // AMBIL KELAS
    // ==========================================

    const {
      data: kelasRows,
      error: kelasError
    } = await supabase
      .from("kelas")
      .select(`
        id,
        nama_kelas,
        tingkat,
        status
      `);

    if (kelasError) {
      console.error("REPORT KELAS ERROR:", kelasError);

      return response(500, {
        success: false,
        message: "Gagal mengambil data kelas.",
        error: kelasError.message
      });
    }

    const kelasMap = {};

    for (const kelas of kelasRows || []) {
      kelasMap[String(kelas.id)] = {
        id: String(kelas.id),
        nama: String(kelas.nama_kelas || "").trim(),
        tingkat: String(kelas.tingkat || "").trim(),
        status: String(kelas.status || "").trim()
      };
    }

    // ==========================================
    // ID SISWA
    // ==========================================

    const siswaIds = (siswaRows || [])
      .map(siswa => String(siswa.id || "").trim())
      .filter(Boolean);

    // ==========================================
    // AMBIL POIN
    // ==========================================

    let poinRows = [];

    if (siswaIds.length > 0) {

      const {
        data,
        error: poinError
      } = await supabase
        .from("poin")
        .select(`
          id,
          siswa_id,
          jenis,
          poin,
          keterangan,
          tanggal,
          dibuat_oleh,
          peran
        `)
        .in("siswa_id", siswaIds)
        .gte("tanggal", mulai)
        .lte("tanggal", akhir)
        .order("tanggal", {
          ascending: true
        });

      if (poinError) {
        console.error("REPORT POIN ERROR:", poinError);

        return response(500, {
          success: false,
          message: "Gagal mengambil data poin.",
          error: poinError.message
        });
      }

      poinRows = data || [];
    }

    // ==========================================
    // MAP SISWA
    // ==========================================

    const siswaMap = {};

    for (const siswa of siswaRows || []) {

      const id = String(siswa.id || "").trim();

      siswaMap[id] = {
        id,
        nisn: String(siswa.nisn || "").trim(),
        nama: String(siswa.nama || "").trim(),
        kelasId: String(siswa.kelas_id || "").trim(),
        kelasNama:
          kelasMap[String(siswa.kelas_id || "")]?.nama || "-",
        status: String(siswa.status || "").trim(),

        penghargaan: 0,
        pelanggaran: 0,
        transaksi: 0
      };
    }

    // ==========================================
    // HITUNG POIN
    // ==========================================

    for (const poin of poinRows) {

      const id = String(poin.siswa_id || "").trim();

      if (!siswaMap[id]) {
        continue;
      }

      const nilai = Number(poin.poin || 0);

      const jenis = String(poin.jenis || "")
        .trim()
        .toLowerCase();

      if (jenis === "penghargaan") {
        siswaMap[id].penghargaan += nilai;
      }

      if (jenis === "pelanggaran") {
        siswaMap[id].pelanggaran += nilai;
      }

      siswaMap[id].transaksi++;
    }

    // ==========================================
    // BENTUK DATA SISWA
    // ==========================================

    const siswaResult = Object.values(siswaMap).map(siswa => ({
      id: siswa.id,
      nisn: siswa.nisn,
      nama: siswa.nama,
      kelasId: siswa.kelasId,
      kelas: siswa.kelasNama,
      status: siswa.status,

      penghargaan: siswa.penghargaan,
      pelanggaran: siswa.pelanggaran,

      total: siswa.penghargaan - siswa.pelanggaran,

      transaksi: siswa.transaksi
    }));

    // ==========================================
    // TOTAL
    // ==========================================

    const totalPenghargaan = siswaResult.reduce(
      (total, siswa) => total + siswa.penghargaan,
      0
    );

    const totalPelanggaran = siswaResult.reduce(
      (total, siswa) => total + siswa.pelanggaran,
      0
    );

    const totalTransaksi = siswaResult.reduce(
      (total, siswa) => total + siswa.transaksi,
      0
    );

    const totalBersih =
      totalPenghargaan - totalPelanggaran;

    // ==========================================
    // REKAP PER KELAS
    // ==========================================

    const kelasResultMap = {};

    for (const siswa of siswaResult) {

      const id = siswa.kelasId || "TANPA_KELAS";

      if (!kelasResultMap[id]) {

        kelasResultMap[id] = {
          kelasId: id,
          kelas: siswa.kelas,
          jumlahSiswa: 0,
          penghargaan: 0,
          pelanggaran: 0,
          total: 0,
          transaksi: 0,
          siswa: []
        };
      }

      kelasResultMap[id].jumlahSiswa++;

      kelasResultMap[id].penghargaan += siswa.penghargaan;
      kelasResultMap[id].pelanggaran += siswa.pelanggaran;
      kelasResultMap[id].total += siswa.total;
      kelasResultMap[id].transaksi += siswa.transaksi;

      kelasResultMap[id].siswa.push(siswa);
    }

    const kelasResult = Object.values(kelasResultMap);

    kelasResult.sort((a, b) =>
      a.kelas.localeCompare(b.kelas)
    );

    // ==========================================
    // DETAIL TRANSAKSI
    // ==========================================

    const transaksi = poinRows.map(row => {

      const siswa = siswaMap[String(row.siswa_id || "")];

      return {
        id: String(row.id || "").trim(),

        siswaId:
          String(row.siswa_id || "").trim(),

        nama:
          siswa?.nama || "-",

        nisn:
          siswa?.nisn || "-",

        kelas:
          siswa?.kelasNama || "-",

        jenis:
          String(row.jenis || "").trim(),

        poin:
          Number(row.poin || 0),

        keterangan:
          String(row.keterangan || "").trim(),

        tanggal:
          String(row.tanggal || "").trim(),

        dibuatOleh:
          String(row.dibuat_oleh || "").trim(),

        peran:
          String(row.peran || "").trim()
      };
    });

    // ==========================================
    // RESPONSE
    // ==========================================

    return response(200, {
      success: true,

      periode: {
        mulai,
        akhir
      },

      tipe,

      ringkasan: {
        jumlahSiswa: siswaResult.length,
        totalPenghargaan,
        totalPelanggaran,
        totalBersih,
        totalTransaksi
      },

      siswa: siswaResult,

      kelas: kelasResult,

      transaksi
    });

  } catch (error) {

    console.error("ADMIN REPORT ERROR:", error);

    return response(500, {
      success: false,
      message: "Terjadi kesalahan pada server.",
      error: error.message
    });
  }
};
