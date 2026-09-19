const { google } = require("googleapis");

exports.handler = async (event) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY
          .replace(/\\n/g, "\n")
          .replace(/^"|"$/g, "")
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets.readonly"
      ]
    });

    const sheets = google.sheets({
      version: "v4",
      auth
    });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // TES: hanya membaca 1 baris header
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Poin!A1:F1"
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: true,
        message: "Google Sheets berhasil terhubung",
        data: result.data.values || []
      })
    };

  } catch (error) {
    console.error("GOOGLE SHEETS ERROR:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        success: false,
        message: "Gagal membaca Google Sheets",
        error: error.message
      })
    };
  }
};
