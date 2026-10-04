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

exports.handler = async function () {

  try {

    // ===================================================
    // WAKTU SEKARANG
    // ===================================================

    const now =
      new Date().toISOString();


    // ===================================================
    // HAPUS PESAN KEDALUWARSA
    //
    // Hanya pesan yang:
    // kedaluwarsa <= sekarang
    //
    // yang akan dihapus.
    // ===================================================

    const {
      data: deletedRows,
      error: deleteError
    } = await supabase
      .from("inbox")
      .delete()
      .lte("kedaluwarsa", now)
      .select("id");


    if (deleteError) {

      console.error(
        "SUPABASE CLEANUP INBOX ERROR:",
        deleteError
      );

      return response(500, {

        success: false,

        message:
          "Gagal membersihkan inbox.",

        error:
          deleteError.message

      });

    }


    // ===================================================
    // JUMLAH PESAN YANG DIHAPUS
    // ===================================================

    const deleted =
      deletedRows?.length || 0;


    // ===================================================
    // TIDAK ADA PESAN EXPIRED
    // ===================================================

    if (deleted === 0) {

      return response(200, {

        success: true,

        deleted: 0,

        message:
          "Tidak ada pesan kedaluwarsa."

      });

    }


    // ===================================================
    // BERHASIL
    // ===================================================

    return response(200, {

      success: true,

      deleted,

      message:
        `${deleted} pesan kedaluwarsa berhasil dihapus.`

    });

  }

  catch (error) {

    console.error(
      "CLEANUP INBOX ERROR:",
      error
    );

    return response(500, {

      success: false,

      message:
        "Gagal membersihkan inbox.",

      error:
        error.message

    });

  }

};
