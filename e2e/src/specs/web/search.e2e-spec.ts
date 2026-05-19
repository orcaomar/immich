import { LoginResponseDto, updateConfig } from '@immich/sdk';
import { expect, test } from '@playwright/test';
import { asBearerAuth, utils } from 'src/utils';

test.describe('Search E2E', () => {
  let admin: LoginResponseDto;

  test.beforeAll(async () => {
    utils.initSdk();
    await utils.resetDatabase();
    admin = await utils.adminSetup();

    // 1. Enable Machine Learning & CLIP search config for E2E tests
    const config = await utils.getSystemConfig(admin.accessToken);
    config.machineLearning.enabled = true;
    config.machineLearning.clip.enabled = true;
    await updateConfig({ systemConfigDto: config }, { headers: asBearerAuth(admin.accessToken) });
  });

  test.afterAll(async () => {
    // 2. Restore Machine Learning config
    const config = await utils.getSystemConfig(admin.accessToken);
    config.machineLearning.enabled = false;
    config.machineLearning.clip.enabled = false;
    await updateConfig({ systemConfigDto: config }, { headers: asBearerAuth(admin.accessToken) });
  });

  test('should parse natural language search queries and return matched assets', async ({ context, page }) => {
    await utils.setAuthCookies(context, admin.accessToken);

    // 1. Create mock people: Alice, Bob, Charlie
    const alice = await utils.createPerson(admin.accessToken, { name: 'Alice' });
    const bob = await utils.createPerson(admin.accessToken, { name: 'Bob' });
    const charlie = await utils.createPerson(admin.accessToken, { name: 'Charlie' });

    // 2. Create mock assets
    const asset1 = await utils.createAsset(admin.accessToken); // Has Alice, no beach embedding
    const asset2 = await utils.createAsset(admin.accessToken); // Has Bob, has beach embedding
    const asset3 = await utils.createAsset(admin.accessToken); // Has Alice & Bob, has beach embedding (Match)
    const asset4 = await utils.createAsset(admin.accessToken); // Has Alice & Bob & Charlie, has beach embedding

    // 3. Associate faces in the database
    await Promise.all([
      utils.createFace({ assetId: asset1.id, personId: alice.id }),
      utils.createFace({ assetId: asset2.id, personId: bob.id }),
      utils.createFace({ assetId: asset3.id, personId: alice.id }),
      utils.createFace({ assetId: asset3.id, personId: bob.id }),
      utils.createFace({ assetId: asset4.id, personId: alice.id }),
      utils.createFace({ assetId: asset4.id, personId: bob.id }),
      utils.createFace({ assetId: asset4.id, personId: charlie.id }),
    ]);

    // 4. Seed deterministic beach vector embeddings
    const beachEmbedding = utils.getMockEmbedding('beach');
    await Promise.all([
      utils.createSmartSearch({ assetId: asset2.id, embedding: beachEmbedding }),
      utils.createSmartSearch({ assetId: asset3.id, embedding: beachEmbedding }),
      utils.createSmartSearch({ assetId: asset4.id, embedding: beachEmbedding }),
    ]);

    // 5. Navigate to the explore/search page
    await page.goto('/search');

    // 6. Focus search input and select AI Query type
    const searchInput = page.locator('#main-search-bar');
    await searchInput.focus();

    const typeBtn = page.locator('button[aria-haspopup="listbox"]');
    await typeBtn.click();
    await page.getByRole('button', { name: 'AI Query' }).click();

    // 7. Perform natural language query parsing search
    await searchInput.fill('Alice and Bob at the beach but not Charlie');
    await searchInput.press('Enter');

    // 8. Assert url contains query details
    await expect(page).toHaveURL(/.*\/search\?query=.*/);

    // 9. Assert correct chips are rendered
    const chipsContainer = page.locator('#search-chips');
    await expect(chipsContainer).toBeVisible();
    await expect(chipsContainer.getByText('AI Filter')).toBeVisible();
    await expect(chipsContainer.getByText('Includes Alice, Bob')).toBeVisible();
    await expect(chipsContainer.getByText('AI Exclude')).toBeVisible();
    await expect(chipsContainer.getByText('Excludes Charlie')).toBeVisible();
    await expect(chipsContainer.getByText('Context')).toBeVisible();
    await expect(chipsContainer.getByText('beach')).toBeVisible();

    // 10. Assert asset3 (Match) is rendered, but others are not
    await expect(page.locator(`a[href*="/photos/${asset3.id}"]`)).toBeVisible();
    await expect(page.locator(`a[href*="/photos/${asset1.id}"]`)).not.toBeVisible();
    await expect(page.locator(`a[href*="/photos/${asset2.id}"]`)).not.toBeVisible();
    await expect(page.locator(`a[href*="/photos/${asset4.id}"]`)).not.toBeVisible();
  });
});
