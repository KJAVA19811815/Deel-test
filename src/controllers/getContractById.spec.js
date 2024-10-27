
const { getContractById } = require('./getContractById');
const { Contract } = require('../model');

jest.mock('../model');

describe('getContractById', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { id: '1' },
      profile: { id: 1, type: 'client' },
      app: {
        get: jest.fn().mockReturnValue({ Contract })
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      end: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return contract if it belongs to the client', async () => {
    const mockContract = { id: 1, ClientId: 1, terms: 'Test terms', status: 'new' };
    Contract.findOne.mockResolvedValue(mockContract);

    await getContractById(req, res);

    expect(res.json).toHaveBeenCalledWith(mockContract);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('should return 404 if contract does not belong to the client', async () => {
    Contract.findOne.mockResolvedValue(null);

    await getContractById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.end).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should return 500 if there is a server error', async () => {
    Contract.findOne.mockRejectedValue(new Error('Database error'));

    await getContractById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
  });
});
