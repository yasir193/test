import { Router } from "express";
import * as userService from "./Services/user.service.js";
import { validateUser } from "../../Middlewares/addUser.middleware.js";
import { authenticate } from "../../Middlewares/auth.middleware.js";
import { errorHandler } from './../../Middlewares/error-handler.middleware.js';

const userController = Router();

userController.post("/", validateUser ,errorHandler(userService.addUser));
userController.post("/change-plan", authenticate ,errorHandler(userService.requestToChangePlan));
userController.patch("/:id", errorHandler(userService.updateUser));
userController.delete("/:id", errorHandler(userService.deleteUser));
userController.get("/:id/plan", errorHandler(userService.getUserPlan));
userController.get("/", errorHandler(userService.getAllUsers));

export default userController;