const getContractById = async (req, res) => {
  const { Contract } = req.app.get("models");
  const { id } = req.params;
  const { profile } = req;

  try {
    const contract = await Contract.findOne({
      where: { id, ClientId: profile.id },
    });

    if (!contract) return res.status(404).end();

    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getContractById };
