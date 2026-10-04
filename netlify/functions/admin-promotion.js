const supabase = require("./_supabase");

// =====================================================
// RESPONSE
// =====================================================

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


// =====================================================
// HANDLER
// =====================================================

exports.handler = async (event) => {

  try {

    // ===================================================
    // HANYA POST
    // ===================================================

    if (event.httpMethod !== "POST") {

      return response(405, {
        success: false,
        message: "Method tidak diizinkan."
      });

    }


    // ===================================================
    // DATA REQUEST
    // ===================================================

    const body =
      JSON.parse(event.body || "{}");


    const admin =
      String(
        body.admin || "Admin"
      ).trim();


    // ===================================================
    // AMBIL DATA KELAS
    // ===================================================

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

      console.error(
        "SUPABASE PROMOTION KELAS ERROR:",
        kelasError
      );

      return response(500, {
        success: false,
        message: "Gagal mengambil data kelas."
      });

    }


    // ===================================================
    // VALIDASI KELAS
    // ===================================================

    if (
      !kelasRows ||
      kelasRows.length === 0
    ) {

      return response(400, {
        success: false,
        message: "Data kelas tidak ditemukan."
      });

    }


    // ===================================================
    // MAP KELAS
    // ===================================================

    const kelasMap = {};

    for (const kelas of kelasRows) {

      const id =
        String(
          kelas.id || ""
        ).trim();

      const nama =
        String(
          kelas.nama_kelas || ""
        ).trim();


      if (!id || !nama) {
        continue;
      }


      kelasMap[nama] = id;

    }


    // ===================================================
    // KELAS WAJIB
    // ===================================================

    const kelasWajib = [
      "X A",
      "X B",
      "XI A",
      "XI B",
      "XII A",
      "XII B"
    ];


    for (
      const namaKelas of kelasWajib
    ) {

      if (!kelasMap[namaKelas]) {

        return response(400, {

          success: false,

          message:
            `Kelas "${namaKelas}" tidak ditemukan.`

        });

      }

    }


    // ===================================================
    // MAPPING KENAIKAN
    // ===================================================

    const mapping = {

      "X A":
        "XI A",

      "X B":
        "XI B",

      "XI A":
        "XII A",

      "XI B":
        "XII B",

      "XII A":
        "LULUS",

      "XII B":
        "LULUS"

    };


    // ===================================================
    // AMBIL SISWA AKTIF
    // ===================================================

    const {
      data: siswaRows,
      error: siswaError
    } = await supabase
      .from("siswa")
      .select(`
        id,
        nama,
        kelas_id,
        password,
        status
      `)
      .eq("status", "Aktif");


    if (siswaError) {

      console.error(
        "SUPABASE PROMOTION SISWA ERROR:",
        siswaError
      );

      return response(500, {

        success: false,

        message:
          "Gagal mengambil data siswa."

      });

    }


    // ===================================================
    // TIDAK ADA SISWA
    // ===================================================

    if (
      !siswaRows ||
      siswaRows.length === 0
    ) {

      return response(200, {

        success: true,

        message:
          "Tidak ada siswa aktif yang perlu diproses.",

        diproses: 0,

        naik: 0,

        lulus: 0

      });

    }


    // ===================================================
    // HASIL
    // ===================================================

    let naik = 0;

    let lulus = 0;

    let diproses = 0;


    // ===================================================
    // TIMESTAMP RIWAYAT
    // ===================================================

    const timestamp =
      Date.now();


    // ===================================================
    // TANGGAL
    // =====================================================

    const tanggal =
      new Date()
        .toLocaleDateString(
          "id-ID",
          {
            timeZone:
              "Asia/Jakarta"
          }
        );


    // ===================================================
    // DATA UPDATE SISWA
    // ===================================================

    const updateSiswa = [];

    const riwayatRows = [];


    // ===================================================
    // PROSES SISWA
    // ===================================================

    for (
      let i = 0;
      i < siswaRows.length;
      i++
    ) {

      const siswa =
        siswaRows[i];


      const siswaId =
        String(
          siswa.id || ""
        ).trim();


      const kelasId =
        String(
          siswa.kelas_id || ""
        ).trim();


      // =================================================
      // ID WAJIB
      // =================================================

      if (!siswaId) {
        continue;
      }


      // =================================================
      // CARI NAMA KELAS LAMA
      // =================================================

      let kelasLama = null;


      for (
        const namaKelas of kelasWajib
      ) {

        if (
          kelasMap[namaKelas] ===
          kelasId
        ) {

          kelasLama =
            namaKelas;

          break;
        }

      }


      // =================================================
      // KELAS TIDAK TERMASUK X/XI/XII
      // =================================================

      if (!kelasLama) {
        continue;
      }


      const kelasBaru =
        mapping[kelasLama];


      // =================================================
      // XII → LULUS
      // =================================================

      if (
        kelasBaru ===
        "LULUS"
      ) {

        // -----------------------------------------------
        // UPDATE STATUS SISWA
        // -----------------------------------------------

        updateSiswa.push({

          id:
            siswaId,

          kelas_id:
            null,

          status:
            "Lulus"

        });


        // -----------------------------------------------
        // RIWAYAT
        // -----------------------------------------------

        riwayatRows.push({

          id:
            `RK${timestamp}${i}`,

          siswa_id:
            siswaId,

          dari_kelas_id:
            kelasId,

          ke_kelas_id:
            null,

          keterangan:
            "Lulus",

          tanggal,

          dilakukan_oleh:
            admin

        });


        lulus++;

        diproses++;

        continue;

      }


      // =================================================
      // CARI KELAS TUJUAN
      // =================================================

      const kelasBaruId =
        kelasMap[kelasBaru];


      if (!kelasBaruId) {

        return response(400, {

          success: false,

          message:
            `Kelas tujuan "${kelasBaru}" tidak ditemukan.`

        });

      }


      // =================================================
      // UPDATE SISWA
      // =================================================

      updateSiswa.push({

        id:
          siswaId,

        kelas_id:
          kelasBaruId

      });


      // =================================================
      // RIWAYAT KENAIKAN
      // =================================================

      riwayatRows.push({

        id:
          `RK${timestamp}${i}`,

        siswa_id:
          siswaId,

        dari_kelas_id:
          kelasId,

        ke_kelas_id:
          kelasBaruId,

        keterangan:
          "Kenaikan Kelas",

        tanggal,

        dilakukan_oleh:
          admin

      });


      naik++;

      diproses++;

    }


    // ===================================================
    // UPDATE SISWA
    //
    // Supabase tidak punya batchUpdate seperti Sheets.
    // Kita lakukan update satu per satu.
    // ===================================================

    for (
      const siswa of updateSiswa
    ) {

      const updateData = {

        kelas_id:
          siswa.kelas_id

      };


      // Lulus → status menjadi Lulus
      if (
        siswa.status ===
        "Lulus"
      ) {

        updateData.status =
          "Lulus";

      }


      const {
        error: updateError
      } = await supabase
        .from("siswa")
        .update(updateData)
        .eq("id", siswa.id);


      if (updateError) {

        console.error(
          "SUPABASE PROMOTION UPDATE SISWA ERROR:",
          updateError
        );

        return response(500, {

          success: false,

          message:
            "Gagal memperbarui data siswa."

        });

      }

    }


    // ===================================================
    // SIMPAN RIWAYAT
    //
    // Semua riwayat dikirim sekaligus.
    // ===================================================

    if (
      riwayatRows.length > 0
    ) {

      const {
        error: riwayatError
      } = await supabase
        .from("riwayat_kelas")
        .insert(
          riwayatRows
        );


      if (riwayatError) {

        console.error(
          "SUPABASE PROMOTION RIWAYAT ERROR:",
          riwayatError
        );

        return response(500, {

          success: false,

          message:
            "Siswa berhasil diperbarui, tetapi riwayat kenaikan gagal disimpan."

        });

      }

    }


    // ===================================================
    // HASIL
    // ===================================================

    return response(200, {

      success: true,

      message:
        "Kenaikan kelas berhasil diproses.",

      diproses,

      naik,

      lulus

    });


  } catch (error) {

    console.error(
      "PROMOTION ERROR:",
      error
    );


    return response(500, {

      success: false,

      message:
        error.message ||
        "Gagal memproses kenaikan kelas."

    });

  }

};
