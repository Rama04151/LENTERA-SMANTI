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
    // REQUEST
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
      `)
      .order("id", {
        ascending: true
      });


    if (kelasError) {

      console.error(
        "SUPABASE PROMOTION KELAS ERROR:",
        kelasError
      );

      return response(500, {

        success: false,

        message:
          "Gagal mengambil data kelas.",

        error:
          kelasError.message

      });

    }


    // ===================================================
    // VALIDASI DATA KELAS
    // ===================================================

    if (
      !kelasRows ||
      kelasRows.length === 0
    ) {

      return response(400, {

        success: false,

        message:
          "Data kelas tidak ditemukan."

      });

    }


    // ===================================================
    // MAP KELAS
    // ===================================================

    const kelasMap = {};


    for (const row of kelasRows) {

      const id =
        String(
          row.id || ""
        ).trim();

      const nama =
        String(
          row.nama_kelas || ""
        ).trim();


      if (!id || !nama) {
        continue;
      }


      kelasMap[nama] = id;

    }


    // ===================================================
    // KELAS YANG DIGUNAKAN
    // ===================================================

    const kelasWajib = [

      "X A",
      "X B",

      "XI A",
      "XI B",

      "XII A",
      "XII B"

    ];


    // ===================================================
    // VALIDASI SEMUA KELAS
    // ===================================================

    for (const namaKelas of kelasWajib) {

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
          "Gagal mengambil data siswa.",

        error:
          siswaError.message

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
    // DAFTAR UPDATE
    // ===================================================

    const siswaNaik = [];

    const siswaLulus = [];


    let naik = 0;

    let lulus = 0;


    // ===================================================
    // TENTUKAN SISWA YANG AKAN DIPROSES
    //
    // PENTING:
    // Daftar ini dibuat SEBELUM melakukan update.
    //
    // Jadi siswa X yang dipindahkan ke XI tidak akan
    // diproses lagi menjadi XII dalam proses yang sama.
    // ===================================================

    for (const siswa of siswaRows) {

      const siswaId =
        String(
          siswa.id || ""
        ).trim();


      const kelasId =
        String(
          siswa.kelas_id || ""
        ).trim();


      if (!siswaId) {
        continue;
      }


      // =================================================
      // CARI KELAS SISWA
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
      // JIKA BUKAN KELAS X/XI/XII
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
        kelasBaru === "LULUS"
      ) {

        siswaLulus.push({

          id:
            siswaId

        });


        lulus++;

        continue;

      }


      // =================================================
      // CARI ID KELAS TUJUAN
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
      // SIMPAN DAFTAR SISWA YANG AKAN NAIK
      // =================================================

      siswaNaik.push({

        id:
          siswaId,

        kelasIdBaru:
          kelasBaruId

      });


      naik++;

    }


    // ===================================================
    // UPDATE SISWA YANG NAIK
    //
    // Berdasarkan ID siswa.
    //
    // BUKAN berdasarkan kelas_id.
    //
    // Ini mencegah siswa lompat kelas.
    // ===================================================

    for (const siswa of siswaNaik) {

      const {
        error: updateError
      } = await supabase
        .from("siswa")
        .update({

          kelas_id:
            siswa.kelasIdBaru

        })
        .eq("id", siswa.id)
        .eq("status", "Aktif");


      if (updateError) {

        console.error(
          "SUPABASE PROMOTION UPDATE ERROR:",
          updateError
        );

        return response(500, {

          success: false,

          message:
            `Gagal menaikkan siswa ${siswa.id}.`,

          error:
            updateError.message

        });

      }

    }


    // ===================================================
    // UPDATE SISWA XII → LULUS
    //
    // kelas_id TETAP.
    //
    // Hanya status yang berubah menjadi Lulus.
    // ===================================================

    if (
      siswaLulus.length > 0
    ) {

      const siswaLulusIds =
        siswaLulus.map(
          siswa => siswa.id
        );


      const {
        error: lulusError
      } = await supabase
        .from("siswa")
        .update({

          status:
            "Lulus"

        })
        .in(
          "id",
          siswaLulusIds
        );


      if (lulusError) {

        console.error(
          "SUPABASE LULUS ERROR:",
          lulusError
        );

        return response(500, {

          success: false,

          message:
            "Gagal memproses siswa yang lulus.",

          error:
            lulusError.message

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

      diproses:
        naik + lulus,

      naik,

      lulus

    });

  }

  catch (error) {

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
