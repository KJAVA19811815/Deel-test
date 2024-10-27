const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./model");
const { getProfile } = require("./middleware/getProfile");
const { getContractById } = require("./controllers/getContractById");
const { getContracts } = require("./controllers/getContracts");
const app = express();
app.use(bodyParser.json());
app.set("sequelize", sequelize);
app.set("models", sequelize.models);
const { Op } = require("sequelize");

app.get("/contracts/:id", getProfile, getContractById);

app.get("/contracts", getProfile, getContracts);

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

app.get("/admin/best-profession", async (req, res) => {
  const { Job, Profile, Contract } = req.app.get("models");
  const { start, end } = req.query;

  // Validate date range
  if (!start || !end) {
    return res.status(400).json({ error: "Start and end dates are required" });
  }

  try {
    // Find total earnings by profession within the given date range
    const results = await Job.findAll({
      attributes: [
        [sequelize.col("Contract.Contractor.profession"), "profession"],
        [sequelize.fn("SUM", sequelize.col("price")), "totalEarnings"],
      ],
      where: {
        paid: true,
        paymentDate: {
          [Op.between]: [new Date(start), new Date(end)],
        },
      },
      include: [
        {
          model: Contract,
          include: [
            { model: Profile, as: "Contractor", attributes: ["profession"] },
          ],
        },
      ],
      group: ["Contract.Contractor.profession"],
      order: [[sequelize.fn("SUM", sequelize.col("price")), "DESC"]],
      limit: 1, // Only get the top profession by earnings
    });

    if (results.length === 0) {
      return res
        .status(404)
        .json({ error: "No jobs found in the specified date range" });
    }

    const bestProfession = results[0].dataValues;

    res.json({
      profession: bestProfession.profession,
      totalEarnings: bestProfession.totalEarnings,
    });
  } catch (error) {
    console.error("Error fetching best profession:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/admin/best-clients", async (req, res) => {
  const { Job, Profile, Contract } = req.app.get("models");
  const { start, end, limit = 2 } = req.query;

  // Validate date range
  if (!start || !end) {
    return res.status(400).json({ error: "Start and end dates are required" });
  }

  try {
    // Find total payments by client within the given date range
    const results = await Job.findAll({
      attributes: [
        [sequelize.col("Contract.Client.id"), "clientId"],
        [sequelize.col("Contract.Client.firstName"), "firstName"],
        [sequelize.col("Contract.Client.lastName"), "lastName"],
        [sequelize.fn("SUM", sequelize.col("price")), "totalPaid"],
      ],
      where: {
        paid: true,
        paymentDate: {
          [Op.between]: [new Date(start), new Date(end)],
        },
      },
      include: [
        {
          model: Contract,
          include: [{ model: Profile, as: "Client", attributes: [] }], // Join with client but exclude extra fields
        },
      ],
      group: ["Contract.Client.id"],
      order: [[sequelize.fn("SUM", sequelize.col("price")), "DESC"]],
      limit: parseInt(limit, 10), // Apply the limit from the query parameter or default to 2
    });

    if (results.length === 0) {
      return res
        .status(404)
        .json({ error: "No clients found in the specified date range" });
    }

    // Format response to include only relevant fields
    const bestClients = results.map((client) => ({
      id: client.dataValues.clientId,
      fullName: `${client.dataValues.firstName} ${client.dataValues.lastName}`,
      totalPaid: client.dataValues.totalPaid,
    }));

    res.json(bestClients);
  } catch (error) {
    console.error("Error fetching best clients:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = app;
