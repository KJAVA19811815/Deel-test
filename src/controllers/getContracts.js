const { Op } = require("sequelize");

const getContracts = async (req, res) => {
  const { Contract } = req.app.get("models");
  const { profile } = req;

  try {
    // Find contracts where the user is either the client or contractor and status is not 'terminated'
    const contracts = await Contract.findAll({
      where: {
        status: {
          [Op.ne]: "terminated", // Exclude terminated contracts
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
