const { createJobsPayment } = require('./createJobsPayment');
const { Job, Contract, Profile, sequelize } = require('../model');
const { Op } = require("sequelize");

jest.mock('../model');

describe('createJobsPayment', () => {
  let req, res, transaction;

  beforeEach(() => {
    req = {
      params: { job_id: '1' },
      profile: { id: 1, type: 'client', balance: 500 },
      app: {
        get: jest.fn().mockReturnValue({ Job, Contract, Profile })
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    transaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction = jest.fn((callback) => callback(transaction));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully pay for a job if balance is sufficient', async () => {
    const mockJob = {
      id: 1,
      price: 200,
      paid: false,
      save: jest.fn(),
      Contract: {
        Contractor: { id: 2, balance: 0, save: jest.fn() },
        ClientId: 1,
        status: 'in_progress'
      }
    };
    Job.findOne.mockResolvedValue(mockJob);
    Profile.findByPk = jest.fn().mockResolvedValue(req.profile);

    await createJobsPayment(req, res);

    expect(Job.findOne).toHaveBeenCalledWith({
      where: { id: req.params.job_id, paid: false },
      include: {
        model: Contract,
        where: {
          ClientId: req.profile.id,
          status: { [Op.in]: ["new", "in_progress"] }
        },
        include: { model: Profile, as: "Contractor" }
      },
      transaction
    });
    expect(req.profile.balance).toBe(300);
    expect(mockJob.Contract.Contractor.balance).toBe(200);
    expect(mockJob.save).toHaveBeenCalled();
    expect(mockJob.Contract.Contractor.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: "Job paid successfully" });
  });

  it('should return 400 if client balance is insufficient', async () => {
    req.profile.balance = 100;
    const mockJob = { price: 200, paid: false, Contract: { ClientId: 1, status: 'in_progress' } };
    Job.findOne.mockResolvedValue(mockJob);

    await createJobsPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Insufficient balance to pay for the job" });
  });

  it('should return 404 if job is not found or already paid', async () => {
    Job.findOne.mockResolvedValue(null);

    await createJobsPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Job not found or already paid" });
  });

  it('should return 403 if user is not a client', async () => {
    req.profile.type = 'contractor';

    await createJobsPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Only clients can pay for jobs" });
  });

  it('should return 500 if there is a server error', async () => {
    Job.findOne.mockRejectedValue(new Error("Database error"));

    await createJobsPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error" });
  });
});
