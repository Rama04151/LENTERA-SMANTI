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

  /*
   * HANYA DELETE
   */

  if (
    event.httpMethod !== "DELETE"
  ) {

    return response(405, {
      success: false,
      message: "Method tidak diizinkan."
    });

  }


  try {

    const body =
      JSON.parse(
        event.body || "{}"
      );


    const siswaId =
      String(
        body.siswaId || ""
      ).trim();


    if (!siswaId) {

      return response(400, {
        success: false,
        message: "ID siswa wajib diisi."
      });

    }


    /*
     * ==========================================
     * CARI SISWA
     * ==========================================
     */

    const {
      data: siswa,
      error: siswaError
    } = await supabase

      .from("siswa")

      .select(`
        id,
        nisn,
        nama,
        status
      `)

      .eq(
        "id",
        siswaId
      )

      .maybeSingle();


    if (siswaError) {
      throw siswaError;
    }


    if (!siswa) {

      return response(404, {
        success: false,
        message: "Siswa tidak ditemukan."
      });

    }


    /*
     * ==========================================
     * PENGAMAN UTAMA
     *
     * HANYA LULUS
     * ==========================================
     */

    const status =
      String(
        siswa.status || ""
      )
        .trim()
        .toLowerCase();


    if (
      status !== "lulus"
    ) {

      return response(403, {

        success: false,

        message:
          "Penghapusan ditolak. " +
          "Fitur ini hanya dapat digunakan " +
          "untuk siswa berstatus Lulus."

      });

    }


    /*
     * ==========================================
     * HAPUS LOGIN CONTROL
     * ==========================================
     */

    const {
      error: loginError
    } = await supabase

      .from("login_control")

      .delete()

      .eq(
        "nisn",
        siswa.nisn
      );


    if (loginError) {
      throw loginError;
    }


    /*
     * ==========================================
     * HAPUS POIN
     * ==========================================
     */

    const {
      error: poinError
    } = await supabase

      .from("poin")

      .delete()

      .eq(
        "siswa_id",
        siswaId
      );


    if (poinError) {
      throw poinError;
    }


    /*
     * ==========================================
     * HAPUS INBOX
     * ==========================================
     */

    const {
      error: inboxError
    } = await supabase

      .from("inbox")

      .delete()

      .eq(
        "siswa_id",
        siswaId
      );


    if (inboxError) {
      throw inboxError;
    }


    /*
     * ==========================================
     * HAPUS RIWAYAT KELAS
     * ==========================================
     */

    const {
      error: riwayatError
    } = await supabase

      .from("riwayat_kelas")

      .delete()

      .eq(
        "siswa_id",
        siswaId
      );


    if (riwayatError) {
      throw riwayatError;
    }


    /*
     * ==========================================
     * TERAKHIR:
     * HAPUS SISWA
     * ==========================================
     */

    const {
      error: deleteError
    } = await supabase

      .from("siswa")

      .delete()

      .eq(
        "id",
        siswaId
      );


    if (deleteError) {
      throw deleteError;
    }


    /*
     * ==========================================
     * SELESAI
     * ==========================================
     */

    return response(200, {

      success: true,

      message:
        "Data " +
        siswa.nama +
        " berhasil dihapus permanen beserta seluruh data terkait."

    });


  } catch (error) {

    console.error(
      "ADMIN LULUS DELETE ERROR:",
      error
    );


    return response(500, {

      success: false,

      message:
        "Gagal menghapus data siswa lulus.",

      error:
        error.message

    });

  }

};
