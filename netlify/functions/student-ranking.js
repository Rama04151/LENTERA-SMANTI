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
  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan."
    });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const siswaId = String(body.siswaId || "").trim();

    if (!siswaId) {
      return response(400, {
        success: false,
        message: "ID siswa wajib diisi."
      });
    }

    const {
      data: currentStudent,
      error: currentStudentError
    } = await supabase
      .from("siswa")
      .select("id, nama, kelas_id, status")
      .eq("id", siswaId)
      .maybeSingle();

    if (currentStudentError) {
      throw currentStudentError;
    }

    if (!currentStudent) {
      return response(404, {
        success: false,
        message: "Siswa tidak ditemukan."
      });
    }

    if (
      String(currentStudent.status || "")
        .trim()
        .toLowerCase() !== "aktif"
    ) {
      return response(403, {
        success: false,
        message: "Ranking hanya tersedia untuk siswa aktif."
      });
    }

    const {
      data: activeStudents,
      error: studentsError
    } = await supabase
      .from("siswa")
      .select("id, kelas_id")
      .eq("status", "Aktif");

    if (studentsError) {
      throw studentsError;
    }

    const students = Array.isArray(activeStudents)
      ? activeStudents
      : [];

    const studentIds = students.map(
      student => student.id
    );

    if (!studentIds.length) {
      return response(200, {
        success: true,
        rankSekolah: 1,
        totalSekolah: 0,
        rankKelas: 1,
        totalKelas: 0,
        poinBersih: 0
      });
    }

    const {
      data: pointRows,
      error: pointsError
    } = await supabase
      .from("poin")
      .select("siswa_id, jenis, poin")
      .in("siswa_id", studentIds);

    if (pointsError) {
      throw pointsError;
    }

    const netPoints = {};

    students.forEach(student => {
      netPoints[String(student.id)] = 0;
    });

    (pointRows || []).forEach(point => {
      const id = String(point.siswa_id);

      if (!(id in netPoints)) {
        return;
      }

      const value =
        Math.abs(Number(point.poin) || 0);

      const jenis =
        String(point.jenis || "")
          .trim()
          .toLowerCase();

      if (jenis === "penghargaan") {
        netPoints[id] += value;
      } else {
        netPoints[id] -= value;
      }
    });

    const currentId =
      String(currentStudent.id);

    const currentNet =
      netPoints[currentId] || 0;

    const rankSekolah =
      1 +
      students.filter(student =>
        (netPoints[String(student.id)] || 0) >
        currentNet
      ).length;

    const classmates =
      students.filter(student =>
        String(student.kelas_id) ===
        String(currentStudent.kelas_id)
      );

    const rankKelas =
      1 +
      classmates.filter(student =>
        (netPoints[String(student.id)] || 0) >
        currentNet
      ).length;

    return response(200, {
      success: true,
      rankSekolah,
      totalSekolah: students.length,
      rankKelas,
      totalKelas: classmates.length,
      poinBersih: currentNet
    });

  } catch (error) {
    console.error(
      "STUDENT RANKING ERROR:",
      error
    );

    return response(500, {
      success: false,
      message: "Gagal menghitung ranking siswa.",
      error: error.message
    });
  }
};
