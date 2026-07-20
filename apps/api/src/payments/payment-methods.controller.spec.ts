import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodConfig } from './entities/payment-method-config.entity';

describe('PaymentMethodsController', () => {
  let controller: PaymentMethodsController;
  const configRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentMethodsController],
      providers: [
        {
          provide: getRepositoryToken(PaymentMethodConfig),
          useValue: configRepository,
        },
      ],
    }).compile();

    controller = module.get(PaymentMethodsController);
  });

  it('does not advertise payment methods that are absent from configuration', async () => {
    configRepository.find.mockResolvedValue([]);

    await expect(controller.getActiveMethods()).resolves.toEqual([]);
  });

  it('returns enabled payment methods from configuration', async () => {
    configRepository.find.mockResolvedValue([
      {
        type: 'card',
        label: 'Credit Card',
        enabled: true,
        details: null,
      },
    ]);

    await expect(controller.getActiveMethods()).resolves.toEqual([
      {
        type: 'card',
        label: 'Credit Card',
        enabled: true,
        details: null,
      },
    ]);
  });
});
