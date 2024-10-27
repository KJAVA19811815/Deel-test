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

app.get("/contracts", getProfile, async (req, res) => {
  const { Contract } = req.app.get("models");
  const { profile } = req;

  try {
    // Find contracts where the user is either the client or contractor and status is not 'terminated'
    const contracts = await Contract.findAll({
      where: {
        status: {
          [Op.ne]: "terminated", // Exclude terminated contracts
        }, // Exclude terminated contracts
        [Op.or]: [{ ClientId: profile.id }, { ContractorId: profile.id }],
      },
    });

    res.json(contracts);
  } catch (error) {
    console.error("Error fetching contracts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/jobs/unpaid", getProfile, async (req, res) => {
  const { Job, Contract } = req.app.get("models");
  const { profile } = req;

  try {
    // Find all unpaid jobs for active contracts belonging to the calling user
    const unpaidJobs = await Job.findAll({
      where: {
        paid: false, // Only unpaid jobs
      },
      include: [
        {
          model: Contract,
          required: true, // Ensures only jobs with contracts are included
          where: {
            status: { [Op.in]: ["new", "in_progress"] }, // Only active contracts
            [Op.or]: [{ ClientId: profile.id }, { ContractorId: profile.id }],
          },
        },
      ],
    });

    res.json(unpaidJobs);
  } catch (error) {
    console.error("Error fetching unpaid jobs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = app;
