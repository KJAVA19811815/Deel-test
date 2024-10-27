const { Op } = require("sequelize");
const { sequelize } = require("../model")

const bestProfession = async (req, res) => {
  const { Job, Profile, Contract } = req.app.get("models");
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: "Start and end dates are required" });
  }

  try {
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
      limit: 1,
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
};

module.exports = { bestProfession };
