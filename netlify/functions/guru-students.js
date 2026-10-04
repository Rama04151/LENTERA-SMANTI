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

  // ============================================================
  // CEK METHOD
  // ============================================================

  if (event.httpMethod !== "GET") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan."
    });
  }

  try {

    // ============================================================
    // AMBIL DATA KELAS
    // ============================================================

    const {
      data: kelasRows,
      error: kelasError
    } = await supabase
      .from("kelas")
      .select(`
        id,
        nama_kelas,
        status
      `)
      .order("id", {
        ascending: true
      });

    if (kelasError) {
      console.error(
        "SUPABASE GURU STUDENTS KELAS ERROR:",
        kelasError
      );

      return response(500, {
        success: false,
        message: "Gagal mengambil data kelas.",
        error: kelasError.message
      });
    }

    // ============================================================
    // BUAT MAP KELAS
    // ============================================================

    const kelasMap = {};

    (kelasRows || []).forEach(row => {

      const id =
        String(row.id || "").trim();

      const nama =
        String(row.nama_kelas || "").trim();

      const status =
        String(row.status || "")
          .trim()
          .toLowerCase();

      if (
        id &&
        nama &&
        status !== "nonaktif"
      ) {
        kelasMap[id] = nama;
      }

    });

    // ============================================================
    // AMBIL DATA SISWA AKTIF
    // ============================================================

    const {
      data: siswaRows,
      error: siswaError
    } = await supabase
      .from("siswa")
      .select(`
        id,
        nisn,
        nama,
        kelas_id,
        status
      `)
      .eq("status", "Aktif");

    if (siswaError) {
      console.error(
        "SUPABASE GURU STUDENTS SISWA ERROR:",
        siswaError
      );

      return response(500, {
        success: false,
        message: "Gagal mengambil data siswa.",
        error: siswaError.message
      });
    }

    // ============================================================
    // AMBIL DATA POIN
    // ============================================================

    const {
      data: poinRows,
      error: poinError
    } = await supabase
      .from("poin")
      .select(`
        siswa_id,
        jenis,
        poin
      `);

    if (poinError) {
      console.error(
        "SUPABASE GURU STUDENTS POIN ERROR:",
        poinError
      );

      return response(500, {
        success: false,
        message: "Gagal mengambil data poin.",
        error: poinError.message
      });
    }

    // ============================================================
    // HITUNG POIN PER SISWA
    // ============================================================

    const poinMap = {};

    (poinRows || []).forEach(row => {

      const siswaId =
        String(row.siswa_id || "").trim();

      const jenis =
        String(row.jenis || "")
          .trim()
          .toLowerCase();

      const nilai =
        Number(row.poin || 0);

      if (!siswaId) {
        return;
      }

      if (!poinMap[siswaId]) {
        poinMap[siswaId] = {
          penghargaan: 0,
          pelanggaran: 0
        };
      }

      if (jenis === "penghargaan") {

        poinMap[siswaId].penghargaan +=
          nilai;

      } else if (jenis === "pelanggaran") {

        poinMap[siswaId].pelanggaran +=
          nilai;

      }

    });

    // ============================================================
    // GABUNGKAN DATA SISWA + KELAS + POIN
    // ============================================================

    const siswa = [];

    (siswaRows || []).forEach(row => {

      const id =
        String(row.id || "").trim();

      const nisn =
        String(row.nisn || "").trim();

      const nama =
        String(row.nama || "").trim();

      const kelasId =
        String(row.kelas_id || "").trim();

      const status =
        String(row.status || "")
          .trim()
          .toLowerCase();

      // Guru hanya melihat siswa aktif
      if (
        !id ||
        !nama ||
        status !== "aktif"
      ) {
        return;
      }

      const poin =
        poinMap[id] || {
          penghargaan: 0,
          pelanggaran: 0
        };

      siswa.push({
        id,

        nisn,

        nama,

        kelasId,

        kelas:
          kelasMap[kelasId] || "-",

        penghargaan:
          poin.penghargaan,

        pelanggaran:
          poin.pelanggaran,

        total:
          poin.penghargaan -
          poin.pelanggaran
      });

    });

    // ============================================================
    // URUTKAN BERDASARKAN NAMA
    // ============================================================

    siswa.sort((a, b) => {

      return a.nama.localeCompare(
        b.nama,
        "id"
      );

    });

    console.log(
      "GURU STUDENTS BERHASIL:",
      siswa.length,
      "siswa"
    );

    // ============================================================
    // RESPONSE
    // ============================================================

    return response(200, {
      success: true,
      siswa
    });

  } catch (error) {

    console.error(
      "GURU STUDENTS ERROR:",
      error
    );

    return response(500, {
      success: false,
      message:
        error.message ||
        "Gagal mengambil data siswa."
    });
  }
};
