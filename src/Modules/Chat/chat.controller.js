import { Router } from "express";
import * as chatService from "./Services/chat.service.js";
import { authenticate } from "./../../Middlewares/auth.middleware.js";
// import { errorHandler } from "../../Middlewares/error-handler.middleware.js";

const chatController = Router();

chatController.post("/start", authenticate, chatService.startChat);
chatController.post("/user", authenticate, chatService.sendUserMessage);
chatController.post("/ai", authenticate, chatService.sendAIMessage);
chatController.get("/:chatId", authenticate, chatService.getChatHistory);

export default chatController;
