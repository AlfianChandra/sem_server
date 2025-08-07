import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import appRoutes from "./routes/app.routes.js";
import { useAuthVerifier } from "./middlewares/auth.js";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(useAuthVerifier);
app.use("/api", appRoutes);
export default app;
