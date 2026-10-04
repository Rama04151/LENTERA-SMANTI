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
// TANGGAL ASIA/JAKARTA
// FORMAT: YYYY-MM-DD
// =====================================================

function getTanggalJakarta() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const map = {};

  for (const part of parts) {
    map[part.type] = part.value;
  }

  return `${map.year}-${map.month}-${map.day}`;
}


// =====================================================
// GENERATE ID RIWAYAT
// =====================================================

function generateRiwayatId(index) {
  return `RK${Date.now()}${index}`;
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
        message: "Gagal mengambil data kelas.",
        error: kelasError.message
      });

    }


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

    for (const row of kelasRows) {

      const id =
        String(row.id || "").trim();

      const nama =
        String(row.nama_kelas || "").trim();

      if (!id || !nama) {
        continue;
      }

      kelasMap[nama] = id;
    }


    // ===================================================
    // VALIDASI KELAS WAJIB
    // ===================================================

    const kelasWajib = [
      "X A",
      "X B",
      "XI A",
      "XI B",
      "XII A",
      "XII B"
    ];


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
        message: "Gagal mengambil data siswa.",
        error: siswaError.message
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
    // DATA HASIL
    // ===================================================

    const riwayatValues = [];

    const siswaNaik = [];

    const siswaLulus = [];

    let naik = 0;

    let lulus = 0;

    let indexRiwayat = 0;

    const tanggal =
      getTanggalJakarta();


    // ===================================================
    // PROSES SISWA
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
      // CARI KELAS LAMA
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
      // BUKAN KELAS X/XI/XII
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

        siswaLulus.push(siswaId);


        riwayatValues.push({

          id:
            generateRiwayatId(
              indexRiwayat++
            ),

          siswa_id:
            siswaId,

          dari_kelas_id:
            kelasId,

          ke_kelas_id:
            "Lulus",

          alasan:
            "Lulus",

          tanggal,

          admin

        });


        lulus++;

        continue;
      }


      // =================================================
      // KELAS TUJUAN
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
      // SISWA NAIK
      // =================================================

      siswaNaik.push({

        id:
          siswaId,

        kelas_id:
          kelasBaruId

      });


      // =================================================
      // RIWAYAT
      // =================================================

      riwayatValues.push({

        id:
          generateRiwayatId(
            indexRiwayat++
          ),

        siswa_id:
          siswaId,

        dari_kelas_id:
          kelasId,

        ke_kelas_id:
          kelasBaruId,

        alasan:
          "Kenaikan Kelas",

        tanggal,

        admin

      });


      naik++;

    }


    // ===================================================
    // UPDATE SISWA NAIK
    //
    // UPDATE PER KELAS.
    //
    // Contoh:
    // K001 → K003
    // Semua siswa K001 dipindahkan sekaligus.
    // ===================================================

    for (
      const [kelasLamaNama, kelasBaruNama]
      of Object.entries(mapping)
    ) {

      if (
        kelasBaruNama === "LULUS"
      ) {
        continue;
      }


      const kelasLamaId =
        kelasMap[kelasLamaNama];

      const kelasBaruId =
        kelasMap[kelasBaruNama];


      const {
        error: updateError
      } = await supabase
        .from("siswa")
        .update({
          kelas_id: kelasBaruId
        })
        .eq("kelas_id", kelasLamaId)
        .eq("status", "Aktif");


      if (updateError) {

        console.error(
          "SUPABASE BULK PROMOTION ERROR:",
          updateError
        );

        return response(500, {

          success: false,

          message:
            `Gagal menaikkan siswa dari ${kelasLamaNama}.`,

          error:
            updateError.message

        });

      }

    }


    // ===================================================
    // UPDATE SISWA XII → LULUS
    //
    // kelas_id TETAP.
    // Hanya status menjadi Lulus.
    // ===================================================

    if (
      siswaLulus.length > 0
    ) {

      const {
        error: lulusError
      } = await supabase
        .from("siswa")
        .update({
          status: "Lulus"
        })
        .in("id", siswaLulus);


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
    // SIMPAN RIWAYAT SEKALIGUS
    // ===================================================

    if (
      riwayatValues.length > 0
    ) {

      const {
        error: riwayatError
      } = await supabase
        .from("riwayat_kelas")
        .insert(
          riwayatValues
        );


      if (riwayatError) {

        console.error(
          "SUPABASE RIWAYAT KELAS ERROR:",
          riwayatError
        );

        return response(500, {

          success: false,

          message:
            "Kenaikan siswa berhasil diproses, tetapi riwayat gagal disimpan.",

          error:
            riwayatError.message

        });

      }

    }


    // ===================================================
    // RESPONSE
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
