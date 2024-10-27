const getContractById = async (req, res) => {
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
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getContractById };
