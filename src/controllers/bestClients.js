const { Op } = require("sequelize");
const { sequelize } = require("../model");

const bestClients = async (req, res) => {
  const { Job, Profile, Contract } = req.app.get("models");
  const { start, end, limit = 2 } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: "Start and end dates are required" });
  }

  try {
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
          include: [{ model: Profile, as: "Client", attributes: [] }],
        },
      ],
      group: ["Contract.Client.id"],
      order: [[sequelize.fn("SUM", sequelize.col("price")), "DESC"]],
      limit: parseInt(limit, 10),
    });

    if (results.length === 0) {
      return res.status(404).json({ error: "No clients found in the specified date range" });
    }

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
};

module.exports = { bestClients };
