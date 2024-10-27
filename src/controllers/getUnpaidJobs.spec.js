const { getUnpaidJobs } = require('./getUnpaidJobs');
const { Job, Contract } = require('../model');
const { Op } = require("sequelize");

jest.mock('../model');

describe('getUnpaidJobs', () => {
  let req, res;

  beforeEach(() => {
    req = {
      profile: { id: 1, type: 'client' },
      app: {
        get: jest.fn().mockReturnValue({ Job, Contract })
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

  it('should return unpaid jobs for active contracts belonging to the user', async () => {
    const mockUnpaidJobs = [
      { id: 1, paid: false, description: 'Job 1', Contract: { ClientId: 1, status: 'new' } },
      { id: 2, paid: false, description: 'Job 2', Contract: { ContractorId: 1, status: 'in_progress' } }
    ];
    Job.findAll.mockResolvedValue(mockUnpaidJobs);

    await getUnpaidJobs(req, res);

    expect(Job.findAll).toHaveBeenCalledWith({
      where: { paid: false },
      include: [
        {
          model: Contract,
          required: true,
          where: {
            status: { [Op.in]: ["new", "in_progress"] },
            [Op.or]: [{ ClientId: req.profile.id }, { ContractorId: req.profile.id }],
          },
        },
      ],
    });
    expect(res.json).toHaveBeenCalledWith(mockUnpaidJobs);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return an empty array if no unpaid jobs are found', async () => {
    Job.findAll.mockResolvedValue([]);

    await getUnpaidJobs(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 500 if there is a server error', async () => {
    Job.findAll.mockRejectedValue(new Error('Database error'));

    await getUnpaidJobs(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error" });
  });
});
