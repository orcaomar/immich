import { LoginResponseDto } from '@immich/sdk';
import { expect, test } from '@playwright/test';
import { utils } from 'src/utils';

test.describe('Smart Album E2E', () => {
  let admin: LoginResponseDto;

  test.beforeAll(async () => {
    utils.initSdk();
    await utils.resetDatabase();
    admin = await utils.adminSetup();
  });

  test('should disable manual asset uploads and display the premium rules banner for empty smart albums', async ({ context, page }) => {
    await utils.setAuthCookies(context, admin.accessToken);

    // Create a dynamic smart album using the SDK / database utility
    const smartAlbum = await utils.createAlbum(admin.accessToken, {
      albumName: 'My Smart Album',
      isSmart: true,
      criteria: {
        query: 'cute puppies catching a frisbee',
      },
    } as any);

    // Navigate to the smart album page
    await page.goto(`/albums/${smartAlbum.id}`);

    // 1. Verify standard "Select photos" upload/add action button is NOT visible
    const selectPhotosButton = page.getByRole('button', { name: 'Select photos' });
    await expect(selectPhotosButton).not.toBeVisible();

    // 2. Verify our premium glassmorphic active-query rules card is rendered beautifully
    const smartCard = page.locator('#smart-album-rules');
    await expect(smartCard).toBeVisible();

    // 3. Verify card elements: Title, AI Query pill, Listening badge
    await expect(smartCard.getByText('Dynamic Smart Album')).toBeVisible();
    await expect(smartCard.getByText('Active Search Query Rules')).toBeVisible();
    await expect(smartCard.getByText('cute puppies catching a frisbee')).toBeVisible();
    await expect(smartCard.getByText('Listening for incoming matching media uploads...')).toBeVisible();
  });

  test('should dynamically filter assets based on smart album people criteria (includes/excludes)', async ({ context, page }) => {
    await utils.setAuthCookies(context, admin.accessToken);

    // 1. Create mock people: Alice and Bob
    const alice = await utils.createPerson(admin.accessToken, { name: 'Alice' });
    const bob = await utils.createPerson(admin.accessToken, { name: 'Bob' });

    // 2. Create mock assets (utilizes makeRandomImage dynamic generator)
    const asset1 = await utils.createAsset(admin.accessToken); // Belongs to Alice
    const asset2 = await utils.createAsset(admin.accessToken); // Belongs to Bob
    const asset3 = await utils.createAsset(admin.accessToken); // Belongs to Alice & Bob

    // 3. Associate faces in the database using E2E helpers
    await Promise.all([
      utils.createFace({ assetId: asset1.id, personId: alice.id }),
      utils.createFace({ assetId: asset2.id, personId: bob.id }),
      utils.createFace({ assetId: asset3.id, personId: alice.id }),
      utils.createFace({ assetId: asset3.id, personId: bob.id }),
    ]);

    // 4. Create a smart album: Include 'Alice', Exclude 'Bob' -> Should dynamically filter and match ONLY asset1
    const smartAlbum = await utils.createAlbum(admin.accessToken, {
      albumName: 'Only Alice Smart Album',
      isSmart: true,
      criteria: {
        personQuery: {
          includes: [{ personIds: [alice.id], minCount: 1 }],
          excludes: [bob.id],
        },
      },
    } as any);

    // 5. Navigate to the smart album page
    await page.goto(`/albums/${smartAlbum.id}`);

    // 6. Verify that the dynamic smart album lists asset1, but NOT asset2 or asset3
    await expect(page.locator('#smart-album-rules')).not.toBeVisible();
    await expect(page.locator(`a[href*="/photos/${asset1.id}"]`)).toBeVisible();
    await expect(page.locator(`a[href*="/photos/${asset2.id}"]`)).not.toBeVisible();
    await expect(page.locator(`a[href*="/photos/${asset3.id}"]`)).not.toBeVisible();
  });
});
