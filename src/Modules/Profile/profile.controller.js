import { Router } from "express";
import * as profileServices from "./Services/profile.service.js"
import { authenticate } from "../../Middlewares/auth.middleware.js";
import { errorHandler } from "../../Middlewares/error-handler.middleware.js";


const profileController = Router();



profileController.get('/',authenticate ,errorHandler(profileServices.getProfile));


export default profileController;