import { Injectable, OnModuleInit } from '@nestjs/common';
import { MeiliSearch } from 'meilisearch';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;
  private indexName = 'meetings';

  constructor() {
    const host = process.env.MEILISEARCH_HOST || 'http://localhost:7700';
    const apiKey = process.env.MEILISEARCH_KEY;
    this.client = new MeiliSearch({ host, apiKey });
  }

  async onModuleInit() {
    // Ensure index exists and has correct settings
    const index = this.client.index(this.indexName);
    await index.updateSettings({
      searchableAttributes: ['title', 'content', 'transcript'],
      filterableAttributes: ['organizationId', 'userId', 'status'],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
      ],
    });
  }

  async indexMeeting(meeting: any, minutes?: any, transcript?: string) {
    return this.client.index(this.indexName).addDocuments([
      {
        id: meeting.id,
        title: meeting.title,
        organizationId: meeting.organizationId,
        userId: meeting.userId,
        status: meeting.status,
        content: minutes?.content || '',
        transcript: transcript || '',
        createdAt: meeting.createdAt,
      },
    ]);
  }

  async search(
    query: string,
    filters: { organizationId?: string; userId?: string },
  ) {
    const filterParts: string[] = [];
    if (filters.organizationId) {
      filterParts.push(`organizationId = "${filters.organizationId}"`);
    } else if (filters.userId) {
      filterParts.push(`userId = "${filters.userId}"`);
    }

    return this.client.index(this.indexName).search(query, {
      filter: filterParts.join(' AND '),
    });
  }

  async deleteFromIndex(meetingId: string) {
    return this.client.index(this.indexName).deleteDocument(meetingId);
  }
}
