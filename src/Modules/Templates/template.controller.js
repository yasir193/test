import { Router } from "express";
import * as templateService from "./Services/template.service.js";
import { errorHandler } from './../../Middlewares/error-handler.middleware.js';

const templateController = Router();

templateController.post("/" , errorHandler(templateService.addTemplate));
templateController.get("/:id", errorHandler(templateService.getSpecificTemplate));
templateController.get("/", errorHandler(templateService.getAllTemplates));

export default templateController;
