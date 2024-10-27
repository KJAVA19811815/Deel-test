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

app.post("/jobs/:job_id/pay", getProfile, async (req, res) => {
  const { Job, Contract, Profile } = req.app.get("models");
  const { job_id } = req.params;
  console.log("here", req.params);
  const { profile } = req;

  if (profile.type !== "client") {
    return res.status(403).json({ error: "Only clients can pay for jobs" });
  }

  try {
    // Start a transaction to ensure atomicity of the balance transfer and job update
    await sequelize.transaction(async (transaction) => {
      // Fetch the job with its associated contract and contractor profile
      const job = await Job.findOne({
        where: { id: job_id, paid: false }, // Only unpaid jobs
        include: {
          model: Contract,
          where: {
            ClientId: profile.id,
            status: { [Op.in]: ["new", "in_progress"] },
          }, // Ensure active contract owned by client
          include: { model: Profile, as: "Contractor" }, // Include contractor profile
        },
        transaction,
      });

      if (!job) {
        return res.status(404).json({ error: "Job not found or already paid" });
      }

      const jobPrice = job.price;
      const clientBalance = profile.balance;

      if (clientBalance < jobPrice) {
        return res
          .status(400)
          .json({ error: "Insufficient balance to pay for the job" });
      }

      // Deduct job price from client and add it to the contractor's balance
      profile.balance -= jobPrice;
      await profile.save({ transaction });

      const contractor = job.Contract.Contractor;
      contractor.balance += jobPrice;
      await contractor.save({ transaction });

      // Mark the job as paid
      job.paid = true;
      job.paymentDate = new Date();
      await job.save({ transaction });

      res.json({ message: "Job paid successfully" });
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/balances/deposit/:userId", getProfile, async (req, res) => {
  const { Profile, Job, Contract } = req.app.get("models");
  const { userId } = req.params;
  const { amount } = req.body;
  console.log("BOSY", amount);

  if (amount <= 0) {
    return res
      .status(400)
      .json({ error: "Deposit amount must be greater than zero" });
  }

  try {
    // Start a transaction to ensure atomicity
    await sequelize.transaction(async (transaction) => {
      // Fetch the client profile
      const client = await Profile.findOne({
        where: { id: userId, type: "client" },
        transaction,
      });

      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Calculate the total amount of unpaid jobs for active contracts for the client
      const totalUnpaidJobs = await Job.sum("price", {
        where: { paid: false },
        include: [
          {
            model: Contract,
            where: {
              ClientId: client.id,
              status: { [Op.in]: ["new", "in_progress"] },
            },
          },
        ],
        transaction,
      });

      // Calculate 25% of the total unpaid jobs amount
      const depositLimit = totalUnpaidJobs * 0.25;

      if (amount > depositLimit) {
        return res.status(400).json({
          error: `Deposit exceeds the allowed limit of ${depositLimit}`,
        });
      }

      // Update the client's balance
      client.balance += amount;
      await client.save({ transaction });

      res.json({ message: "Deposit successful", newBalance: client.balance });
    });
  } catch (error) {
    console.error("Error processing deposit:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = app;
