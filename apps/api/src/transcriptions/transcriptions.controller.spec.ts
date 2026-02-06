import { Test, TestingModule } from '@nestjs/testing';
import { TranscriptionsController } from './transcriptions.controller';

describe('TranscriptionsController', () => {
  let controller: TranscriptionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TranscriptionsController],
    }).compile();

    controller = module.get<TranscriptionsController>(TranscriptionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
