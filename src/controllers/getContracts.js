const { Op } = require("sequelize");

const getContracts = async (req, res) => {
  const { Contract } = req.app.get("models");
  const { profile } = req;

  try {
    const contracts = await Contract.findAll({
      where: {
        status: {
          [Op.ne]: "terminated",
        },
        [Op.or]: [{ ClientId: profile.id }, { ContractorId: profile.id }],
      },
    });

    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getContracts };
