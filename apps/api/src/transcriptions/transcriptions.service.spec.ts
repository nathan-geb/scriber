import { Test, TestingModule } from '@nestjs/testing';
import { TranscriptionsService } from './transcriptions.service';

describe('TranscriptionsService', () => {
  let service: TranscriptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TranscriptionsService],
    }).compile();

    service = module.get<TranscriptionsService>(TranscriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
