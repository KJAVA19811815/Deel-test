const { Op } = require("sequelize");

const getUnpaidJobs = async (req, res) => {
  const { Job, Contract } = req.app.get("models");
  const { profile } = req;

  try {
    const unpaidJobs = await Job.findAll({
      where: {
        paid: false,
      },
      include: [
        {
          model: Contract,
          required: true,
          where: {
            status: { [Op.in]: ["new", "in_progress"] },
            [Op.or]: [{ ClientId: profile.id }, { ContractorId: profile.id }],
          },
        },
      ],
    });

    res.json(unpaidJobs);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getUnpaidJobs };
