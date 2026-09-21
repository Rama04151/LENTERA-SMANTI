const { google } = require("googleapis");

exports.handler = async function () {

  try {

    // =========================
    // GOOGLE AUTH
    // =========================

    const privateKey =
      process.env.GOOGLE_PRIVATE_KEY
        .replace(/\\n/g, "\n")
        .replace(/^"|"$/g, "");

    const auth =
      new google.auth.GoogleAuth({
        credentials: {
          client_email:
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,

          private_key:
            privateKey
        },

        scopes: [
          "https://www.googleapis.com/auth/spreadsheets"
        ]
      });

    const sheets =
      google.sheets({
        version: "v4",
        auth
      });

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID;

    // =========================
    // AMBIL DATA INBOX
    // =========================

    const response =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Inbox!A:H"
      });

    const rows =
      response.data.values || [];

    if (rows.length <= 1) {

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          deleted: 0,
          message:
            "Tidak ada pesan untuk dibersihkan."
        })
      };

    }

    const now =
      new Date();

    const rowsToDelete = [];

    // =========================
    // CARI PESAN EXPIRED
    // =========================

    for (
      let i = 1;
      i < rows.length;
      i++
    ) {

      const row = rows[i];

      const expiredAt =
        String(row[5] || "").trim();

      if (!expiredAt) {
        continue;
      }

      const expiryDate =
        new Date(expiredAt);

      if (
        Number.isNaN(
          expiryDate.getTime()
        )
      ) {
        continue;
      }

      if (expiryDate <= now) {

        // Nomor baris Google Sheets
        rowsToDelete.push(i + 1);

      }

    }

    // Tidak ada pesan expired
    if (
      rowsToDelete.length === 0
    ) {

      return {
        statusCode: 200,

        body: JSON.stringify({
          success: true,
          deleted: 0,
          message:
            "Tidak ada pesan kedaluwarsa."
        })
      };

    }

    // =========================
    // AMBIL SHEET ID
    // =========================

    const spreadsheet =
      await sheets.spreadsheets.get({
        spreadsheetId,

        fields:
          "sheets(properties(sheetId,title))"
      });

    const inboxSheet =
      spreadsheet.data.sheets.find(
        sheet =>
          sheet.properties.title ===
          "Inbox"
      );

    if (!inboxSheet) {

      throw new Error(
        'Sheet "Inbox" tidak ditemukan.'
      );

    }

    const sheetId =
      inboxSheet.properties.sheetId;

    // =========================
    // HAPUS DARI BAWAH
    // =========================

    const requests =
      rowsToDelete
        .sort((a, b) => b - a)
        .map(rowNumber => ({

          deleteDimension: {

            range: {

              sheetId,

              dimension: "ROWS",

              startIndex:
                rowNumber - 1,

              endIndex:
                rowNumber

            }

          }

        }));

    await sheets.spreadsheets.batchUpdate({

      spreadsheetId,

      requestBody: {
        requests
      }

    });

    return {

      statusCode: 200,

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        success: true,

        deleted:
          rowsToDelete.length,

        message:
          `${rowsToDelete.length} pesan kedaluwarsa berhasil dihapus.`

      })

    };

  }
  catch (error) {

    console.error(
      "CLEANUP INBOX ERROR:",
      error
    );

    return {

      statusCode: 500,

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        success: false,

        message:
          "Gagal membersihkan inbox.",

        error:
          error.message

      })

    };

  }

};
