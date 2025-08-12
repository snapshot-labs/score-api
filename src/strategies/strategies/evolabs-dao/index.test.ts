// Mock dependencies before importing the strategy
const mockMulticaller = {
  call: jest.fn(),
  execute: jest.fn()
};

const mockGetDelegations = jest.fn();

jest.mock('../../utils', () => ({
  Multicaller: jest.fn().mockImplementation(() => mockMulticaller)
}));

jest.mock('../../utils/delegation', () => ({
  getDelegations: mockGetDelegations
}));

import { strategy } from './index';

describe('evolabs-dao strategy', () => {
  const mockProvider = {
    call: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDelegations.mockResolvedValue({});
  });

  it('should require sbtAddress parameter', async () => {
    const addresses = ['0x1234567890123456789012345678901234567890'];
    const options = {};

    await expect(
      strategy('test-space', '1', mockProvider, addresses, options, 'latest')
    ).rejects.toThrow('sbtAddress parameter is required');
  });

  it('should return zeros for addresses with no SBT', async () => {
    mockMulticaller.execute.mockResolvedValue({
      '0x1234567890123456789012345678901234567890': '0'
    });

    const addresses = ['0x1234567890123456789012345678901234567890'];
    const options = {
      sbtAddress: '0xSBTContract'
    };

    const result = await strategy(
      'test-space',
      '1',
      mockProvider,
      addresses,
      options,
      'latest'
    );

    expect(result).toEqual({
      '0x1234567890123456789012345678901234567890': 0
    });
  });

  it('should assign 1 vote per SBT holder', async () => {
    mockMulticaller.execute.mockResolvedValue({
      '0x1234567890123456789012345678901234567890': '1',
      '0x2345678901234567890123456789012345678901': '2'
    });

    const addresses = [
      '0x1234567890123456789012345678901234567890',
      '0x2345678901234567890123456789012345678901'
    ];
    const options = {
      sbtAddress: '0xSBTContract'
    };

    const result = await strategy(
      'test-space',
      '1',
      mockProvider,
      addresses,
      options,
      'latest'
    );

    expect(result).toEqual({
      '0x1234567890123456789012345678901234567890': 1,
      '0x2345678901234567890123456789012345678901': 1
    });
  });

  it('should filter out blacklisted addresses', async () => {
    // Only non-blacklisted address should be checked
    mockMulticaller.execute.mockResolvedValue({
      '0x2345678901234567890123456789012345678901': '1'
    });

    const addresses = [
      '0x1234567890123456789012345678901234567890', // blacklisted
      '0x2345678901234567890123456789012345678901'
    ];
    const options = {
      sbtAddress: '0xSBTContract',
      additionalBlacklist: ['0x1234567890123456789012345678901234567890']
    };

    const result = await strategy(
      'test-space',
      '1',
      mockProvider,
      addresses,
      options,
      'latest'
    );

    expect(result).toEqual({
      '0x1234567890123456789012345678901234567890': 0, // blacklisted, gets 0
      '0x2345678901234567890123456789012345678901': 1
    });
  });

  it('should handle Snapshot delegations correctly', async () => {
    // Mock getDelegations with delegation: delegate -> [delegators]
    mockGetDelegations.mockResolvedValue({
      '0x2345678901234567890123456789012345678901': [
        '0x1234567890123456789012345678901234567890'
      ]
    });

    // Both addresses have SBTs
    mockMulticaller.execute.mockResolvedValue({
      '0x1234567890123456789012345678901234567890': '1',
      '0x2345678901234567890123456789012345678901': '1'
    });

    const addresses = [
      '0x1234567890123456789012345678901234567890', // delegator
      '0x2345678901234567890123456789012345678901' // delegate
    ];
    const options = {
      sbtAddress: '0xSBTContract',
      delegationSpace: 'test-space'
    };

    const result = await strategy(
      'test-space',
      '1',
      mockProvider,
      addresses,
      options,
      'latest'
    );

    expect(result).toEqual({
      '0x1234567890123456789012345678901234567890': 0, // delegated away
      '0x2345678901234567890123456789012345678901': 2 // own vote + delegated vote
    });
  });

  it('should handle on-chain delegations when enabled', async () => {
    // Mock SBT calls - both addresses have SBTs
    mockMulticaller.execute
      .mockResolvedValueOnce({
        '0x1234567890123456789012345678901234567890': '1',
        '0x2345678901234567890123456789012345678901': '1'
      })
      // Mock delegation calls - first address delegates to second
      .mockResolvedValueOnce({
        '0x1234567890123456789012345678901234567890':
          '0x2345678901234567890123456789012345678901'
      });

    const addresses = [
      '0x1234567890123456789012345678901234567890', // delegator
      '0x2345678901234567890123456789012345678901' // delegate
    ];
    const options = {
      sbtAddress: '0xSBTContract',
      useOnChainDelegation: true,
      delegationContract: '0xDelegationContract'
    };

    const result = await strategy(
      'test-space',
      '1',
      mockProvider,
      addresses,
      options,
      'latest'
    );

    expect(result).toEqual({
      '0x1234567890123456789012345678901234567890': 0, // delegated away
      '0x2345678901234567890123456789012345678901': 2 // own vote + delegated vote
    });
  });
});
