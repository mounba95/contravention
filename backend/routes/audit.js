const express = require("express");
const db = require("../db/store");
const { authenticate, requireRole } = require("../middleware/auth");
const { verifyChain } = require("../middleware/audit");

const router = express.Router();

router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  res.json(await db.auditLog.all());
});

router.get("/verify", authenticate, requireRole("admin"), async (req, res) => {
  res.json(await verifyChain());
});

module.exports = router;
