import { Router } from "express";
import * as authService from "./Services/auth.service.js";
import { validateSignUp } from "../../Middlewares/auth.middleware.js";
import { errorHandler } from './../../Middlewares/error-handler.middleware.js';
import { passwordResetLimiter } from "../../Middlewares/rateLimiter.middleware.js";

const authController = Router();

// Authentication endpoints with general rate limiting (applied in main.js)
authController.post("/signup", validateSignUp, errorHandler(authService.signUp));
authController.post("/signin", errorHandler(authService.signIn));
authController.post("/gmail-login", errorHandler(authService.GmailLoginService));
authController.post("/gmail-signup", errorHandler(authService.GmailRegistrationService));

// Password reset endpoints with stricter rate limiting
authController.post("/forgot-password", passwordResetLimiter, errorHandler(authService.forgotPassword));
authController.post("/reset-password", passwordResetLimiter, errorHandler(authService.resetPassword));

export default authController;
