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

exports.handler = async function (event) {

  // ============================================================
  // CEK METHOD
  // ============================================================

  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan."
    });
  }

  try {

    const {
      siswaId
    } = JSON.parse(
      event.body || "{}"
    );

    if (!siswaId) {
      return response(400, {
        success: false,
        message:
          "Siswa ID wajib diisi."
      });
    }

    const targetSiswaId =
      String(
        siswaId
      ).trim();

    // ============================================================
    // AMBIL INBOX SISWA
    // ============================================================

    const now =
      new Date().toISOString();

    const {
      data: rows,
      error
    } = await supabase
      .from("inbox")
      .select(`
        id,
        siswa_id,
        judul,
        pesan,
        dibuat,
        kedaluwarsa,
        dibuat_oleh,
        status
      `)
      .eq(
        "siswa_id",
        targetSiswaId
      )
      .eq(
        "status",
        "Aktif"
      )
      .gt(
        "kedaluwarsa",
        now
      )
      .order(
        "dibuat",
        {
          ascending: false
        }
      );

    if (error) {
      console.error(
        "SUPABASE STUDENT INBOX ERROR:",
        error
      );

      return response(500, {
        success: false,
        message:
          "Gagal mengambil inbox.",
        error:
          error.message
      });
    }

    // ============================================================
    // BENTUK RESPONSE
    // ============================================================

    const inbox =
      (rows || []).map(row => ({
        id:
          String(
            row.id || ""
          ).trim(),

        judul:
          String(
            row.judul || ""
          ).trim(),

        pesan:
          String(
            row.pesan || ""
          ).trim(),

        dibuat:
          row.dibuat || "",

        kedaluwarsa:
          row.kedaluwarsa || "",

        admin:
          String(
            row.dibuat_oleh || ""
          ).trim()
      }));

    // ============================================================
    // RESPONSE
    // ============================================================

    return response(200, {
      success: true,
      inbox
    });

  } catch (error) {

    console.error(
      "STUDENT INBOX ERROR:",
      error
    );

    return response(500, {
      success: false,
      message:
        "Gagal mengambil inbox.",
      error:
        error.message
    });
  }
};
