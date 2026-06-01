import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api", router);

// Temporary download route - delete after user downloads
app.get("/api/download/source", (_req, res) => {
  const candidates = [
    path.resolve(process.cwd(), "artifacts/ai-proxy-portal/public/source-20260424.tar.gz"),
    path.resolve(process.cwd(), "../../artifacts/ai-proxy-portal/public/source-20260424.tar.gz"),
    "/home/runner/workspace/artifacts/ai-proxy-portal/public/source-20260424.tar.gz",
  ];
  const filePath = candidates.find(p => fs.existsSync(p));
  if (!filePath) { res.status(404).json({ error: "File not found" }); return; }
  const stat = fs.statSync(filePath);
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", "attachment; filename=source-20260424.tar.gz");
  res.setHeader("Content-Length", stat.size);
  fs.createReadStream(filePath).pipe(res);
});

if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(process.cwd(), "artifacts/ai-proxy-portal/dist/public");
  logger.info({ frontendDist }, "Serving frontend static files");
  app.use(express.static(frontendDist));
  app.get(/(.*)/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
