import { Router } from "express";
import * as planService from "./Services/plan.service.js";
import { errorHandler } from './../../Middlewares/error-handler.middleware.js';

const planController = Router();

planController.post("/", errorHandler(planService.addSubscription));
planController.delete("/:id", errorHandler(planService.deleteSubscription));
planController.put("/:id", errorHandler(planService.updateSubscription));
planController.get("/", errorHandler(planService.getAllPlans));  

export default planController;
