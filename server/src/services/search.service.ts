import { BadRequestException, Injectable } from '@nestjs/common';
import { LRUMap } from 'mnemonist';
import { AssetMapOptions, AssetResponseDto, MapAsset, mapAsset } from 'src/dtos/asset-response.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { mapPerson, PersonResponseDto } from 'src/dtos/person.dto';
import {
  LargeAssetSearchDto,
  mapPlaces,
  MetadataSearchDto,
  PlacesResponseDto,
  RandomSearchDto,
  SearchPeopleDto,
  SearchPlacesDto,
  SearchResponseDto,
  SearchStatisticsResponseDto,
  SearchSuggestionRequestDto,
  SearchSuggestionType,
  SmartSearchDto,
  StatisticsSearchDto,
  TranslateQueryDto,
} from 'src/dtos/search.dto';
import { AssetOrder, AssetVisibility, Permission } from 'src/enum';
import { BaseService } from 'src/services/base.service';
import { requireElevatedPermission } from 'src/utils/access';
import { getMyPartnerIds } from 'src/utils/asset.util';
import { isSmartSearchEnabled } from 'src/utils/misc';

@Injectable()
export class SearchService extends BaseService {
  private embeddingCache = new LRUMap<string, string>(100);

  async searchPerson(auth: AuthDto, dto: SearchPeopleDto): Promise<PersonResponseDto[]> {
    const people = await this.personRepository.getByName(auth.user.id, dto.name, { withHidden: dto.withHidden });
    return people.map((person) => mapPerson(person));
  }

  async searchPlaces(dto: SearchPlacesDto): Promise<PlacesResponseDto[]> {
    const places = await this.searchRepository.searchPlaces(dto.name);
    return places.map((place) => mapPlaces(place));
  }

  async getExploreData(auth: AuthDto) {
    const options = { maxFields: 12, minAssetsPerField: 5 };

    const cities = await this.assetRepository.getAssetIdByCity(auth.user.id, options);
    const cityAssets = await this.assetRepository.getByIdsWithAllRelationsButStacks(
      cities.items.map(({ data }) => data),
    );
    const cityItems = cityAssets.map((asset) => ({ value: asset.exifInfo!.city!, data: mapAsset(asset, { auth }) }));

    const recents = await this.assetRepository.getRecentlyCreatedAssetIds(auth.user.id, options.maxFields);
    const recentAssets = await this.assetRepository.getByIdsWithAllRelationsButStacks(
      recents.items.map((item) => item.data),
    );
    const recentItems = recentAssets.map((asset) => ({
      value: asset.createdAt.toISOString(),
      data: mapAsset(asset, { auth }),
    }));

    return [
      { fieldName: cities.fieldName, items: cityItems },
      { fieldName: recents.fieldName, items: recentItems },
    ];
  }

  async searchMetadata(auth: AuthDto, dto: MetadataSearchDto): Promise<SearchResponseDto> {
    if (dto.visibility === AssetVisibility.Locked) {
      requireElevatedPermission(auth);
    }

    let checksum: Buffer | undefined;
    if (dto.checksum) {
      const encoding = dto.checksum.length === 28 ? 'base64' : 'hex';
      checksum = Buffer.from(dto.checksum, encoding);
    }

    const page = dto.page ?? 1;
    const size = dto.size || 250;
    const userIds = await this.getUserIdsToSearch(auth);
    const { hasNextPage, items } = await this.searchRepository.searchMetadata(
      { page, size },
      {
        ...dto,
        checksum,
        userIds,
        orderDirection: dto.order ?? AssetOrder.Desc,
      },
    );

    return this.mapResponse(items, hasNextPage ? (page + 1).toString() : null, { auth });
  }

  async searchStatistics(auth: AuthDto, dto: StatisticsSearchDto): Promise<SearchStatisticsResponseDto> {
    const userIds = await this.getUserIdsToSearch(auth);

    return await this.searchRepository.searchStatistics({
      ...dto,
      userIds,
    });
  }

  async searchRandom(auth: AuthDto, dto: RandomSearchDto): Promise<AssetResponseDto[]> {
    if (dto.visibility === AssetVisibility.Locked) {
      requireElevatedPermission(auth);
    }

    const userIds = await this.getUserIdsToSearch(auth);
    const items = await this.searchRepository.searchRandom(dto.size || 250, { ...dto, userIds });
    return items.map((item) => mapAsset(item, { auth }));
  }

  async searchLargeAssets(auth: AuthDto, dto: LargeAssetSearchDto): Promise<AssetResponseDto[]> {
    if (dto.visibility === AssetVisibility.Locked) {
      requireElevatedPermission(auth);
    }

    const userIds = await this.getUserIdsToSearch(auth);
    const items = await this.searchRepository.searchLargeAssets(dto.size || 250, { ...dto, userIds });
    return items.map((item) => mapAsset(item, { auth }));
  }

