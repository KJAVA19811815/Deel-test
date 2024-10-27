const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./model");
const { getProfile } = require("./middleware/getProfile");
const app = express();
app.use(bodyParser.json());
app.set("sequelize", sequelize);
app.set("models", sequelize.models);
const { Op } = require("sequelize");

/**
 * FIX ME!
 * @returns contract by id
 */
app.get("/contracts/:id", getProfile, async (req, res) => {
  const { Contract } = req.app.get("models");
  const { id } = req.params;
  const { profile } = req;

  try {
    // Find the contract and ensure it belongs to the profile making the request
    const contract = await Contract.findOne({
      where: { id, ClientId: profile.id },
    });

    if (!contract) return res.status(404).end();

    res.json(contract);
  } catch (error) {
    console.error("Error fetching contract:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = app;
