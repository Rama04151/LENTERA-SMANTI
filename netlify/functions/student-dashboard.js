const supabase = require("./_supabase");

exports.handler = async (event) => {

  // =========================
  // HANYA MENERIMA POST
  // =========================
  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan"
    });
  }

  try {

    const { siswaId } =
      JSON.parse(event.body || "{}");

    if (!siswaId) {
      return response(400, {
        success: false,
        message: "Siswa ID wajib diisi"
      });
    }

    const targetSiswaId =
      String(siswaId).trim();

    // =========================
    // AMBIL DATA POIN SISWA
    // =========================

    const {
      data: poinData,
      error
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
      .eq("siswa_id", targetSiswaId)
      .order("tanggal", {
        ascending: false
      });

    if (error) {

      console.error(
        "SUPABASE STUDENT DASHBOARD ERROR:",
        error
      );

      return response(500, {
        success: false,
        message: "Data poin gagal dimuat"
      });
    }

    // =========================
    // HITUNG TOTAL
    // =========================

    let totalPenghargaan = 0;
    let totalPelanggaran = 0;

    const riwayatPoin = [];

    for (const row of poinData || []) {

      const jenis =
        String(row.jenis || "")
          .trim()
          .toLowerCase();

      const poin =
        Number(row.poin || 0);

      if (jenis === "penghargaan") {
        totalPenghargaan += poin;
      }

      if (jenis === "pelanggaran") {
        totalPelanggaran += poin;
      }

      riwayatPoin.push({

        id:
          row.id,

        jenis,

        poin,

        keterangan:
          row.keterangan || "",

        tanggal:
          row.tanggal || "",

        admin:
          row.dibuat_oleh || ""

      });
    }

    // =========================
    // RESPONSE
    // =========================

    return response(200, {

      success: true,

      poin: {

        penghargaan:
          totalPenghargaan,

        pelanggaran:
          totalPelanggaran

      },

      riwayat:
        riwayatPoin

    });

  } catch (error) {

    console.error(
      "STUDENT DASHBOARD ERROR:",
      error
    );

    return response(500, {

      success: false,

      message:
        "Data poin gagal dimuat"

    });
  }
};


// =========================
// RESPONSE HELPER
// =========================

function response(
  statusCode,
  body
) {

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