  async searchSmart(auth: AuthDto, dto: SmartSearchDto): Promise<SearchResponseDto> {
    if (dto.visibility === AssetVisibility.Locked) {
      requireElevatedPermission(auth);
    }

    const { machineLearning } = await this.getConfig({ withCache: false });
    if (!isSmartSearchEnabled(machineLearning)) {
      throw new BadRequestException('Smart search is not enabled');
    }

    const userIds = this.getUserIdsToSearch(auth);
    let embedding;
    if (dto.query) {
      const key = machineLearning.clip.modelName + dto.query + dto.language;
      embedding = this.embeddingCache.get(key);
      if (!embedding) {
        embedding = await this.machineLearningRepository.encodeText(dto.query, {
          modelName: machineLearning.clip.modelName,
          language: dto.language,
        });
        this.embeddingCache.set(key, embedding);
      }
    } else if (dto.queryAssetId) {
      await this.requireAccess({ auth, permission: Permission.AssetRead, ids: [dto.queryAssetId] });
      const getEmbeddingResponse = await this.searchRepository.getEmbedding(dto.queryAssetId);
      const assetEmbedding = getEmbeddingResponse?.embedding;
      if (!assetEmbedding) {
        throw new BadRequestException(`Asset ${dto.queryAssetId} has no embedding`);
      }
      embedding = assetEmbedding;
    } else {
      throw new BadRequestException('Either `query` or `queryAssetId` must be set');
    }
    const page = dto.page ?? 1;
    const size = dto.size || 100;
    const { hasNextPage, items } = await this.searchRepository.searchSmart(
      { page, size },
      { ...dto, userIds: await userIds, embedding },
    );

    return this.mapResponse(items, hasNextPage ? (page + 1).toString() : null, { auth });
  }

  async getAssetsByCity(auth: AuthDto): Promise<AssetResponseDto[]> {
    const userIds = await this.getUserIdsToSearch(auth);
    const assets = await this.searchRepository.getAssetsByCity(userIds);
    return assets.map((asset) => mapAsset(asset));
  }

  async getSearchSuggestions(auth: AuthDto, dto: SearchSuggestionRequestDto) {
    const userIds = await this.getUserIdsToSearch(auth);
    const suggestions = await this.getSuggestions(userIds, dto);
    if (dto.includeNull) {
      suggestions.push(null);
    }
    return suggestions;
  }

  private getSuggestions(userIds: string[], dto: SearchSuggestionRequestDto): Promise<Array<string | null>> {
    switch (dto.type) {
      case SearchSuggestionType.COUNTRY: {
        return this.searchRepository.getCountries(userIds);
      }
      case SearchSuggestionType.STATE: {
        return this.searchRepository.getStates(userIds, dto);
      }
      case SearchSuggestionType.CITY: {
        return this.searchRepository.getCities(userIds, dto);
      }
      case SearchSuggestionType.CAMERA_MAKE: {
        return this.searchRepository.getCameraMakes(userIds, dto);
      }
      case SearchSuggestionType.CAMERA_MODEL: {
        return this.searchRepository.getCameraModels(userIds, dto);
      }
      case SearchSuggestionType.CAMERA_LENS_MODEL: {
        return this.searchRepository.getCameraLensModels(userIds, dto);
      }
      default: {
        return Promise.resolve([]);
      }
    }
  }

  private async getUserIdsToSearch(auth: AuthDto): Promise<string[]> {
    const partnerIds = await getMyPartnerIds({
      userId: auth.user.id,
      repository: this.partnerRepository,
      timelineEnabled: true,
    });
    return [auth.user.id, ...partnerIds];
  }

  private mapResponse(assets: MapAsset[], nextPage: string | null, options: AssetMapOptions): SearchResponseDto {
    return {
      albums: { total: 0, count: 0, items: [], facets: [] },
      assets: {
        total: assets.length,
        count: assets.length,
        items: assets.map((asset) => mapAsset(asset, options)),
        facets: [],
        nextPage,
      },
    };
  }

