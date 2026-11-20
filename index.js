const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const Conect = require("./src/db/Connent.js");
const cookieParser = require("cookie-parser");

dotenv.config();

const app = express();
Conect();

app.use(
  cors({
    origin: [process.env.FRONTEND_URL, process.env.FRONTEND_URL_2],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/.well-known/assetlinks.json", (req, res) => {
  const fingerprints = (process.env.APP_SHA256_FINGERPRINTS || "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  res.set("Content-Type", "application/json");
  res.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: process.env.ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
});

app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));

const authRoutes = require("./src/routes/auth.routes.js");
const superAdminRoutes = require("./src/routes/superAdmin.routes.js");

app.use("/api/auth", authRoutes);
app.use("/api/super-admin", superAdminRoutes);

const port = process.env.PORT || 8090;

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});
