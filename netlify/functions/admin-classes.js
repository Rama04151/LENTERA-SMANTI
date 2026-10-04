const supabase = require("./_supabase");

exports.handler = async function (event) {

  // =========================
  // HANYA GET
  // =========================
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: false,
        message: "Method tidak diizinkan."
      })
    };
  }

  try {

    // =========================
    // AMBIL DATA KELAS
    // =========================
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
      `)
      .order("id", {
        ascending: true
      });

    if (kelasError) {
      console.error(
        "SUPABASE KELAS ERROR:",
        kelasError
      );

      return response(500, {
        success: false,
        message: "Gagal mengambil data kelas."
      });
    }


    // =========================
    // AMBIL DATA SISWA
    // =========================
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
        "SUPABASE SISWA ERROR:",
        siswaError
      );

      return response(500, {
        success: false,
        message: "Gagal mengambil data siswa."
      });
    }


    // =========================
    // AMBIL SEMUA POIN
    // =========================
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
        "SUPABASE POIN ERROR:",
        poinError
      );

      return response(500, {
        success: false,
        message: "Gagal mengambil data poin."
      });
    }


    // =========================
    // MAP TOTAL POIN SISWA
    // =========================
    const poinMap = {};


    for (const row of poinRows || []) {

      const siswaId =
        String(row.siswa_id || "").trim();

      const jenis =
        String(row.jenis || "")
          .trim()
          .toLowerCase();

      const nilai =
        Number(row.poin || 0);


      if (!siswaId) {
        continue;
      }


      if (!poinMap[siswaId]) {

        poinMap[siswaId] = {
          penghargaan: 0,
          pelanggaran: 0
        };

      }


      if (jenis === "penghargaan") {

        poinMap[siswaId].penghargaan += nilai;

      }

      else if (jenis === "pelanggaran") {

        poinMap[siswaId].pelanggaran += nilai;

      }

    }


    // =========================
    // MAP KELAS
    // =========================
    const kelasMap = {};


    for (const row of kelasRows || []) {

      const id =
        String(row.id || "").trim();

      if (!id) {
        continue;
      }


      kelasMap[id] = {

        id,

        nama:
          String(row.nama_kelas || "").trim(),

        tingkat:
          String(row.tingkat || "").trim(),

        status:
          String(row.status || "").trim()

      };

    }


    // =========================
    // BUAT DATA SISWA PER KELAS
    // =========================
    const siswaPerKelas = {};


    for (const row of siswaRows || []) {

      const id =
        String(row.id || "").trim();

      const nisn =
        String(row.nisn || "").trim();

      const nama =
        String(row.nama || "").trim();

      const kelasId =
        String(row.kelas_id || "").trim();


      if (!kelasId) {
        continue;
      }


      if (!siswaPerKelas[kelasId]) {

        siswaPerKelas[kelasId] = [];

      }


      const poin =
        poinMap[id] || {

          penghargaan: 0,

          pelanggaran: 0

        };


      const total =
        poin.penghargaan -
        poin.pelanggaran;


      siswaPerKelas[kelasId].push({

        id,

        nisn,

        nama,

        penghargaan:
          poin.penghargaan,

        pelanggaran:
          poin.pelanggaran,

        total

      });

    }


    // =========================
    // BUAT HASIL KELAS
    // =========================
    const kelas = [];


    Object.values(kelasMap).forEach(k => {

      const siswa =
        siswaPerKelas[k.id] || [];


      kelas.push({

        id: k.id,

        nama: k.nama,

        tingkat: k.tingkat,

        status: k.status,

        jumlahSiswa:
          siswa.length,

        siswa

      });

    });


    // =========================
    // RESPONSE
    // =========================
    return response(200, {

      success: true,

      kelas

    });

  }

  catch (error) {

    console.error(
      "ADMIN CLASSES ERROR:",
      error
    );

    return response(500, {

      success: false,

      message:
        "Gagal mengambil data kelas.",

      error:
        error.message

    });

  }

};


// =========================
// RESPONSE HELPER
// =========================
function response(statusCode, body) {

  return {

    statusCode,

    headers: {

      "Content-Type":
        "application/json",

      "Cache-Control":
        "no-store"

    },

    body:
      JSON.stringify(body)

  };

}
