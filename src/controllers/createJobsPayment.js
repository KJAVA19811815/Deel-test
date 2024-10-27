const { Op } = require("sequelize");
const { sequelize } = require("../model");

const createJobsPayment = async (req, res) => {
  const { Job, Contract, Profile } = req.app.get("models");
  const { job_id } = req.params;
  const { profile } = req;

  if (profile.type !== "client") {
    return res.status(403).json({ error: "Only clients can pay for jobs" });
  }

  try {
    await sequelize.transaction(async (transaction) => {
      const job = await Job.findOne({
        where: { id: job_id, paid: false },
        include: {
          model: Contract,
          where: {
            ClientId: profile.id,
            status: { [Op.in]: ["new", "in_progress"] },
          },
          include: { model: Profile, as: "Contractor" },
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

      profile.balance -= jobPrice;
      await profile.save({ transaction });

      const contractor = job.Contract.Contractor;
      contractor.balance += jobPrice;
      await contractor.save({ transaction });

      job.paid = true;
      job.paymentDate = new Date();
      await job.save({ transaction });

      res.json({ message: "Job paid successfully" });
    });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { createJobsPayment };
