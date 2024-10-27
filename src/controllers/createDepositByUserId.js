const { Op } = require("sequelize");
const { sequelize } = require("../model");

const createDepositByUserId = async (req, res) => {
  const { Profile, Job, Contract } = req.app.get("models");
  const { userId } = req.params;
  const { amount } = req.body;

  if (amount <= 0) {
    return res.status(400).json({ error: "Deposit amount must be greater than zero" });
  }

  try {
    await sequelize.transaction(async (transaction) => {
      const client = await Profile.findOne({
        where: { id: userId, type: "client" },
        transaction,
      });

      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

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

      const depositLimit = totalUnpaidJobs * 0.25;

      if (amount > depositLimit) {
        return res.status(400).json({
          error: `Deposit exceeds the allowed limit of ${depositLimit}`,
        });
      }

      client.balance += amount;
      await client.save({ transaction });

      res.json({ message: "Deposit successful", newBalance: client.balance });
    });
  } catch (error) {
    console.error("Error processing deposit:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { createDepositByUserId };
