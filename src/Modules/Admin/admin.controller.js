import { Router } from "express";
import * as adminService from "./Services/admin.service.js";
import { verifyAdminToken } from "./../../Middlewares/auth-admin.middleware.js";
import { errorHandler } from "./../../Middlewares/error-handler.middleware.js";

const adminController = Router();

adminController.post(
  "/",
  verifyAdminToken,
  errorHandler(adminService.addAdmin)
);
adminController.get(
  "/pending",
  errorHandler(adminService.getPendingPlanRequests)
);
adminController.patch(
  "/approve/:requestId",
  errorHandler(adminService.approvePlanRequest)
);
adminController.patch(
  "/reject/:requestId",
  errorHandler(adminService.rejectPlanRequest)
);
adminController.delete(
  "/:targetId",
  verifyAdminToken,
  errorHandler(adminService.deleteAdmin)
);
adminController.get(
  "/",
  verifyAdminToken,
  errorHandler(adminService.getAllAdmins)
);
adminController.get(
  "/dashboard-stats",
  errorHandler(adminService.dashboardStats)
);
export default adminController;
