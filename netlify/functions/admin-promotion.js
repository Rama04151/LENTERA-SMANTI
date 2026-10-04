```javascript
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
    // AMBIL KELAS
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

      "X A": "XI A",
      "X B": "XI B",

      "XI A": "XII A",
      "XI B": "XII B",

      "XII A": "LULUS",
      "XII B": "LULUS"

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
      .eq(
        "status",
        "Aktif"
      );


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
    // TANGGAL
    // ===================================================

    const tanggal =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "Asia/Jakarta",

          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }
      ).format(
        new Date()
      );


    // ===================================================
    // KELOMPOKKAN SISWA
    // ===================================================

    const kelompok = {

      "X A": [],
      "X B": [],

      "XI A": [],
      "XI B": [],

      "XII A": [],
      "XII B": []

    };


    for (const siswa of siswaRows) {

      const siswaId =
        String(
          siswa.id || ""
        ).trim();

      const kelasId =
        String(
          siswa.kelas_id || ""
        ).trim();

      if (!siswaId || !kelasId) {
        continue;
      }


      for (const namaKelas of kelasWajib) {

        if (
          kelasMap[namaKelas] ===
          kelasId
        ) {

          kelompok[namaKelas].push(
            siswa
          );

          break;
        }

      }

    }


    // ===================================================
    // HITUNG
    // ===================================================

    const jumlahXA =
      kelompok["X A"].length;

    const jumlahXB =
      kelompok["X B"].length;

    const jumlahXIA =
      kelompok["XI A"].length;

    const jumlahXIB =
      kelompok["XI B"].length;

    const jumlahXIIA =
      kelompok["XII A"].length;

    const jumlahXIIB =
      kelompok["XII B"].length;


    const naik =
      jumlahXA +
      jumlahXB +
      jumlahXIA +
      jumlahXIB;


    const lulus =
      jumlahXIIA +
      jumlahXIIB;


    const diproses =
      naik +
      lulus;


    // ===================================================
    // TIDAK ADA YANG DIPROSES
    // ===================================================

    if (diproses === 0) {

      return response(200, {

        success: true,

        message:
          "Tidak ada siswa aktif yang dapat diproses.",

        diproses: 0,

        naik: 0,

        lulus: 0

      });

    }


    // ===================================================
    // RIWAYAT
    // ===================================================

    const riwayatRows = [];

    let riwayatIndex = 0;


    for (const namaKelas of kelasWajib) {

      const daftarSiswa =
        kelompok[namaKelas];

      if (
        !daftarSiswa ||
        daftarSiswa.length === 0
      ) {
        continue;
      }


      const kelasLamaId =
        kelasMap[namaKelas];

      const kelasBaru =
        mapping[namaKelas];

      const kelasBaruId =
        kelasBaru === "LULUS"
          ? null
          : kelasMap[kelasBaru];


      for (const siswa of daftarSiswa) {

        riwayatRows.push({

          id:
            `RK${Date.now()}${riwayatIndex++}`,

          siswa_id:
            siswa.id,

          dari_kelas_id:
            kelasLamaId,

          ke_kelas_id:
            kelasBaruId,

          keterangan:
            kelasBaru === "LULUS"
              ? "Lulus"
              : "Kenaikan Kelas",

          tanggal,

          dilakukan_oleh:
            admin

        });

      }

    }


    // ===================================================
    // UPDATE X A → XI A
    // ===================================================

    if (jumlahXA > 0) {

      const {
        error
      } = await supabase
        .from("siswa")
        .update({
          kelas_id:
            kelasMap["XI A"]
        })
        .eq(
          "kelas_id",
          kelasMap["X A"]
        )
        .eq(
          "status",
          "Aktif"
        );

      if (error) {
        throw error;
      }

    }


    // ===================================================
    // UPDATE X B → XI B
    // ===================================================

    if (jumlahXB > 0) {

      const {
        error
      } = await supabase
        .from("siswa")
        .update({
          kelas_id:
            kelasMap["XI B"]
        })
        .eq(
          "kelas_id",
          kelasMap["X B"]
        )
        .eq(
          "status",
          "Aktif"
        );

      if (error) {
        throw error;
      }

    }


    // ===================================================
    // UPDATE XI A → XII A
    // ===================================================

    if (jumlahXIA > 0) {

      const {
        error
      } = await supabase
        .from("siswa")
        .update({
          kelas_id:
            kelasMap["XII A"]
        })
        .eq(
          "kelas_id",
          kelasMap["XI A"]
        )
        .eq(
          "status",
          "Aktif"
        );

      if (error) {
        throw error;
      }

    }


    // ===================================================
    // UPDATE XI B → XII B
    // ===================================================

    if (jumlahXIB > 0) {

      const {
        error
      } = await supabase
        .from("siswa")
        .update({
          kelas_id:
            kelasMap["XII B"]
        })
        .eq(
          "kelas_id",
          kelasMap["XI B"]
        )
        .eq(
          "status",
          "Aktif"
        );

      if (error) {
        throw error;
      }

    }


    // ===================================================
    // XII A → LULUS
    // ===================================================

    if (jumlahXIIA > 0) {

      const {
        error
      } = await supabase
        .from("siswa")
        .update({
          status: "Lulus"
        })
        .eq(
          "kelas_id",
          kelasMap["XII A"]
        )
        .eq(
          "status",
          "Aktif"
        );

      if (error) {
        throw error;
      }

    }


    // ===================================================
    // XII B → LULUS
    // ===================================================

    if (jumlahXIIB > 0) {

      const {
        error
      } = await supabase
        .from("siswa")
        .update({
          status: "Lulus"
        })
        .eq(
          "kelas_id",
          kelasMap["XII B"]
        )
        .eq(
          "status",
          "Aktif"
        );

      if (error) {
        throw error;
      }

    }


    // ===================================================
    // SIMPAN RIWAYAT SEKALIGUS
    // ===================================================

    if (
      riwayatRows.length > 0
    ) {

      const {
        error
      } = await supabase
        .from("riwayat_kelas")
        .insert(
          riwayatRows
        );

      if (error) {

        console.error(
          "SUPABASE PROMOTION RIWAYAT ERROR:",
          error
        );

        return response(500, {

          success: false,

          message:
            "Kenaikan siswa berhasil diproses, tetapi riwayat gagal disimpan.",

          error:
            error.message

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
```
