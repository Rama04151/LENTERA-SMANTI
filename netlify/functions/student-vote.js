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

function clean(value) {
  return String(value || "").trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan."
    });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const siswaId = clean(body.siswaId);
    const aksi = clean(body.aksi);

    if (!siswaId) {
      return response(400, {
        success: false,
        message: "Identitas siswa tidak ditemukan."
      });
    }

    // =================================================
    // VALIDASI SISWA
    // =================================================

    const { data: siswa, error: siswaError } = await supabase
      .from("siswa")
      .select("id,nama,status")
      .eq("id", siswaId)
      .maybeSingle();

    if (siswaError) {
      console.error("STUDENT VOTE STUDENT:", siswaError);

      return response(500, {
        success: false,
        message: "Gagal memeriksa akun siswa."
      });
    }

    if (
      !siswa ||
      String(siswa.status || "").toLowerCase() !== "aktif"
    ) {
      return response(403, {
        success: false,
        message: "Akun siswa tidak aktif atau tidak ditemukan."
      });
    }

    // =================================================
    // AMBIL EVENT AKTIF
    // =================================================

    if (aksi === "list") {
      const { data: events, error: eventError } = await supabase
        .from("vote_events")
        .select("*")
        .eq("status", "Aktif")
        .order("dibuat", { ascending: false });

      if (eventError) {
        console.error("STUDENT VOTE EVENTS:", eventError);

        return response(500, {
          success: false,
          message: "Gagal mengambil event voting."
        });
      }

      if (!events || events.length === 0) {
        return response(200, {
          success: true,
          events: []
        });
      }

      const eventIds = events.map(item => item.id);

      const { data: options, error: optionError } = await supabase
        .from("vote_options")
        .select("id,event_id,nama_opsi,urutan")
        .in("event_id", eventIds)
        .order("urutan", { ascending: true });

      if (optionError) {
        console.error("STUDENT VOTE OPTIONS:", optionError);

        return response(500, {
          success: false,
          message: "Gagal mengambil opsi voting."
        });
      }

      const { data: myVotes, error: myVoteError } = await supabase
        .from("vote_votes")
        .select("id,event_id,option_id")
        .eq("siswa_id", siswaId)
        .in("event_id", eventIds);

      if (myVoteError) {
        console.error("STUDENT VOTE MY VOTES:", myVoteError);

        return response(500, {
          success: false,
          message: "Gagal mengambil pilihan siswa."
        });
      }

      const showResultsEventIds = events
        .filter(item => item.tampilkan_hasil_siswa)
        .map(item => item.id);

      let allVotes = [];

      if (showResultsEventIds.length > 0) {
        const { data, error } = await supabase
          .from("vote_votes")
          .select("event_id,option_id")
          .in("event_id", showResultsEventIds);

        if (error) {
          console.error("STUDENT VOTE RESULTS:", error);

          return response(500, {
            success: false,
            message: "Gagal mengambil hasil voting."
          });
        }

        allVotes = data || [];
      }

      const result = events.map(ev => {
        const eventOptions = (options || [])
          .filter(op => String(op.event_id) === String(ev.id))
          .map(op => {
            const selected = (myVotes || []).some(
              vote => String(vote.option_id) === String(op.id)
            );

            let jumlahSuara = null;

            if (ev.tampilkan_hasil_siswa) {
              jumlahSuara = allVotes.filter(
                vote =>
                  String(vote.event_id) === String(ev.id) &&
                  String(vote.option_id) === String(op.id)
              ).length;
            }

            return {
              id: op.id,
              namaOpsi: op.nama_opsi,
              urutan: op.urutan,
              dipilih: selected,
              jumlahSuara
            };
          });

        const pilihanSaya = (myVotes || [])
          .filter(vote => String(vote.event_id) === String(ev.id))
          .map(vote => vote.option_id);

        return {
          id: ev.id,
          judul: ev.judul,
          deskripsi: ev.deskripsi || "",
          bolehPilihBanyak: Boolean(ev.boleh_pilih_banyak),
          bolehGantiPilihan: Boolean(ev.boleh_ganti_pilihan),
          tampilkanHasilSiswa: Boolean(ev.tampilkan_hasil_siswa),
          sudahMemilih: pilihanSaya.length > 0,
          pilihanSaya,
          opsi: eventOptions
        };
      });

      return response(200, {
        success: true,
        events: result
      });
    }

    // =================================================
    // KIRIM / UBAH SUARA
    // =================================================

    if (aksi === "vote") {
      const eventId = clean(body.eventId);

      const optionIds = Array.isArray(body.optionIds)
        ? [...new Set(body.optionIds.map(clean).filter(Boolean))]
        : [];

      if (!eventId) {
        return response(400, {
          success: false,
          message: "Event voting tidak ditemukan."
        });
      }

      if (optionIds.length === 0) {
        return response(400, {
          success: false,
          message: "Pilih minimal satu opsi."
        });
      }

      // -----------------------------------------------
      // PERIKSA EVENT
      // -----------------------------------------------

      const { data: votingEvent, error: eventError } = await supabase
        .from("vote_events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();

      if (eventError) {
        return response(500, {
          success: false,
          message: "Gagal memeriksa event voting."
        });
      }

      if (!votingEvent || votingEvent.status !== "Aktif") {
        return response(403, {
          success: false,
          message: "Voting ini sudah ditutup atau tidak tersedia."
        });
      }

      // -----------------------------------------------
      // PERIKSA MODE PILIHAN
      // -----------------------------------------------

      if (
        !votingEvent.boleh_pilih_banyak &&
        optionIds.length !== 1
      ) {
        return response(400, {
          success: false,
          message: "Event ini hanya mengizinkan satu pilihan."
        });
      }

      // -----------------------------------------------
      // VALIDASI OPSI
      // -----------------------------------------------

      const { data: validOptions, error: validOptionError } =
        await supabase
          .from("vote_options")
          .select("id")
          .eq("event_id", eventId)
          .in("id", optionIds);

      if (validOptionError) {
        return response(500, {
          success: false,
          message: "Gagal memeriksa opsi voting."
        });
      }

      if (!validOptions || validOptions.length !== optionIds.length) {
        return response(400, {
          success: false,
          message: "Ada opsi yang tidak valid."
        });
      }

      // -----------------------------------------------
      // AMBIL PILIHAN LAMA
      // -----------------------------------------------

      const { data: oldVotes, error: oldVoteError } = await supabase
        .from("vote_votes")
        .select("id,option_id")
        .eq("event_id", eventId)
        .eq("siswa_id", siswaId);

      if (oldVoteError) {
        return response(500, {
          success: false,
          message: "Gagal memeriksa pilihan sebelumnya."
        });
      }

      const previousVotes = oldVotes || [];

      // -----------------------------------------------
      // CEK IZIN MENGUBAH PILIHAN
      // -----------------------------------------------

      if (
        previousVotes.length > 0 &&
        !votingEvent.boleh_ganti_pilihan
      ) {
        return response(403, {
          success: false,
          message: "Kamu sudah memilih dan tidak diizinkan mengubah pilihan."
        });
      }

      // -----------------------------------------------
      // SIMPAN PILIHAN BARU
      // -----------------------------------------------

      const oldOptionIds = new Set(
        previousVotes.map(vote => String(vote.option_id))
      );

      const newOptionIds = new Set(optionIds.map(String));

      const optionsToInsert = optionIds
        .filter(id => !oldOptionIds.has(String(id)))
        .map(optionId => ({
          id:
            "VOTE" +
            Date.now() +
            Math.random().toString(36).slice(2, 8),

          event_id: eventId,
          option_id: optionId,
          siswa_id: siswaId
        }));

      if (optionsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("vote_votes")
          .insert(optionsToInsert);

        if (insertError) {
          console.error("STUDENT VOTE INSERT:", insertError);

          return response(500, {
            success: false,
            message: "Gagal menyimpan pilihan voting."
          });
        }
      }

      // -----------------------------------------------
      // HAPUS PILIHAN LAMA YANG TIDAK DIPILIH LAGI
      // -----------------------------------------------

      const votesToDelete = previousVotes
        .filter(vote => !newOptionIds.has(String(vote.option_id)))
        .map(vote => vote.id);

      if (votesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("vote_votes")
          .delete()
          .in("id", votesToDelete);

        if (deleteError) {
          console.error("STUDENT VOTE DELETE OLD:", deleteError);

          return response(500, {
            success: false,
            message: "Pilihan baru tersimpan, tetapi pilihan lama gagal diperbarui."
          });
        }
      }

      return response(200, {
        success: true,
        message: previousVotes.length > 0
          ? "Pilihan voting berhasil diperbarui."
          : "Suara kamu berhasil disimpan.",
        pilihanSaya: optionIds
      });
    }

    return response(400, {
      success: false,
      message: "Aksi voting tidak dikenal."
    });

  } catch (error) {
    console.error("STUDENT VOTE ERROR:", error);

    return response(500, {
      success: false,
      message: "Terjadi kesalahan pada server voting."
    });
  }
};
