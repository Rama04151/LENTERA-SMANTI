const supabase = require("./_supabase");

exports.handler = async function () {
  try {
    console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
    console.log(
      "SUPABASE_SERVICE_ROLE_KEY tersedia:",
      !!process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("kelas")
      .select("id, nama_kelas, tingkat, status")
      .limit(10);

    if (error) {
      console.error("Supabase response error:", error);

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        },
        body: JSON.stringify({
          success: false,
          type: "supabase_response_error",
          error: error.message,
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null
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
    console.error("FULL ERROR:", error);
    console.error("CAUSE:", error.cause);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        success: false,
        type: "connection_error",
        error: error.message,
        cause: error.cause
          ? {
              name: error.cause.name,
              message: error.cause.message,
              code: error.cause.code,
              errno: error.cause.errno,
              syscall: error.cause.syscall,
              hostname: error.cause.hostname
            }
          : null
      })
    };
  }
};
