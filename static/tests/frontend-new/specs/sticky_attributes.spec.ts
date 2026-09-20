import {expect, Page, test} from '@playwright/test';
import {clearPadContent, getPadBody, goToNewPad}
  from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

const BOLD_BUTTON = '.buttonicon-bold';

// Core marks a depressed formatting button by putting `selected` on the <a>
// that wraps the icon (SELECT_BUTTON_CLASS in ace2_inner).
const boldButtonAnchor = (page: Page) => page.locator('li[data-key="bold"] > a');

// Gecko applies the attributes of the character to the *left* of the caret to
// freshly typed text instead of the attributes of the hidden marker character
// this plugin replaces, so text typed after switching an attribute back off
// keeps the old styling there. That predates this fix — it reproduces
// identically on the previous release — and is a property of the
// hidden-character mechanism itself, so the two "turns back off" assertions
// only run on Chromium, which is also the only project the plugin's Frontend
// Tests workflow runs.
const GECKO_SKIP = 'sticky attributes do not survive a toggle-off in Gecko yet';

test.beforeEach(async ({page}) => {
  await goToNewPad(page);
  await clearPadContent(page);
});

test.describe('ep_sticky_attributes toolbar buttons', () => {
  test('a second click on the bold button turns sticky bold back off',
      async ({page, browserName}) => {
        test.skip(browserName === 'firefox', GECKO_SKIP);

        const padBody = await getPadBody(page);
        await padBody.click();
        await page.keyboard.insertText('start');
        await expect(padBody).toContainText('start');

        await page.locator(BOLD_BUTTON).click({force: true});
        await page.keyboard.insertText('AAA');
        await expect(padBody.locator('b')).toHaveText('AAA');

        await page.locator(BOLD_BUTTON).click({force: true});
        await page.keyboard.insertText('BBB');
        await expect(padBody).toContainText('BBB');

        // Regression test for #63. The second press used to hand
        // `setAttributeOnSelection()` a boolean `false`, which Etherpad
        // stringifies to `'false'` — a non-empty value, so the attribute
        // stayed set and everything typed afterwards was still bold.
        await expect(padBody.locator('b')).toHaveCount(1);
        await expect(padBody.locator('b')).toHaveText('AAA');
      });

  test('sticky bold toggles off on an empty line too',
      async ({page, browserName}) => {
        test.skip(browserName === 'firefox', GECKO_SKIP);

        const padBody = await getPadBody(page);
        await padBody.click();

        // Caret at column 0 of an empty line. The old code skipped the
        // "is it already applied?" probe whenever the caret sat at column 1
        // but still applied the compensation for it, leaving the range start
        // one column past the range end (#63).
        await page.locator(BOLD_BUTTON).click({force: true});
        await page.keyboard.insertText('A');
        await expect(padBody.locator('b')).toHaveText('A');

        await page.locator(BOLD_BUTTON).click({force: true});
        await page.keyboard.insertText('b');
        await expect(padBody).toContainText('Ab');
        await expect(padBody.locator('b')).toHaveText('A');
      });

  test('the bold button is shown as pressed while sticky bold is armed',
      async ({page}) => {
        const padBody = await getPadBody(page);
        await padBody.click();
        await page.keyboard.insertText('start');
        await expect(padBody).toContainText('start');

        await expect(boldButtonAnchor(page)).not.toHaveClass(/\bselected\b/);

        // Regression test for #65. The plugin used to toggle an
        // `activeButton` class that no shipped skin styles, so sticky mode
        // never looked any different from the idle state.
        await page.locator(BOLD_BUTTON).click({force: true});
        await expect(boldButtonAnchor(page)).toHaveClass(/\bselected\b/);

        await page.keyboard.insertText('AAA');
        await expect(padBody.locator('b')).toHaveText('AAA');
        await expect(boldButtonAnchor(page)).toHaveClass(/\bselected\b/);

        await page.locator(BOLD_BUTTON).click({force: true});
        await expect(boldButtonAnchor(page)).not.toHaveClass(/\bselected\b/);
      });
});