  async translateQuery(auth: AuthDto, dto: TranslateQueryDto): Promise<SmartSearchDto> {
    const people = await this.personRepository.getDistinctNames(auth.user.id, { withHidden: true });
    const groups = await this.personGroupRepository.getAllForUser(auth.user.id);
    
    let result: SmartSearchDto | null = null;
    const geminiKey = process.env.IMMICH_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        result = await this.translateWithGemini(dto.query, people, groups, geminiKey);
      } catch {
        // Fallback to local parser on Gemini API errors
      }
    }
    
    if (!result) {
      result = this.translateWithLocalParser(dto.query, people, groups);
    }

    if (result && result.personQuery) {
      result.personQuery.originalQuery = dto.query;
    }

    return result;
  }

  private async translateWithGemini(
    query: string,
    people: Array<{ id: string; name: string }>,
    groups: Array<{ id: string; name: string; personIds: string[] }>,
    apiKey: string,
  ): Promise<SmartSearchDto | null> {
    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const prompt = `You are a search assistant that translates a natural language search query into a structured JSON query object for a photo library search engine.
The library has the following recognized people:
${people.map((p) => `- Name: "${p.name}", ID: "${p.id}"`).join('\n')}

The library has the following defined person groups:
${groups.map((g) => `- Group Name: "${g.name}", ID: "${g.id}", Member Person IDs: [${g.personIds.join(', ')}]`).join('\n')}

Translate the following user query:
"${query}"

Output format:
Your output must be a valid JSON object matching the following TypeScript interface:
interface SearchQuery {
  query?: string; // Any conceptual text filter remaining (e.g. "beach", "dogs", "sunset") after extracting the people logic
  personQuery?: {
    includes?: Array<{
      personIds?: string[];
      groupId?: string;
      minCount?: number;
    }>;
    excludes?: string[];
  };
}

Rules:
- Identify people mentioned in the query and map them to their corresponding IDs.
- If a person is mentioned but not in the recognized people list, do not include their ID.
- If a person group is mentioned by its Group Name, include its Group ID as groupId in an item in the includes list. Do NOT list its Member Person IDs in personIds; instead, reference it dynamically by setting the groupId.
- Formulate the logical conditions (includes with minCount, and excludes) exactly as requested.
- If the user asks for "at least X of these people", set minCount to X.
- If they ask for "Alice AND Bob", group them in the same includes group with minCount = 2 (or set separate includes groups if required).
- If they ask for "Alice OR Bob", group them in the same includes group with minCount = 1.
- If they want to exclude someone, add their ID to excludes.
- Answer ONLY with the raw JSON object, without any markdown formatting, backticks, or surrounding text.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt,
          }],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data?.contents?.[0]?.parts?.[0]?.text;
    if (text) {
      return JSON.parse(text.trim());
    }
    return null;
  }

  private translateWithLocalParser(
    query: string,
    people: Array<{ id: string; name: string }>,
    groups: Array<{ id: string; name: string; personIds: string[] }>,
  ): SmartSearchDto {
    const normalizedQuery = query.toLowerCase();
    const result: SmartSearchDto = {};
    
    const negators = ['not', 'except', 'exclude', 'excluding', 'without', 'but not'];
    let excludeIndex = -1;
    for (const negator of negators) {
      const idx = normalizedQuery.indexOf(negator);
      if (idx !== -1 && (excludeIndex === -1 || idx < excludeIndex)) {
        excludeIndex = idx;
      }
    }
    
    const includePart = excludeIndex === -1 ? query : query.slice(0, excludeIndex);
    const excludePart = excludeIndex === -1 ? '' : query.slice(excludeIndex);
    
    const findPeopleAndGroups = (text: string) => {
      const matchedPeople = new Set<string>();
      const matchedGroups = new Set<string>();
      const lowerText = text.toLowerCase();
      
      const words = lowerText.split(/\s+/)
        .map(w => w.replaceAll(/[^\w\p{L}\p{N}]/gu, ''))
        .filter(Boolean);

      for (const g of groups) {
        if (!g.name) {
          continue;
        }
        const lowerName = g.name.toLowerCase();
        const nameParts = lowerName.split(/\s+/).map((n) => n.replaceAll(/[^\w\p{L}\p{N}]/gu, '')).filter(Boolean);
        if (nameParts.length > 0 && nameParts.every((part) => words.includes(part))) {
          matchedGroups.add(g.id);
        }
      }
        
      for (const word of words) {
        if (word.length <= 2) {
          const exactMatch = people.some(p => p.name && p.name.toLowerCase() === word);
          if (!exactMatch) {
            continue;
          }
        }
        
        let bestCandidate: { id: string; name: string } | null = null;
        for (const p of people) {
          if (!p.name) {
            continue;
          }
          const lowerName = p.name.toLowerCase();
          const nameParts = lowerName.split(/\s+/)
            .map(n => n.replaceAll(/[^\w\p{L}\p{N}]/gu, ''))
            .filter(Boolean);
            
          if (nameParts.includes(word) && (!bestCandidate || p.name.length > bestCandidate.name.length)) {
            bestCandidate = p;
          }
        }
        
        if (bestCandidate) {
          matchedPeople.add(bestCandidate.id);
        }
      }
      
      return {
        people: [...matchedPeople],
        groups: [...matchedGroups],
      };
    };
    
    const includesData = findPeopleAndGroups(includePart);
    const excludesData = findPeopleAndGroups(excludePart);
    
    const excludes: string[] = [...excludesData.people];
    for (const gid of excludesData.groups) {
      const g = groups.find(group => group.id === gid);
      if (g) {
        for (const pid of g.personIds) {
          if (!excludes.includes(pid)) {
            excludes.push(pid);
          }
        }
      }
    }
    
    const personQuery: any = {};
    const includesList: any[] = [];
    
    let minCountFromText: number | null = null;
    const lowerInclude = includePart.toLowerCase();
    
    if (lowerInclude.includes(' or ') || lowerInclude.includes(' any of ')) {
      minCountFromText = 1;
    }
    
    const numberWords: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };

    const atLeastRegex = /(?:at least|min|minimum|any|of)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i;
    const match = atLeastRegex.exec(lowerInclude);
    if (match) {
      const matchValue = match[1].toLowerCase();
      let parsed = Number.parseInt(matchValue, 10);
      if (Number.isNaN(parsed)) {
        parsed = numberWords[matchValue] || 1;
      }
      if (parsed > 0) {
        minCountFromText = parsed;
      }
    }
    
    for (const gid of includesData.groups) {
      const g = groups.find(group => group.id === gid);
      let groupMinCount = minCountFromText;
      if (groupMinCount && g && groupMinCount > g.personIds.length) {
        groupMinCount = g.personIds.length;
      }
      includesList.push({
        groupId: gid,
        ...(groupMinCount ? { minCount: groupMinCount } : {}),
      });
    }
    
    const remainingPeople = includesData.people.filter(pid => {
      return !includesData.groups.some(gid => {
        const g = groups.find(group => group.id === gid);
        return g?.personIds.includes(pid);
      });
    });
    
    if (remainingPeople.length > 0) {
      let minCount = minCountFromText || remainingPeople.length;
      if (minCount > remainingPeople.length) {
        minCount = remainingPeople.length;
      }
      includesList.push({
        personIds: remainingPeople,
        minCount,
      });
    }
    
    if (includesList.length > 0) {
      personQuery.includes = includesList;
    }
    
    if (excludes.length > 0) {
      personQuery.excludes = excludes;
    }
    
    if (Object.keys(personQuery).length > 0) {
      result.personQuery = personQuery;
    }

    let residualText = query;
    const includesPeopleIds: string[] = [];
    for (const inc of includesList) {
      if (inc.personIds) {
        includesPeopleIds.push(...inc.personIds);
      }
    }
    
    // Strip matched people names (both full names and their individual component words)
    const matchedPeople = people.filter(p => includesPeopleIds.includes(p.id) || excludes.includes(p.id));
    for (const p of matchedPeople) {
      if (p.name) {
        const fullRegex = new RegExp(String.raw`\b${this.escapeRegExp(p.name)}\b`, 'gi');
        residualText = residualText.replaceAll(fullRegex, '');
        
        const words = p.name.split(/\s+/);
        for (const word of words) {
          if (word.length > 2) {
            const wordRegex = new RegExp(String.raw`\b${this.escapeRegExp(word)}\b`, 'gi');
            residualText = residualText.replaceAll(wordRegex, '');
          }
        }
      }
    }

    const matchedGroups = groups.filter(g => 
      includesData.groups.includes(g.id) || 
      excludesData.groups.includes(g.id)
    );
    for (const g of matchedGroups) {
      if (g.name) {
        const fullRegex = new RegExp(String.raw`\b${this.escapeRegExp(g.name)}\b`, 'gi');
        residualText = residualText.replaceAll(fullRegex, '');
        
        const words = g.name.split(/\s+/);
        for (const word of words) {
          if (word.length > 2) {
            const wordRegex = new RegExp(String.raw`\b${this.escapeRegExp(word)}\b`, 'gi');
            residualText = residualText.replaceAll(wordRegex, '');
          }
        }
      }
    }
    
    const keywords = [
      ...negators,
      'but', 'and', 'or', 'any', 'of', 'at least', 'min', 'minimum', 
      'photos', 'photo', 'show', 'see', 'me', 'want', 'i', 'to',
      'includes', 'include', 'contains', 'contain', 'with',
      'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
      'people', 'person', 'group', 'from'
    ];
    for (const kw of keywords) {
      const regex = new RegExp(String.raw`\b${this.escapeRegExp(kw)}\b`, 'gi');
      residualText = residualText.replaceAll(regex, '');
    }
    
    // Remove standalone numbers and punctuation
    residualText = residualText.replaceAll(/\b\d+\b/g, '');
    residualText = residualText.replaceAll(/[.,/#!$%^&*;:{}=\-_`~()?]/g, ' ');
    
    residualText = residualText.replaceAll(/\s+/g, ' ').trim();
    if (residualText && residualText.length > 2) {
      result.query = residualText;
    }
    
    return result;
  }
  
  private escapeRegExp(string: string) {
    return string.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  }
}
