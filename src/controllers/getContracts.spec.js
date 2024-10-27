const { getContracts } = require('./getContracts');
const { Contract } = require('../model')
const { Op } = require("sequelize");

jest.mock('../model');

describe('getContracts', () => {
  let req, res;

  beforeEach(() => {
    req = {
      profile: { id: 1, type: 'client' },
      app: {
        get: jest.fn().mockReturnValue({ Contract })
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return contracts if found for the user', async () => {
    const mockContracts = [
      { id: 1, ClientId: 1, ContractorId: 2, status: 'new', terms: 'Test terms' },
      { id: 2, ClientId: 1, ContractorId: 3, status: 'in_progress', terms: 'Another terms' }
    ];
    Contract.findAll.mockResolvedValue(mockContracts);

    await getContracts(req, res);

    expect(Contract.findAll).toHaveBeenCalledWith({
      where: {
        status: { [Op.ne]: "terminated" },
        [Op.or]: [{ ClientId: req.profile.id }, { ContractorId: req.profile.id }],
      },
    });
    expect(res.json).toHaveBeenCalledWith(mockContracts);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return an empty array if no contracts are found', async () => {
    Contract.findAll.mockResolvedValue([]);

    await getContracts(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 500 if there is a server error', async () => {
    Contract.findAll.mockRejectedValue(new Error('Database error'));

    await getContracts(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error" });
  });
});
