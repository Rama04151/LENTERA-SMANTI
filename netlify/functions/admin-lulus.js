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


exports.handler = async function(event) {

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


    /*
     * ==========================================
     * DUKUNG MULTIPLE ID
     * ==========================================
     */

    let siswaIds =
      Array.isArray(
        body.siswaIds
      )
        ? body.siswaIds
        : [];


    /*
     * Bersihkan ID
     */

    siswaIds =
      [...new Set(
        siswaIds
          .map(
            id =>
              String(id || "").trim()
          )
          .filter(Boolean)
      )];


    if (
      siswaIds.length === 0
    ) {

      return response(400, {

        success: false,

        message:
          "Tidak ada siswa yang dipilih."

      });

    }


    /*
     * Batasi jumlah untuk
     * menghindari request tidak wajar.
     *
     * Bisa dinaikkan kalau diperlukan.
     */

    if (
      siswaIds.length > 500
    ) {

      return response(400, {

        success: false,

        message:
          "Maksimal 500 siswa sekali hapus."

      });

    }


    /*
     * ==========================================
     * AMBIL SEMUA SISWA
     * ==========================================
     */

    const {
      data: siswaList,
      error: siswaError
    } = await supabase

      .from("siswa")

      .select(`
        id,
        nisn,
        nama,
        status
      `)

      .in(
        "id",
        siswaIds
      );


    if (siswaError) {
      throw siswaError;
    }


    /*
     * ==========================================
     * CEK SEMUA ID DITEMUKAN
     * ==========================================
     */

    const foundIds =
      new Set(
        (siswaList || [])
          .map(
            siswa =>
              String(siswa.id)
          )
      );


    const missingIds =
      siswaIds.filter(
        id =>
          !foundIds.has(
            String(id)
          )
      );


    if (
      missingIds.length > 0
    ) {

      return response(404, {

        success: false,

        message:
          "Sebagian siswa tidak ditemukan.",

        missingIds

      });

    }


    /*
     * ==========================================
     * PENGAMAN PALING PENTING
     *
     * SEMUA harus LULUS.
     * Kalau ada SATU saja yang bukan Lulus,
     * seluruh operasi dibatalkan.
     * ==========================================
     */

    const nonLulus =
      siswaList.filter(
        siswa =>
          String(
            siswa.status || ""
          )
          .trim()
          .toLowerCase() !==
          "lulus"
      );


    if (
      nonLulus.length > 0
    ) {

      return response(403, {

        success: false,

        message:
          "Penghapusan ditolak. " +
          "Semua siswa yang dipilih harus berstatus Lulus.",

        siswaDitolak:
          nonLulus.map(
            siswa => ({
              id: siswa.id,
              nama: siswa.nama,
              status: siswa.status
            })
          )

      });

    }


    /*
     * ==========================================
     * AMBIL NISN
     * ==========================================
     */

    const nisns =
      siswaList.map(
        siswa =>
          siswa.nisn
      );


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

      .in(
        "nisn",
        nisns
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

      .in(
        "siswa_id",
        siswaIds
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

      .in(
        "siswa_id",
        siswaIds
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

      .in(
        "siswa_id",
        siswaIds
      );


    if (riwayatError) {
      throw riwayatError;
    }


    /*
     * ==========================================
     * TERAKHIR:
     * HAPUS DATA SISWA
     * ==========================================
     */

    const {
      error: deleteError
    } = await supabase

      .from("siswa")

      .delete()

      .in(
        "id",
        siswaIds
      );


    if (deleteError) {
      throw deleteError;
    }


    /*
     * ==========================================
     * BERHASIL
     * ==========================================
     */

    const names =
      siswaList.map(
        siswa =>
          siswa.nama
      );


    return response(200, {

      success: true,

      deleted:
        siswaIds.length,

      message:
        siswaIds.length +
        " data siswa Lulus berhasil dihapus permanen beserta seluruh data terkait.",

      siswa:
        names

    });


  } catch(error) {

    console.error(
      "ADMIN LULUS DELETE ERROR:",
      error
    );


    return response(500, {

      success: false,

      message:
        "Gagal menghapus data siswa Lulus.",

      error:
        error.message

    });

  }

};
