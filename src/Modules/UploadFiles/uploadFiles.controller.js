import { Router } from "express";
import * as uploadFiles from "./Services/uploadFiles.service.js";
import { validateJson } from "../../Middlewares/validation.middleware.js";
import { authenticate } from "./../../Middlewares/auth.middleware.js";
import { errorHandler } from "./../../Middlewares/error-handler.middleware.js";

const uploadController = Router();

uploadController.post(
  "/",
  authenticate,
  validateJson,
  errorHandler(uploadFiles.uploadFile)
);
uploadController.post(
  "/version/:fileId",
  authenticate,
  errorHandler(uploadFiles.getFileVersion)
);
uploadController.get(
  "/versions/:fileId",
  authenticate,
  errorHandler(uploadFiles.getAllFileVersions)
);
uploadController.get(
  "/latest/:fileId",
  authenticate,
  errorHandler(uploadFiles.getLatestFileVersion)
);

uploadController.get(
  "/check-uploads",
  authenticate,
  errorHandler(uploadFiles.checkUploadLimit)
);
uploadController.post(
  "/analysis/:fileId",
  authenticate,
  errorHandler(uploadFiles.uploadAnalysis)
);
uploadController.post(
  "/check-refine",
  authenticate,
  errorHandler(uploadFiles.checkRefineLimit)
);
uploadController.get(
  "/check-analysis",
  authenticate,
  errorHandler(uploadFiles.checkAnalysisLimit)
);
uploadController.put(
  "/files/:fileId",
  authenticate,
  validateJson,
  errorHandler(uploadFiles.updateFile)
);
uploadController.get("/", errorHandler(uploadFiles.getAllContracts));
uploadController.get("/user-files", authenticate, errorHandler(uploadFiles.getUserFiles));
uploadController.get("/versions-count/:fileId", authenticate, errorHandler(uploadFiles.getFileVersionsCount));
uploadController.get("/file/:fileId", authenticate, errorHandler(uploadFiles.getFileById));
uploadController.delete("/:id", errorHandler(uploadFiles.deleteFile));
export default uploadController;
