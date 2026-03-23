import { validationResult } from "express-validator";

/**
 * Standardized validation middleware that catches `express-validator` errors 
 * and returns a strict 400 Bad Request before hitting business logic.
 */
export const validateStrict = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn(`[Security] Dropping request from IP ${req.ip} due to strict validation failure:`, errors.array());
    return res.status(400).json({ 
      error: "Strict validation failed. Malicious or invalid payload detected.", 
      details: errors.array() 
    });
  }
  next();
};
