const supabase = require("./_supabase");

exports.handler = async function () {
  try {
    const { data, error } = await supabase
      .from("kelas")
      .select("id, nama_kelas, tingkat, status")
      .limit(10);

    if (error) {
      console.error("Supabase error:", error);

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          success: false,
          message: "Gagal terhubung ke Supabase.",
          error: error.message
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        success: true,
        message: "Koneksi Supabase berhasil!",
        jumlahData: data.length,
        kelas: data
      })
    };

  } catch (error) {
    console.error("Function error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: false,
        message: "Terjadi kesalahan pada Netlify Function.",
        error: error.message
      })
    };
  }
};