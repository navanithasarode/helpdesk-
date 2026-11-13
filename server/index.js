require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", require("./routes/api"));
app.use("/api", require("./routes/dashboard"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

mongoose
  .connect(process.env.MONGO_URI)
    .then(async () => {
        console.log("MongoDB connected");
        await require("./services/routerService").seedTeams();
        app.listen(process.env.PORT, () =>
            console.log(`Server running on port ${process.env.PORT}`)
        );
    })
  .catch((err) => console.error("MongoDB connection failed:", err.message));