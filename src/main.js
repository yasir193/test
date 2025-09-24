import express from "express";
import { config } from "dotenv";
import { database_connection } from "./DB/connection.js";
config();
import userController from "./Modules/User/user.controller.js";
import authController from "./Modules/Auth/auth.controller.js";
import planController from "./Modules/Plan/plan.controller.js";
import adminController from "./Modules/Admin/admin.controller.js";
import uploadController from "./Modules/UploadFiles/uploadFiles.controller.js";
import cors from "cors";
import authAdminController from "./Modules/AuthAdmin/auth-admin.controller.js";
import templateController from "./Modules/Templates/template.controller.js";
import chatController from "./Modules/Chat/chat.controller.js";
import "./utils/mailService.js";
import { globalErrorHandler } from "./Middlewares/error-handler.middleware.js";
import profileController from './Modules/Profile/profile.controller.js';
import helmet from "helmet";
// import { 
//   generalLimiter, 
//   authLimiter, 
//   passwordResetLimiter, 
//   uploadLimiter, 
//   adminLimiter, 
//   profileLimiter 
// } from "./Middlewares/rateLimiter.middleware.js";






export const bootstrap = () => {
  const app = express();
  
  // Apply helmet security middleware first
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // Apply general rate limiting
  // app.use(generalLimiter);

  // Body parsing middleware
  app.use(express.json());
  // app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS configuration
  app.use(cors({
    origin:  "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: false,
  }));

  // Health check endpoint (no rate limiting)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Server is running',
      timestamp: new Date().toISOString()
    });
  });

  // Routes with specific rate limiting
  app.use("/api_db/auth", authController);
  app.use("/api_db/auth-admin", authAdminController);
  app.use("/api_db/upload",  uploadController);
  app.use("/api_db/admin",  adminController);
  app.use("/api_db/profile",  profileController);
  
  // General routes with moderate rate limiting
  app.use("/api_db/template", templateController);
  app.use("/api_db/chat", chatController);
  app.use("/api_db/user", userController);
  app.use("/api_db/plan", planController);

  // Global error handler
  app.use(globalErrorHandler);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      status: 'error',
      message: 'Route not found',
      path: req.originalUrl
    });
  });

  // Connect DB and start server
  database_connection();
  app.listen(process.env.PORT, () => {
    console.log(`🚀 Server running on port ${process.env.PORT}`);
    console.log(`🔒 Security headers enabled`);
    console.log(`⏱️  Rate limiting active`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};
