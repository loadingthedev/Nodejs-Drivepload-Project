const express = require("express");
const fs = require("fs");
const app = express();
const multer = require("multer");
const { google } = require("googleapis");
const authData = require("./credentials.json");
const port = 5000 || process.env.PORT;
const path = require("path");

app.set("view engine", "ejs");
app.use(express.static("public"));
app.set("views", path.join(__dirname, "views"));

const oauth2Client = new google.auth.OAuth2(
  authData.web.client_id,
  authData.web.client_secret,
  authData.web.redirect_uris[0]
);
// generate a url that asks permissions for Blogger and Google Calendar scopes
const scopes = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.profile",
];

//multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log(file);
    cb(null, "./files");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage }).single("file");

let isAuthenticated = false;
let uploaded = false;

app.get("/", async (req, res) => {
  if (!isAuthenticated) {
    let url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
    });

    res.render("index", { url });
  } else {
    const oauth2 = google.oauth2({
      version: "v2",
      auth: oauth2Client,
    });

    //userinfo

    const { data } = await oauth2.userinfo.get();
    const { name, picture } = data;
    if (uploaded) {
      res.render("success", { name, picture, success: true });
      uploaded = false;
    } else {
      res.render("success", { name, picture, success: false });
    }
  }
});

app.get("/google/callback", async (req, res) => {
  const code = req.query.code;
  if (code) {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      isAuthenticated = true;
      res.redirect("/");
    } catch (error) {
      console.error(error);
    }
  }
});

app.post("/upload", (req, res) => {
  upload(req, res, function (err) {
    if (err) {
      console.log(error);
    }
    const drive = google.drive({
      version: "v3",
      auth: oauth2Client,
    });
    const filemetadata = {
      name: req.file.filename,
    };
    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };
    drive.files.create(
      {
        requestBody: filemetadata,
        media: media,
        fields: "id",
      },
      (err, file) => {
        if (err) {
          console.log(err);
        } else {
          fs.unlinkSync(req.file.path);
          uploaded = true;
          res.redirect("/");
        }
      }
    );
  });
});

app.get("/logout", (req, res) => {
  isAuthenticated = false;
  res.redirect("/");
});
app.listen(port, () => console.log("start server"));
