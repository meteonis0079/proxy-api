import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import keysRouter from "./keys";
import usageRouter from "./usage";
import proxyRouter from "./proxy";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(keysRouter);
router.use(usageRouter);
router.use(settingsRouter);
router.use(proxyRouter);

export default router;
